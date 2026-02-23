"""models_db.py – SQLAlchemy ORM models for analyses, accounts, rings, reports, reviews, rewards."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from database import Base


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# analyses
# ---------------------------------------------------------------------------


class Analysis(Base):
    """Summary row for one POST /analyze call; child rows hold per-account/ring detail."""

    __tablename__ = "analyses"

    # Composite descending index so ORDER BY created_at DESC LIMIT n
    # resolves via an index scan without sorting the full table.
    __table_args__ = (
        Index("ix_analyses_created_at_brin", "created_at"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=_now_utc,
        nullable=False,
    )
    total_accounts = Column(Integer, nullable=False)
    suspicious_flagged = Column(Integer, nullable=False)
    rings_detected = Column(Integer, nullable=False)
    processing_time = Column(Float, nullable=False)

    # lazy="raise" forces callers to use explicit eager-loading (selectinload /
    # joinedload).  Any accidental lazy access raises an exception at dev-time,
    # preventing silent N+1 queries from ever reaching production.
    accounts = relationship(
        "AccountRecord",
        back_populates="analysis",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    rings = relationship(
        "RingRecord",
        back_populates="analysis",
        cascade="all, delete-orphan",
        lazy="raise",
    )


# ---------------------------------------------------------------------------
# accounts
# ---------------------------------------------------------------------------


class AccountRecord(Base):
    """One suspicious account record produced by an analysis."""

    __tablename__ = "accounts"

    # Composite index covers: filter by analysis_id, sort by score descending
    # (used by admin_get_analysis and future "top N accounts" queries).
    # Also covers lookups by ring_id across analyses.
    __table_args__ = (
        Index("ix_accounts_analysis_score", "analysis_id", "suspicion_score"),
        Index("ix_accounts_ring_id_cover",  "ring_id", "analysis_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = Column(String(255), nullable=False, index=True)
    suspicion_score = Column(Float, nullable=False)
    detected_patterns = Column(ARRAY(String), nullable=False, default=list)
    ring_id = Column(String(255), nullable=True)

    # relationships
    analysis = relationship("Analysis", back_populates="accounts")


# ---------------------------------------------------------------------------
# rings
# ---------------------------------------------------------------------------


class RingRecord(Base):
    """One fraud ring identified by an analysis."""

    __tablename__ = "rings"

    # Composite index covers: filter by analysis_id + sort by risk descending.
    __table_args__ = (
        Index("ix_rings_analysis_risk", "analysis_id", "risk_score"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ring_id = Column(String(255), nullable=False, index=True)
    member_accounts = Column(ARRAY(String), nullable=False, default=list)
    pattern_type = Column(String(100), nullable=False)
    risk_score = Column(Float, nullable=False)

    # relationships
    analysis = relationship("Analysis", back_populates="rings")


# ---------------------------------------------------------------------------
# reports
# ---------------------------------------------------------------------------


class Report(Base):
    """Victim fraud report submitted via POST /report."""

    __tablename__ = "reports"

    # Composite index for status-filtered admin list views (e.g. "show pending").
    # Partial index would be ideal in raw SQL; SQLAlchemy composite is portable.
    __table_args__ = (
        Index("ix_reports_status_submitted", "status", "submitted_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    report_id = Column(String(50), nullable=False, unique=True, index=True)
    reporter_name = Column(String(255), nullable=True)
    reporter_contact = Column(String(255), nullable=True)
    suspect_account_id = Column(String(255), nullable=False, index=True)
    incident_description = Column(Text, nullable=False)
    incident_date = Column(String(20), nullable=True)
    status = Column(String(50), nullable=False, default="received")
    submitted_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # One-to-one optional reward (created when report is approved).
    # lazy="raise" prevents accidental SELECT on every Report load.
    reward = relationship(
        "Reward",
        back_populates="report",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="raise",
    )


# ---------------------------------------------------------------------------
# review_requests
# ---------------------------------------------------------------------------


class ReviewRequest(Base):
    """Second-chance dispute request submitted via POST /second-chance."""

    __tablename__ = "review_requests"

    # Composite index for admin list filtered by status.
    __table_args__ = (
        Index("ix_reviews_status_submitted", "status", "submitted_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    review_id = Column(String(50), nullable=False, unique=True, index=True)
    account_id = Column(String(255), nullable=False, index=True)
    requester_name = Column(String(255), nullable=False)
    requester_contact = Column(String(255), nullable=True)
    reason = Column(Text, nullable=False)
    supporting_evidence = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    submitted_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)
    review_deadline = Column(String(50), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# rewards
# ---------------------------------------------------------------------------


class Reward(Base):
    """Reward created when a report is approved. Amount assigned manually by compliance."""

    __tablename__ = "rewards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    report_id_fk = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    awarded_at = Column(DateTime(timezone=True), default=_now_utc, nullable=False)
    amount = Column(Float, nullable=True)          # None until manually assigned
    note = Column(Text, nullable=True)

    # relationships
    report = relationship("Report", back_populates="reward")
