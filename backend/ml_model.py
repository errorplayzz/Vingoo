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
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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

    # Training
    t_train_start = time.perf_counter()
    pipeline = train_isolation_forest(features)
    diag["train_ms"] = (time.perf_counter() - t_train_start) * 1000.0

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
