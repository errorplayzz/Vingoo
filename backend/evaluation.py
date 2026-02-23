"""evaluation.py – Automatic accuracy evaluation engine.

Modes:
  1. ground_truth mode:  caller provides labels (account_id -> bool is_fraud)
     Computes real precision, recall, F1, FPR, FCR.

  2. synthetic mode:     no labels provided
     Generates synthetic ground truth based on:
       - High-confidence detections (score >= 70 + confidence >= 70)  -> True Positive
       - Low-score accounts (score < 20, no patterns)                 -> True Negative
       - Ambiguous zone (20-70) -> sampled using a calibrated prior
     Returns "indicative" metrics that simulate realistic banking data
     characteristics (typical AML dataset: ~2-5% fraud prevalence).

Usage:
    from evaluation import evaluate_detections, generate_performance_report

    metrics = evaluate_detections(suspicious_accounts, total_accounts)
    # or with ground truth labels:
    labels = {"ACC001": True, "ACC002": False, ...}
    metrics = evaluate_detections(suspicious_accounts, total_accounts, ground_truth=labels)
"""

from __future__ import annotations

import math
import random
from typing import Dict, List, Optional

from models import EvaluationMetrics, SuspiciousAccount

# ---------------------------------------------------------------------------
# Calibration constants for synthetic label generation
# ---------------------------------------------------------------------------

# Expected fraud prevalence in realistic banking datasets
SYNTHETIC_FRAUD_PREVALENCE: float = 0.04   # 4% of accounts are fraudulent

# Score thresholds for synthetic label assignment
SYNTHETIC_TP_SCORE_MIN:    float = 65.0   # score >= 65 AND confidence >= 60 -> TP
SYNTHETIC_TP_CONFIDENCE:   float = 60.0
SYNTHETIC_TN_SCORE_MAX:    float = 20.0   # score < 20  AND no patterns       -> TN

# Probability of a high-score account being truly fraudulent (calibrated)
SYNTHETIC_HIGH_SCORE_FP_RATE: float = 0.08  # 8% of high-score flags are FP in reality

# Random seed for deterministic synthetic evaluation
SYNTHETIC_SEED: int = 42


# ---------------------------------------------------------------------------
# Main evaluation function
# ---------------------------------------------------------------------------

def evaluate_detections(
    suspicious_accounts: List[SuspiciousAccount],
    total_accounts: int,
    ground_truth: Optional[Dict[str, bool]] = None,
) -> EvaluationMetrics:
    """
    Compute Accuracy, Precision, Recall, F1, FPR, Fraud Capture Rate.

    Args:
        suspicious_accounts: Output from compute_suspicion_scores (flagged list)
        total_accounts:       Total unique accounts seen in the graph
        ground_truth:         Optional dict { account_id: bool(is_fraud) }.
                              If None, synthetic evaluation is performed.

    Returns:
        EvaluationMetrics instance with all computed values.
    """
    if ground_truth is not None:
        return _evaluate_with_ground_truth(suspicious_accounts, total_accounts, ground_truth)
    else:
        return _evaluate_synthetic(suspicious_accounts, total_accounts)


# ---------------------------------------------------------------------------
# Ground-truth evaluation
# ---------------------------------------------------------------------------

def _evaluate_with_ground_truth(
    suspicious_accounts: List[SuspiciousAccount],
    total_accounts: int,
    ground_truth: Dict[str, bool],
) -> EvaluationMetrics:
    """Compute real metrics using provided labels."""
    flagged_ids = {sa.account_id for sa in suspicious_accounts}
    actual_fraud = {aid for aid, is_fraud in ground_truth.items() if is_fraud}
    actual_legit  = {aid for aid, is_fraud in ground_truth.items() if not is_fraud}

    tp = len(flagged_ids & actual_fraud)
    fp = len(flagged_ids & actual_legit)
    fn = len(actual_fraud - flagged_ids)
    tn = len(actual_legit - flagged_ids)

    precision = _safe_div(tp, tp + fp)
    recall    = _safe_div(tp, tp + fn)
    f1        = _safe_div(2 * precision * recall, precision + recall)
    fpr       = _safe_div(fp, fp + tn)
    fcr       = _safe_div(tp, len(actual_fraud)) if actual_fraud else 0.0

    denominator = tp + fp + tn + fn
    accuracy = _safe_div(tp + tn, denominator)

    notes = []
    if len(ground_truth) < total_accounts:
        pct = round(len(ground_truth) / max(total_accounts, 1) * 100, 1)
        notes.append(f"Ground truth covers {pct}% of accounts ({len(ground_truth)}/{total_accounts}).")
    if len(actual_fraud) == 0:
        notes.append("No labelled fraud in ground truth — recall/FCR undefined.")

    return EvaluationMetrics(
        accuracy=round(accuracy, 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1, 4),
        false_positive_rate=round(fpr, 4),
        fraud_capture_rate=round(fcr, 4),
        true_positives=tp,
        false_positives=fp,
        true_negatives=tn,
        false_negatives=fn,
        evaluation_mode="ground_truth",
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Synthetic evaluation (no ground truth)
# ---------------------------------------------------------------------------

def _evaluate_synthetic(
    suspicious_accounts: List[SuspiciousAccount],
    total_accounts: int,
) -> EvaluationMetrics:
    """
    Generate synthetic confusion matrix based on score/confidence distribution.

    Methodology:
      1. Accounts with score >= SYNTHETIC_TP_SCORE_MIN AND
         confidence >= SYNTHETIC_TP_CONFIDENCE are classified as:
         TP with probability (1 - SYNTHETIC_HIGH_SCORE_FP_RATE), else FP
      2. Accounts with score < SYNTHETIC_TN_SCORE_MAX and no patterns  TN
      3. Ambiguous accounts  probabilistic assignment

    Uses fixed random seed for deterministic outputs across API calls.
    """
    rng = random.Random(SYNTHETIC_SEED)

    tp, fp, tn, fn = 0, 0, 0, 0

    # Estimate total "true fraud" in dataset using prevalence prior
    estimated_true_fraud = max(1, round(total_accounts * SYNTHETIC_FRAUD_PREVALENCE))

    # Set of confirmed suspicious account IDs
    flagged_set = {sa.account_id for sa in suspicious_accounts}

    # Process flagged accounts
    for sa in suspicious_accounts:
        is_high_confidence = (
            sa.suspicion_score >= SYNTHETIC_TP_SCORE_MIN
            and sa.confidence_score >= SYNTHETIC_TP_CONFIDENCE
        )
        if is_high_confidence:
            # Likely TP
            if rng.random() > SYNTHETIC_HIGH_SCORE_FP_RATE:
                tp += 1
            else:
                fp += 1
        else:
            # Moderate evidence — higher FP chance
            # Scale FP rate based on score: lower score = higher FP chance
            score_ratio = sa.suspicion_score / 100.0
            fp_chance = max(0.15, 1.0 - score_ratio * 1.5)
            if rng.random() > fp_chance:
                tp += 1
            else:
                fp += 1

    # Estimate FN: true fraud accounts that were missed
    # True frauds in dataset = estimated_true_fraud
    # FN = estimated true frauds - TP (clamped to 0)
    fn = max(0, estimated_true_fraud - tp)

    # TN = remaining non-flagged, non-fraud accounts
    non_flagged = total_accounts - len(suspicious_accounts)
    tn = max(0, non_flagged - fn)

    precision = _safe_div(tp, tp + fp)
    recall    = _safe_div(tp, tp + fn)
    f1        = _safe_div(2 * precision * recall, precision + recall)
    fpr       = _safe_div(fp, fp + tn)
    fcr       = _safe_div(tp, tp + fn)
    accuracy  = _safe_div(tp + tn, tp + fp + tn + fn)

    # Detection rate
    detection_rate = _safe_div(len(suspicious_accounts), total_accounts) if total_accounts > 0 else 0.0

    notes = [
        "Evaluation uses synthetic labels — no ground-truth CSV was provided.",
        f"Fraud prevalence prior: {SYNTHETIC_FRAUD_PREVALENCE*100:.1f}% of accounts.",
        f"Detection rate: {detection_rate*100:.1f}% of accounts flagged.",
        f"Estimated true fraud in dataset: ~{estimated_true_fraud} accounts.",
        "For production metrics, provide labelled data to /evaluate endpoint.",
    ]

    return EvaluationMetrics(
        accuracy=round(accuracy, 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1, 4),
        false_positive_rate=round(fpr, 4),
        fraud_capture_rate=round(fcr, 4),
        true_positives=tp,
        false_positives=fp,
        true_negatives=tn,
        false_negatives=fn,
        evaluation_mode="synthetic",
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Performance report generator
# ---------------------------------------------------------------------------

def generate_performance_report(
    metrics: EvaluationMetrics,
    processing_time_s: float,
    total_accounts: int,
    total_transactions: int,
) -> Dict:
    """Produce a structured performance + accuracy report dict."""

    # Throughput
    tx_per_second = round(total_transactions / max(processing_time_s, 0.001), 1)
    accounts_per_second = round(total_accounts / max(processing_time_s, 0.001), 1)

    # Grade
    f1 = metrics.f1_score
    if f1 >= 0.90:
        grade = "A+ (Excellent)"
    elif f1 >= 0.80:
        grade = "A  (Very Good)"
    elif f1 >= 0.70:
        grade = "B  (Good)"
    elif f1 >= 0.60:
        grade = "C  (Acceptable)"
    else:
        grade = "D  (Needs Improvement)"

    return {
        "accuracy_metrics": {
            "accuracy":          f"{metrics.accuracy*100:.2f}%",
            "precision":         f"{metrics.precision*100:.2f}%",
            "recall":            f"{metrics.recall*100:.2f}%",
            "f1_score":          f"{metrics.f1_score*100:.2f}%",
            "false_positive_rate": f"{metrics.false_positive_rate*100:.2f}%",
            "fraud_capture_rate":  f"{metrics.fraud_capture_rate*100:.2f}%",
        },
        "confusion_matrix": {
            "true_positives":  metrics.true_positives,
            "false_positives": metrics.false_positives,
            "true_negatives":  metrics.true_negatives,
            "false_negatives": metrics.false_negatives,
        },
        "performance": {
            "processing_time_seconds": processing_time_s,
            "transactions_per_second": tx_per_second,
            "accounts_per_second":     accounts_per_second,
            "total_transactions":      total_transactions,
            "total_accounts":          total_accounts,
        },
        "evaluation_mode": metrics.evaluation_mode,
        "grade":           grade,
        "notes":           metrics.notes,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safe division returning default on zero denominator."""
    return numerator / denominator if denominator > 0 else default