"""ml_model.py – IsolationForest predictive layer for the Vingoo fraud detection system.

Design
------
This module adds a fast, unsupervised anomaly-detection pass on top of the
deterministic scoring engine in scoring.py.  It is **purely additive**:
it augments existing suspicion scores rather than replacing them.

Pipeline role (called from main.py after compute_suspicion_scores):
    1. extract_features()         – build (N×11) NumPy matrix from SuspiciousAccount list
    2. train_isolation_forest()   – fit a fresh IsolationForest on the current batch
    3. predict_anomaly_scores()   – return normalised anomaly boost per account
    4. apply_ml_boost()           – blend original score + ML boost, return new list

Why IsolationForest?
--------------------
- No labels required: fits on the structure of the feature space itself.
- O(N log N) training: fast enough to run inside a single HTTP request even on
  batches of 10 000+ accounts (typical dataset: 50–500 suspicious accounts).
- Robust to outliers by design: does not assume Gaussian distributions.
- 100% scikit-learn: no extra framework dependencies.

Feature vector (11 dimensions per account)
-------------------------------------------
  0  suspicion_score       – composite rule-based score [0, 100]
  1  behavioral_score      – behavioural patterns contribution
  2  graph_score           – topology contribution (betweenness, centrality)
  3  temporal_score        – velocity / round-trip contribution
  4  amount_score          – structuring / magnitude contribution
  5  confidence_score      – evidence breadth × depth
  6  log1p_tx_count        – log(1 + transaction_count)  (skew-corrected)
  7  log1p_total_volume    – log(1 + sent + received)
  8  flow_imbalance        – |sent - received| / (sent + received + ε)
  9  n_patterns            – count of distinct detected pattern labels
  10 in_ring               – 1 if account belongs to any fraud ring, else 0

Training strategy
-----------------
- IsolationForest is fitted on the suspicious_accounts produced by the current
  request's scoring run.  No historical state is required.
- contamination="auto" lets sklearn decide: since all inputs are already pre-
  filtered as suspicious, we expect a higher-than-default anomaly fraction.
- Sub-sampling (max_samples=min(256, N)) keeps wall-time under 15 ms for N<5000.

Persistence (optional)
-----------------------
save_model() / load_model() serialise the fitted scaler + forest to disk using
joblib.  Call save_model() to warm the cache; subsequent requests can call
load_model() + predict_anomaly_scores() to skip re-training entirely (~1 ms).
The cache file is written to backend/models/isolation_forest.pkl by default.
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

# scikit-learn imports – no deep-learning frameworks anywhere
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

from models import SuspiciousAccount

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Sub-sample cap: IsolationForest degrades gracefully above this – but 256
# trees give ample isolation depth for fraud detection feature spaces.
MAX_SAMPLES_CAP = 256

# Number of trees.  100 is sklearn's default; 150 gives marginally better
# stability without a meaningful latency cost at our data sizes.
N_ESTIMATORS = 150

# Contamination: fraction of outliers in the already-suspicious input.
# "auto" = sklearn uses 0.1 internally; works well for pre-filtered inputs.
CONTAMINATION = "auto"

# Maximum score boost the ML layer can add.  Capped so it cannot override
# the rule-based score by more than this amount.
MAX_ML_BOOST = 18.0

# Weight of ML anomaly boost in the blended final score.
# final_score = original_score + (ml_anomaly_intensity * MAX_ML_BOOST)
ML_BOOST_WEIGHT = 1.0

# Model persistence path (relative to this file)
_DEFAULT_MODEL_PATH = Path(__file__).parent / "models" / "isolation_forest.pkl"

# Maximum number of historical feature rows used for scheduler-triggered retrain.
RETRAIN_MAX_ROWS: int = 20_000

# ---------------------------------------------------------------------------
# Module-level model registry
# ---------------------------------------------------------------------------
# The registry holds one trained Pipeline at a time.  All incoming prediction
# requests read from it; the background scheduler swaps it atomically while
# predictions are never blocked (RLock allows concurrent readers in CPython
# because the GIL already serialises frame execution).
# ---------------------------------------------------------------------------


@dataclass
class _ModelState:
    pipeline:   Optional[Pipeline] = None
    trained_at: Optional[float]    = None  # time.time() epoch
    n_samples:  int                = 0
    source:     str                = "none"  # "disk" | "inline" | "scheduler"


_registry_lock: threading.RLock = threading.RLock()
_registry: _ModelState = _ModelState()


def get_current_model() -> Optional[Pipeline]:
    """Thread-safe read of the current production model. Returns None if not yet ready."""
    with _registry_lock:
        return _registry.pipeline


def _set_model(pipeline: Pipeline, source: str, n_samples: int) -> None:
    """Atomically replace the production model.  Called by startup_init and the scheduler."""
    with _registry_lock:
        _registry.pipeline   = pipeline
        _registry.trained_at = time.time()
        _registry.n_samples  = n_samples
        _registry.source     = source
    log.info(
        "[ML] Model registry updated: source=%s  n_samples=%d",
        source, n_samples,
    )


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

_EPS = 1e-9


def extract_features(accounts: List[SuspiciousAccount]) -> np.ndarray:
    """Build an (N × 11) float32 feature matrix from a list of SuspiciousAccount.

    All features are computed directly from fields already present on the
    SuspiciousAccount model – no extra graph traversal required.

    Returns
    -------
    np.ndarray of shape (N, 11), dtype float32.
    Raises ValueError if accounts is empty.
    """
    if not accounts:
        raise ValueError("Cannot extract features from an empty account list.")

    rows: List[List[float]] = []

    for acc in accounts:
        sent     = acc.total_sent
        received = acc.total_received
        volume   = sent + received

        flow_imbalance = (
            abs(sent - received) / (volume + _EPS)
        )

        n_patterns = len(acc.detected_patterns)
        in_ring    = 1.0 if acc.ring_id is not None else 0.0

        rows.append([
            acc.suspicion_score,                    # 0
            acc.behavioral_score,                   # 1
            acc.graph_score,                        # 2
            acc.temporal_score,                     # 3
            acc.amount_score,                       # 4
            acc.confidence_score,                   # 5
            math.log1p(acc.transaction_count),      # 6  – skew-corrected count
            math.log1p(volume),                     # 7  – skew-corrected volume
            flow_imbalance,                         # 8
            float(n_patterns),                      # 9
            in_ring,                                # 10
        ])

    return np.array(rows, dtype=np.float32)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_isolation_forest(
    features: np.ndarray,
    *,
    n_estimators: int = N_ESTIMATORS,
    contamination: float | str = CONTAMINATION,
    random_state: int = 42,
) -> Pipeline:
    """Fit a RobustScaler → IsolationForest pipeline on the feature matrix.

    RobustScaler is used instead of StandardScaler because fraud feature
    distributions are heavily skewed; it uses the IQR to handle outliers.

    Parameters
    ----------
    features:
        (N × 11) float array from extract_features().
    n_estimators:
        Number of isolation trees.
    contamination:
        Expected fraction of outliers.  "auto" = sklearn default heuristic.
    random_state:
        Seed for reproducibility.

    Returns
    -------
    Fitted sklearn Pipeline with keys ["scaler", "isoforest"].
    """
    n_samples = features.shape[0]

    # Adaptive sub-sample: never exceed MAX_SAMPLES_CAP; small datasets use all.
    max_samples: int | str = min(n_samples, MAX_SAMPLES_CAP)

    pipeline = Pipeline([
        ("scaler",    RobustScaler()),
        ("isoforest", IsolationForest(
            n_estimators=n_estimators,
            max_samples=max_samples,
            contamination=contamination,
            random_state=random_state,
            # Use all CPU cores for parallel tree building
            n_jobs=-1,
            # Warm_start=False: always build fresh trees in this additive design
            warm_start=False,
        )),
    ])

    pipeline.fit(features)
    return pipeline


# ---------------------------------------------------------------------------
# Prediction / scoring
# ---------------------------------------------------------------------------

def predict_anomaly_scores(
    pipeline: Pipeline,
    features: np.ndarray,
) -> np.ndarray:
    """Return a normalised anomaly intensity vector in [0.0, 1.0].

    sklearn's decision_function returns raw anomaly scores where more negative
    values indicate stronger anomalies.  We normalise to [0, 1] where 1.0 is
    the most anomalous account in the batch.

    Parameters
    ----------
    pipeline:
        Fitted pipeline from train_isolation_forest().
    features:
        (N × 11) float array from extract_features().

    Returns
    -------
    np.ndarray of shape (N,), dtype float64, each value in [0.0, 1.0].
    """
    # decision_function: more negative = more anomalous
    raw_scores: np.ndarray = pipeline.decision_function(features)

    # Invert: higher = more anomalous
    anomaly_raw = -raw_scores

    # Normalise to [0, 1] within this batch
    a_min = anomaly_raw.min()
    a_max = anomaly_raw.max()
    span  = a_max - a_min

    if span < _EPS:
        # All accounts are equally anomalous – keep relative neutrality
        return np.full_like(anomaly_raw, 0.5)

    return (anomaly_raw - a_min) / span


# ---------------------------------------------------------------------------
# Score blending
# ---------------------------------------------------------------------------

def apply_ml_boost(
    accounts: List[SuspiciousAccount],
    anomaly_intensities: np.ndarray,
    *,
    max_boost: float = MAX_ML_BOOST,
) -> List[SuspiciousAccount]:
    """Blend each account's original suspicion score with its ML anomaly intensity.

    The ML layer can ONLY ADD to the score (not reduce it).  This preserves the
    rule-based floor and means a false-negative from the ML model never harms an
    account that was already flagged.

    new_score = clamp(original_score + anomaly_intensity × max_boost, 0, 100)

    The risk tier and investigation priority are recalculated to reflect the
    updated score.  All other fields are preserved verbatim.

    Parameters
    ----------
    accounts:
        Original list from compute_suspicion_scores().
    anomaly_intensities:
        (N,) array from predict_anomaly_scores(), values in [0.0, 1.0].
    max_boost:
        Maximum points the ML layer can add. Default 18.0.

    Returns
    -------
    New list of SuspiciousAccount with updated scores and tiers.
    """
    # Lazy import to avoid circular import (scoring constants live in scoring.py)
    from scoring import PRIORITY_MAP, TIER_CRITICAL, TIER_HIGH, TIER_MEDIUM

    updated: List[SuspiciousAccount] = []

    for acc, intensity in zip(accounts, anomaly_intensities):
        boost  = float(intensity) * max_boost
        new_score = min(acc.suspicion_score + boost, 100.0)
        new_score = round(new_score, 1)

        # Tier / priority recalculation
        if new_score >= TIER_CRITICAL:
            new_tier = "CRITICAL"
        elif new_score >= TIER_HIGH:
            new_tier = "HIGH"
        elif new_score >= TIER_MEDIUM:
            new_tier = "MEDIUM"
        else:
            new_tier = "LOW"

        new_priority = PRIORITY_MAP.get(new_tier, 3)

        updated.append(
            acc.model_copy(update={
                "suspicion_score":      new_score,
                "risk_tier":            new_tier,
                "investigation_priority": new_priority,
            })
        )

    return updated


# ---------------------------------------------------------------------------
# One-call convenience function (used from main.py)
# ---------------------------------------------------------------------------

def run_ml_layer(
    accounts: List[SuspiciousAccount],
    *,
    max_boost: float = MAX_ML_BOOST,
) -> Tuple[List[SuspiciousAccount], Dict[str, float]]:
    """Full train → predict → blend pipeline in one call.

    This is the only function main.py needs to import.

    Parameters
    ----------
    accounts:
        Output of compute_suspicion_scores().  If fewer than 2 accounts, the
        list is returned unchanged (IsolationForest needs ≥2 samples).
    max_boost:
        Maximum ML score boost.

    Returns
    -------
    (updated_accounts, diagnostics) where diagnostics contains latency and
    model metadata useful for logging / caching in the analysis response.
    """
    diag: Dict[str, float] = {
        "n_accounts":   float(len(accounts)),
        "train_ms":     0.0,
        "predict_ms":   0.0,
        "total_ms":     0.0,
        "avg_boost":    0.0,
        "max_boost_applied": 0.0,
        "ml_active":    0.0,  # 0 = skipped, 1 = active
    }

    if len(accounts) < 2:
        log.info("[ML] Skipping IsolationForest – fewer than 2 accounts.")
        return accounts, diag

    t0 = time.perf_counter()

    # Feature extraction
    features = extract_features(accounts)

    # ------------------------------------------------------------------
    # Model acquisition
    # Use the shared registry model when available (no training cost in the
    # request path).  Fall back to inline training only on the very first
    # request before startup_init has finished loading / training a model.
    # ------------------------------------------------------------------
    t_train_start = time.perf_counter()
    pipeline = get_current_model()
    if pipeline is None:
        log.info("[ML] No pre-trained model – training inline (first-request fallback).")
        pipeline = train_isolation_forest(features)
        _set_model(pipeline, "inline", features.shape[0])
        save_model(pipeline)  # persist so next startup skips this path
        diag["train_ms"] = (time.perf_counter() - t_train_start) * 1000.0
    else:
        diag["train_ms"] = 0.0  # training happened outside the request path

    # Prediction
    t_pred_start = time.perf_counter()
    intensities = predict_anomaly_scores(pipeline, features)
    diag["predict_ms"] = (time.perf_counter() - t_pred_start) * 1000.0

    # Score blending
    updated = apply_ml_boost(accounts, intensities, max_boost=max_boost)

    diag["total_ms"]          = (time.perf_counter() - t0) * 1000.0
    diag["avg_boost"]         = float(np.mean(intensities) * max_boost)
    diag["max_boost_applied"] = float(np.max(intensities) * max_boost)
    diag["ml_active"]         = 1.0

    log.info(
        "[ML] IsolationForest complete – N=%d  train=%.1f ms  predict=%.1f ms  "
        "total=%.1f ms  avg_boost=+%.2f",
        len(accounts),
        diag["train_ms"],
        diag["predict_ms"],
        diag["total_ms"],
        diag["avg_boost"],
    )
    print(
        f"[ML] IsolationForest: N={len(accounts)}  "
        f"train={diag['train_ms']:.1f}ms  predict={diag['predict_ms']:.1f}ms  "
        f"total={diag['total_ms']:.1f}ms  avg_boost=+{diag['avg_boost']:.2f}"
    )

    return updated, diag


# ---------------------------------------------------------------------------
# Model persistence (optional – for pre-warmed production deployments)
# ---------------------------------------------------------------------------

def save_model(
    pipeline: Pipeline,
    path: Path = _DEFAULT_MODEL_PATH,
) -> None:
    """Persist the fitted pipeline to disk using joblib.

    Creates the parent directory if it does not exist.
    File is overwritten atomically via a .tmp suffix rename.
    """
    try:
        import joblib  # shipped with scikit-learn
    except ImportError:
        log.warning("[ML] joblib not available – model not saved.")
        return

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    joblib.dump(pipeline, tmp)
    tmp.replace(path)
    log.info("[ML] Model saved to %s", path)


def load_model(
    path: Path = _DEFAULT_MODEL_PATH,
) -> Optional[Pipeline]:
    """Load a previously saved pipeline from disk.

    Returns None if the file does not exist or cannot be loaded (e.g., after
    a scikit-learn version bump that breaks pickle compatibility).
    """
    try:
        import joblib
    except ImportError:
        return None

    path = Path(path)
    if not path.exists():
        return None

    try:
        pipeline = joblib.load(path)
        log.info("[ML] Loaded cached model from %s", path)
        return pipeline
    except Exception as exc:  # noqa: BLE001
        log.warning("[ML] Failed to load cached model (%s) – will retrain.", exc)
        return None


# ---------------------------------------------------------------------------
# Startup initialisation
# ---------------------------------------------------------------------------


def startup_init(db_session_factory: Optional[Callable] = None) -> None:
    """Load a persisted model or train an initial one from historical DB features.

    Must be called once at application startup.  Use asyncio.to_thread() so it
    does not block the event loop:

        await asyncio.to_thread(startup_init, SessionLocal)

    Resolution order:
      1. Deserialise from disk (fast, ~10 ms) → update registry.
      2. Retrain from stored MLFeatureRecord rows (if DB has ≥10 rows).
      3. Defer → first analysis request will train inline and update registry.
    """
    existing = load_model()
    if existing is not None:
        _set_model(existing, "disk", 0)
        print("[ML] Pre-trained IsolationForest loaded from disk at startup.")
        return

    if db_session_factory is not None:
        try:
            _retrain_from_db(db_session_factory)
            if get_current_model() is not None:
                print("[ML] Initial IsolationForest trained from historical DB features.")
                return
        except Exception as exc:  # noqa: BLE001
            log.warning("[ML] startup_init DB train failed: %s", exc)

    print("[ML] No pre-trained model found – will train inline on first request.")


# ---------------------------------------------------------------------------
# Scheduled retraining (called by APScheduler background thread)
# ---------------------------------------------------------------------------


def scheduled_retrain(db_session_factory: Callable) -> None:
    """Retrain the IsolationForest from stored historical features.

    APScheduler calls this every 30 minutes in a daemon background thread.
    It never blocks the event loop or any API request.
    """
    log.info("[ML] Scheduled retrain triggered.")
    try:
        _retrain_from_db(db_session_factory)
    except Exception as exc:  # noqa: BLE001
        log.error("[ML] Scheduled retrain failed: %s", exc, exc_info=True)


def _retrain_from_db(db_session_factory: Callable) -> None:
    """Fetch up to RETRAIN_MAX_ROWS feature vectors from the DB and retrain.

    Reads the most recent RETRAIN_MAX_ROWS rows from ml_features, ordered by
    recorded_at DESC so the model reflects current fraud patterns.
    Atomically swaps the registry model and persists to disk on success.
    """
    from models_db import MLFeatureRecord  # local import avoids circular dep

    db = db_session_factory()
    try:
        rows = (
            db.query(MLFeatureRecord)
            .order_by(MLFeatureRecord.recorded_at.desc())
            .limit(RETRAIN_MAX_ROWS)
            .all()
        )
    finally:
        db.close()

    if len(rows) < 2:
        log.info(
            "[ML] Skipping retrain – only %d feature rows in DB (need ≥2).",
            len(rows),
        )
        return

    features = np.array([r.feature_vector for r in rows], dtype=np.float32)

    t0 = time.perf_counter()
    pipeline = train_isolation_forest(features)
    elapsed_ms = (time.perf_counter() - t0) * 1_000.0

    _set_model(pipeline, "scheduler", len(rows))
    save_model(pipeline)

    log.info(
        "[ML] Retrain complete: n=%d  elapsed=%.0f ms  source=scheduler",
        len(rows), elapsed_ms,
    )
    print(f"[ML] Scheduled retrain: n_samples={len(rows)}  elapsed={elapsed_ms:.0f} ms")
