"""models.py – Pydantic v2 request/response models for the detection API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Input / graph primitives
# ---------------------------------------------------------------------------

class Transaction(BaseModel):
    """Represents a single financial transaction row parsed from the uploaded CSV."""

    transaction_id: str = Field(..., description="Unique identifier for the transaction")
    sender_id: str = Field(..., description="Account ID of the sending party")
    receiver_id: str = Field(..., description="Account ID of the receiving party")
    amount: float = Field(..., gt=0, description="Transaction amount (must be positive)")
    timestamp: str = Field(..., description="Timestamp in YYYY-MM-DD HH:MM:SS format")

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_format(cls, v: str) -> str:
        from datetime import datetime
        # Accept multiple formats – normalise to canonical string
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M",
                    "%d/%m/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(v, fmt)
                return parsed.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
        raise ValueError(
            f"Unrecognised timestamp format: {v!r}. "
            "Expected YYYY-MM-DD HH:MM:SS or ISO 8601."
        )


# ---------------------------------------------------------------------------
# Validation report (returned in analysis response for transparency)
# ---------------------------------------------------------------------------

class ValidationReport(BaseModel):
    """Summary of pre-processing decisions made on the uploaded CSV."""

    total_rows_received: int = 0
    valid_rows_used: int = 0
    duplicate_rows_dropped: int = 0
    self_transfer_rows_dropped: int = 0
    bad_timestamp_rows_dropped: int = 0
    negative_amount_rows_dropped: int = 0
    outlier_amounts_capped: int = 0
    warnings: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Detection output models
# ---------------------------------------------------------------------------

class SuspiciousAccount(BaseModel):
    """Per-account suspicion record returned in the analysis response."""

    account_id: str = Field(..., description="The account flagged as suspicious")
    suspicion_score: float = Field(
        ..., ge=0.0, le=100.0, description="Composite suspicion score in [0, 100]"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=100.0,
        description="Confidence in the detection: evidence breadth x depth"
    )
    risk_tier: str = Field(
        default="LOW",
        description="Risk classification: CRITICAL / HIGH / MEDIUM / LOW"
    )
    detected_patterns: List[str] = Field(
        default_factory=list,
        description="Pattern labels that contributed to the score"
    )
    behavioral_score: float = Field(
        default=0.0, ge=0.0, le=100.0,
        description="Score from behavioural patterns (cycles, smurfing, etc.)"
    )
    graph_score: float = Field(
        default=0.0, ge=0.0, le=100.0,
        description="Score from graph topology (centrality, flow imbalance)"
    )
    temporal_score: float = Field(
        default=0.0, ge=0.0, le=100.0,
        description="Score from temporal anomalies (velocity, round-trips)"
    )
    amount_score: float = Field(
        default=0.0, ge=0.0, le=100.0,
        description="Score from amount-based anomalies (structuring, outliers)"
    )
    total_sent: float = Field(default=0.0, description="Total amount sent by this account")
    total_received: float = Field(default=0.0, description="Total amount received by this account")
    transaction_count: int = Field(default=0, description="Total transaction count")
    ring_id: Optional[str] = Field(
        None, description="Fraud ring ID this account belongs to (None if no ring)"
    )
    investigation_priority: int = Field(
        default=3,
        description="1=Immediate action, 2=High priority, 3=Review, 4=Monitor"
    )
    explanation: Optional[str] = Field(
        None, description="Human-readable explanation of why flagged"
    )


class FraudRing(BaseModel):
    """Describes a cohesive fraud ring discovered during analysis."""

    ring_id: str = Field(..., description="Unique identifier for this fraud ring")
    member_accounts: List[str] = Field(
        ..., description="All account IDs that belong to this ring"
    )
    pattern_type: str = Field(
        ..., description="Primary pattern: 'cycle', 'smurfing', 'shell', 'mixed'"
    )
    risk_score: float = Field(
        ..., ge=0.0, le=100.0, description="Aggregate risk score for the ring"
    )
    total_amount_circulated: float = Field(
        default=0.0, description="Total transaction amount among ring members"
    )
    cycle_count: int = Field(default=0, description="Number of distinct cycles in the ring")
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=100.0, description="Ring-level detection confidence"
    )


class AnalysisSummary(BaseModel):
    """High-level statistics returned at the end of an analysis response."""

    total_accounts_analyzed: int = Field(
        ..., description="Total number of unique accounts"
    )
    suspicious_accounts_flagged: int = Field(
        ..., description="Accounts with suspicion_score > 0"
    )
    fraud_rings_detected: int = Field(
        ..., description="Number of distinct fraud rings"
    )
    processing_time_seconds: float = Field(
        ..., description="Wall-clock analysis time in seconds"
    )
    total_transactions: int = Field(
        default=0, description="Total transactions parsed from CSV"
    )
    high_risk_accounts: int = Field(
        default=0, description="Accounts classified as CRITICAL or HIGH risk"
    )
    total_suspicious_amount: float = Field(
        default=0.0, description="Sum of amounts involving suspicious accounts"
    )
    detection_coverage: float = Field(
        default=0.0,
        description="Percentage of accounts that were fully evaluated"
    )
    graph_density: float = Field(
        default=0.0, description="Graph edge density (edges / possible edges)"
    )
    ml_active: bool = Field(
        default=False,
        description="True when the IsolationForest anomaly layer ran successfully"
    )


class AnalysisResponse(BaseModel):
    """Root response envelope for POST /analyze."""

    analysis_id: Optional[str] = Field(
        None,
        description="Stable UUID for this analysis — used by /investigation/:id route",
    )
    suspicious_accounts: List[SuspiciousAccount] = Field(
        default_factory=list,
        description="Suspicious accounts sorted descending by suspicion_score"
    )
    fraud_rings: List[FraudRing] = Field(
        default_factory=list, description="All detected fraud rings"
    )
    summary: AnalysisSummary
    validation_report: Optional[ValidationReport] = Field(
        None, description="Pre-processing validation results"
    )
    ai_explanations: Optional[List[Dict[str, Any]]] = Field(
        None, description="Per-account AI explanations (top accounts)"
    )
    ring_summaries: Optional[List[Dict[str, Any]]] = Field(
        None, description="Law-enforcement-ready ring investigation summaries"
    )
    ai_status: Optional[str] = Field(
        None, description="'active' | 'unavailable'"
    )
    ml_diagnostics: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "IsolationForest layer diagnostics: training/prediction latency, "
            "average score boost, and whether ML was active for this batch."
        ),
    )


# ---------------------------------------------------------------------------
# Evaluation metrics model
# ---------------------------------------------------------------------------

class EvaluationMetrics(BaseModel):
    """Precision / recall / F1 and related metrics from evaluation engine."""

    accuracy: float = Field(..., description="Overall accuracy [0,1]")
    precision: float = Field(..., description="Positive predictive value [0,1]")
    recall: float = Field(..., description="True positive rate [0,1]")
    f1_score: float = Field(..., description="Harmonic mean of precision + recall [0,1]")
    false_positive_rate: float = Field(..., description="FPR = FP / (FP + TN)")
    fraud_capture_rate: float = Field(..., description="FCR = TP / total fraud [0,1]")
    true_positives: int = 0
    false_positives: int = 0
    true_negatives: int = 0
    false_negatives: int = 0
    evaluation_mode: str = Field(
        default="synthetic",
        description="'ground_truth' when labels provided, else 'synthetic'"
    )
    notes: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Victim report models
# ---------------------------------------------------------------------------

class VictimReport(BaseModel):
    reporter_name: str
    reporter_contact: str
    suspect_account_id: str
    incident_description: str
    incident_date: Optional[str] = None


class VictimReportAck(BaseModel):
    status: str = "received"
    report_id: str
    message: str = "Your report has been received and will be reviewed by our team."


class SecondChanceRequest(BaseModel):
    account_id: str
    requester_name: str
    requester_contact: str
    reason: str
    supporting_evidence: Optional[str] = None


class SecondChanceAck(BaseModel):
    review_id: str
    account_id: str
    status: str = "pending"
    review_deadline: str
    message: str = (
        "Your dispute has been received.  A compliance officer will review it "
        "within 24 hours.  Reference your review_id for updates."
    )