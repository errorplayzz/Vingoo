"""main.py – FastAPI entry point for the Vingoo money-muling detection backend."""

from __future__ import annotations

import asyncio
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
import networkx as nx
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Install uvloop as the event-loop policy on Linux/macOS for ~2× throughput.
# Silently skipped on Windows (unsupported) or when uvloop is not installed.
# ---------------------------------------------------------------------------
if sys.platform != "win32":
    try:
        import uvloop  # type: ignore[import-untyped]
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        print("[PERF] uvloop event-loop policy active.")
    except ImportError:
        print("[PERF] uvloop not installed – using default event loop.")

# internal modules
from ai_explainer import generate_account_explanations, generate_ring_summaries
from database import Base, engine, get_db, SessionLocal, verify_connection
from detection import run_all_detections
from evaluation import evaluate_detections, generate_performance_report
from models import (
    AnalysisResponse,
    AnalysisSummary,
    EvaluationMetrics,
    SecondChanceAck,
    SecondChanceRequest,
    VictimReport,
    VictimReportAck,
)
from models_db import AccountRecord, Analysis, Report, ReviewRequest, Reward, RingRecord
from scoring import build_score_lookup, compute_ring_scores, compute_suspicion_scores
from utils import build_graph, parse_csv

# ---------------------------------------------------------------------------
# Application lifespan (replaces deprecated @app.on_event)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    """App startup/shutdown lifecycle."""
    # ------------------------------------------------------------------
    # Shared httpx.AsyncClient – one TCP connection pool for the whole
    # process; HTTP/2 multiplexing reduces per-request overhead.
    # ------------------------------------------------------------------
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0),
        http2=True,
        limits=httpx.Limits(
            max_connections=40,
            max_keepalive_connections=20,
            keepalive_expiry=30,
        ),
    )
    # Wire into ai_explainer so all AI calls share this pool
    import ai_explainer as _ai_mod
    _ai_mod._http_client = http_client
    print("[PERF] Shared httpx.AsyncClient initialised (HTTP/2, pool=40).")

    # idempotent — safe on restart
    try:
        Base.metadata.create_all(bind=engine)
        print("[DB] Tables created / verified.")
    except Exception as exc:  # noqa: BLE001
        print(f"[DB ERROR] Could not create tables: {exc}")

    if verify_connection():
        print("[DB] Database connected successfully.")
    else:
        # DB down at boot — keep serving without persistence
        print("[DB WARNING] Database is unreachable - persistence will be skipped.")

    print("[OK] Money Muling Detection System started - ready to accept requests.")
    yield

    # ------------------------------------------------------------------
    # Graceful shutdown: drain in-flight keep-alive sockets
    # ------------------------------------------------------------------
    await http_client.aclose()
    print("[PERF] httpx.AsyncClient closed.")
    print("[--] Money Muling Detection System shutting down.")


# ---------------------------------------------------------------------------
# Application setup
# ---------------------------------------------------------------------------

app = FastAPI(
    lifespan=lifespan,
    title="Money Muling Detection System",
    description=(
        "Graph-Based Financial Crime Detection Engine – RIFT 2026 Hackathon.\n\n"
        "Upload a financial transaction CSV and receive structured fraud-intelligence "
        "identifying suspicious accounts, fraud rings, and pattern explanations."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow the Vite dev server and any production origin
# Set ALLOWED_ORIGINS env var on Render/Vercel as a comma-separated list, e.g.:
#   https://your-app.vercel.app,http://localhost:5173
# ---------------------------------------------------------------------------

_default_origins = (
    "http://localhost:5173,"
    "http://localhost:5174,"
    "http://localhost:5175,"
    "http://localhost:5176,"
    "http://localhost:5177,"
    "http://localhost:5178,"
    "http://localhost:5179,"
    "http://localhost:5180,"
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:5174,"
    "http://127.0.0.1:5175,"
    "http://127.0.0.1:5176,"
    "http://127.0.0.1:5177"
)
_raw_origins = os.getenv("ALLOWED_ORIGINS", _default_origins)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory state (acceptable for a hackathon / demo context)
# ---------------------------------------------------------------------------

# Stores the most recently computed analysis result for GET /export
_latest_analysis: Optional[Dict[str, Any]] = None

# Victim reports submitted via POST /report
_victim_reports: List[Dict[str, Any]] = []

# Second-chance dispute reviews submitted via POST /second-chance
_second_chance_reviews: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Endpoint: GET /health
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    summary="Health check",
    tags=["Operations"],
)
async def health_check() -> JSONResponse:
    """Liveness probe."""
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "Money Muling Detection System",
            "version": "1.0.0",
        }
    )


# ---------------------------------------------------------------------------
# Endpoint: POST /analyze
# ---------------------------------------------------------------------------

@app.post(
    "/analyze",
    response_model=AnalysisResponse,
    summary="Upload transaction CSV and detect fraud patterns",
    tags=["Detection"],
)
async def analyze(
    file: UploadFile = File(..., description="CSV file with transaction data"),
) -> AnalysisResponse:
    """Upload a CSV, run detection pipeline, return full fraud report."""
    t_start = time.perf_counter()

    # MIME type not enforced — parse_csv handles structural validation
    try:
        contents = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {exc}",
        ) from exc

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        transactions, validation_report = parse_csv(contents)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    if not transactions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV contains no valid transactions after parsing.",
        )

    total_transactions = len(transactions)

    # build graph
    G = build_graph(transactions)

    total_accounts = G.number_of_nodes()

    # run detections
    detection_result = run_all_detections(G)

    account_patterns: Dict[str, List[str]] = detection_result["account_patterns"]
    rings: List[Dict] = detection_result["rings"]
    account_ring_map: Dict[str, str] = detection_result["account_ring_map"]
    high_volume: set = detection_result["high_volume_accounts"]

    # score accounts
    suspicious_accounts = compute_suspicion_scores(
        G=G,
        account_patterns=account_patterns,
        account_ring_map=account_ring_map,
        high_volume_accounts=high_volume,
    )

    score_lookup = build_score_lookup(suspicious_accounts)

    # score rings (pass G for amount circulation calculation)
    fraud_rings = compute_ring_scores(rings, score_lookup, G=G)

    t_end = time.perf_counter()
    processing_time = round(t_end - t_start, 4)

    # Compute enhanced summary stats
    high_risk_count = sum(
        1 for sa in suspicious_accounts if sa.risk_tier in ("CRITICAL", "HIGH")
    )
    total_suspicious_amount = sum(
        sa.total_sent + sa.total_received for sa in suspicious_accounts
    )
    graph_density = round(
        nx.density(G) if G.number_of_nodes() > 1 else 0.0, 6
    )
    detection_coverage = round(
        G.number_of_nodes() / max(total_transactions, 1) * 100, 2
    )

    # assemble response
    summary = AnalysisSummary(
        total_accounts_analyzed=total_accounts,
        suspicious_accounts_flagged=len(suspicious_accounts),
        fraud_rings_detected=len(fraud_rings),
        processing_time_seconds=processing_time,
        total_transactions=total_transactions,
        high_risk_accounts=high_risk_count,
        total_suspicious_amount=round(total_suspicious_amount, 2),
        detection_coverage=detection_coverage,
        graph_density=graph_density,
    )

    response = AnalysisResponse(
        suspicious_accounts=suspicious_accounts,
        fraud_rings=fraud_rings,
        summary=summary,
        validation_report=validation_report,
    )

    # AI layer — both calls concurrent, failures don't block detection results
    acct_ai, ring_ai = await asyncio.gather(
        generate_account_explanations(suspicious_accounts),
        generate_ring_summaries(fraud_rings),
    )
    ai_overall_status = (
        "active"
        if acct_ai["ai_status"] == "active" and ring_ai["ai_status"] == "active"
        else "unavailable"
    )
    response = response.model_copy(update={
        "ai_explanations": acct_ai["explanations"],
        "ring_summaries":  ring_ai["summaries"],
        "ai_status":       ai_overall_status,
    })
    print(f"[AI] Status: {ai_overall_status} | accounts explained: {len(acct_ai['explanations'])} | rings summarised: {len(ring_ai['summaries'])}")

    # cache for /export
    global _latest_analysis
    _latest_analysis = response.model_dump()

    # persist — best-effort; wrapped in a thread so the event loop stays free
    def _do_persist() -> None:
        db: Session = SessionLocal()
        try:
            db_analysis = Analysis(
                total_accounts=summary.total_accounts_analyzed,
                suspicious_flagged=summary.suspicious_accounts_flagged,
                rings_detected=summary.fraud_rings_detected,
                processing_time=summary.processing_time_seconds,
            )
            db.add(db_analysis)
            db.flush()  # get id before writing child rows

            for acc in suspicious_accounts:
                db.add(AccountRecord(
                    analysis_id=db_analysis.id,
                    account_id=acc.account_id,
                    suspicion_score=acc.suspicion_score,
                    detected_patterns=acc.detected_patterns,
                    ring_id=acc.ring_id,
                ))

            for ring in fraud_rings:
                db.add(RingRecord(
                    analysis_id=db_analysis.id,
                    ring_id=ring.ring_id,
                    member_accounts=ring.member_accounts,
                    pattern_type=ring.pattern_type,
                    risk_score=ring.risk_score,
                ))

            db.commit()
            print(f"[DB] Analysis {db_analysis.id} persisted ({len(suspicious_accounts)} accounts, {len(fraud_rings)} rings).")
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            print(f"[DB ERROR] Failed to persist analysis: {exc}")
        finally:
            db.close()

    await asyncio.to_thread(_do_persist)

    return response


# ---------------------------------------------------------------------------
# Endpoint: POST /report
# ---------------------------------------------------------------------------

@app.post(
    "/report",
    response_model=VictimReportAck,
    summary="Submit a victim fraud report",
    tags=["Reports"],
    status_code=status.HTTP_201_CREATED,
)
async def submit_report(report: VictimReport) -> VictimReportAck:
    """Accept fraud report, assign a UUID, persist to DB."""
    report_id = f"RPT-{uuid.uuid4().hex[:10].upper()}"

    _victim_reports.append(
        {
            "report_id": report_id,
            **report.model_dump(),
        }
    )

    def _do_persist_report() -> None:
        db: Session = SessionLocal()
        try:
            db.add(Report(
                report_id=report_id,
                reporter_name=report.reporter_name,
                reporter_contact=report.reporter_contact,
                suspect_account_id=report.suspect_account_id,
                incident_description=report.incident_description,
                incident_date=report.incident_date,
                status="received",
            ))
            db.commit()
            print(f"[DB] Report {report_id} persisted.")
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            print(f"[DB ERROR] Failed to persist report {report_id}: {exc}")
        finally:
            db.close()

    await asyncio.to_thread(_do_persist_report)

    return VictimReportAck(
        status="received",
        report_id=report_id,
        message=(
            "Your report has been received and will be reviewed by our team. "
            f"Reference ID: {report_id}"
        ),
    )


# ---------------------------------------------------------------------------
# Endpoint: GET /export
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Endpoint: GET /evaluate
# ---------------------------------------------------------------------------

@app.get(
    "/evaluate",
    summary="Get accuracy metrics for the latest analysis",
    tags=["Detection"],
)
async def evaluate_latest() -> JSONResponse:
    """Run accuracy evaluation on the latest analysis results.
    Uses synthetic label generation when no ground truth is available."""
    if _latest_analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis available yet. Run POST /analyze first.",
        )

    suspicious = _latest_analysis.get("suspicious_accounts", [])
    total_accounts = _latest_analysis.get("summary", {}).get("total_accounts_analyzed", 0)
    total_transactions = _latest_analysis.get("summary", {}).get("total_transactions", 0)
    processing_time = _latest_analysis.get("summary", {}).get("processing_time_seconds", 0.0)

    # Reconstruct minimal SuspiciousAccount objects for evaluation
    from models import SuspiciousAccount as SA
    sa_list = [
        SA(
            account_id=a["account_id"],
            suspicion_score=a.get("suspicion_score", 0.0),
            confidence_score=a.get("confidence_score", 0.0),
            risk_tier=a.get("risk_tier", "LOW"),
            detected_patterns=a.get("detected_patterns", []),
        )
        for a in suspicious
    ]

    metrics = evaluate_detections(sa_list, total_accounts)
    report = generate_performance_report(metrics, processing_time, total_accounts, total_transactions)
    return JSONResponse(content=report)


@app.get(
    "/export",
    summary="Export latest fraud-intelligence JSON",
    tags=["Detection"],
)
async def export_latest() -> JSONResponse:
    """Return the last analysis result. 404 if none run yet."""
    if _latest_analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No analysis results available yet.  "
                "Please call POST /analyze first."
            ),
        )
    return JSONResponse(content=_latest_analysis)


# ---------------------------------------------------------------------------
# Endpoint: POST /second-chance
# ---------------------------------------------------------------------------

@app.post(
    "/second-chance",
    response_model=SecondChanceAck,
    summary="Dispute a fraud flag within the 24-hour correction window",
    tags=["Reviews"],
    status_code=status.HTTP_201_CREATED,
)
async def second_chance(request: SecondChanceRequest) -> SecondChanceAck:
    """Accept a flag dispute, assign a review ID, set 24h deadline."""
    review_id = f"REV-{uuid.uuid4().hex[:10].upper()}"
    now = datetime.now(tz=timezone.utc)
    deadline = now + timedelta(hours=24)
    deadline_str = deadline.strftime("%Y-%m-%d %H:%M:%S UTC")

    _second_chance_reviews.append(
        {
            "review_id": review_id,
            "account_id": request.account_id,
            "requester_name": request.requester_name,
            "requester_contact": request.requester_contact,
            "reason": request.reason,
            "supporting_evidence": request.supporting_evidence,
            "status": "pending",
            "submitted_at": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "review_deadline": deadline_str,
        }
    )

    def _do_persist_review() -> None:
        db: Session = SessionLocal()
        try:
            db.add(ReviewRequest(
                review_id=review_id,
                account_id=request.account_id,
                requester_name=request.requester_name,
                requester_contact=request.requester_contact,
                reason=request.reason,
                supporting_evidence=request.supporting_evidence,
                status="pending",
                submitted_at=now,
                review_deadline=deadline_str,
            ))
            db.commit()
            print(f"[DB] Review request {review_id} persisted.")
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            print(f"[DB ERROR] Failed to persist review {review_id}: {exc}")
        finally:
            db.close()

    await asyncio.to_thread(_do_persist_review)

    return SecondChanceAck(
        review_id=review_id,
        account_id=request.account_id,
        status="pending",
        review_deadline=deadline_str,
        message=(
            f"Your dispute for account {request.account_id!r} has been received. "
            f"A compliance officer will review it before {deadline_str}. "
            f"Reference ID: {review_id}"
        ),
    )


# ---------------------------------------------------------------------------
# Endpoint: GET /legal-info
# ---------------------------------------------------------------------------

@app.get(
    "/legal-info",
    summary="Legal awareness guidance for fraud victims and reported accounts",
    tags=["Legal"],
)
async def legal_info() -> JSONResponse:
    """Return structured legal awareness guidance (not legal advice)."""
    return JSONResponse(
        content={
            "disclaimer": (
                "This information is for general awareness only and does NOT "
                "constitute legal advice.  Consult a qualified lawyer for "
                "advice specific to your situation."
            ),
            "what_is_money_muling": {
                "definition": (
                    "Money muling is the act of transferring illegally obtained "
                    "money on behalf of or at the direction of another person, "
                    "knowingly or unknowingly."
                ),
                "legal_status": (
                    "Money muling is a criminal offence under the Anti-Money "
                    "Laundering, Anti-Terrorism Financing and Proceeds of "
                    "Unlawful Activities Act 2001 (AMLA) in Malaysia, and "
                    "equivalent statutes in most jurisdictions."
                ),
                "penalties": (
                    "Conviction may result in imprisonment of up to 15 years "
                    "and/or a fine of up to RM 5 million under AMLA Section 4."
                ),
            },
            "rights_of_flagged_account": [
                "You have the right to dispute a fraud flag via POST /second-chance "
                "within 24 hours of notification.",
                "You have the right to request a written statement of the grounds "
                "for the flag from the reporting institution.",
                "You have the right to legal representation throughout any "
                "investigation or prosecution process.",
                "Flags are preliminary algorithmic assessments, not legal findings. "
                "You are presumed innocent until proven otherwise.",
            ],
            "how_to_report_financial_crime": {
                "Malaysia": {
                    "Bank Negara Malaysia (BNM)": "bnmtelelink@bnm.gov.my | 1-300-88-5465",
                    "Royal Malaysia Police (PDRM) Commercial Crime": "www.rmp.gov.my",
                    "RIFT Hackathon Fraud Portal": "POST /report on this API",
                }
            },
            "legal_resources": [
                "Malaysian Bar Council referral service: www.malaysianbar.org.my",
                "Legal Aid Bureau (Jabatan Bantuan Guaman): www.jbg.gov.my",
                "Bank Negara Malaysia LINK financial consumer hotline: 1-300-88-5465",
            ],
        }
    )


# ---------------------------------------------------------------------------
# Admin / Investigator endpoints
# ---------------------------------------------------------------------------
# Direct DB queries for compliance officers. Auth guard omitted (demo scope).


# ---------------------------------------------------------------------------
# GET /admin/analyses
# ---------------------------------------------------------------------------

@app.get(
    "/admin/analyses",
    summary="List all stored analyses",
    tags=["Admin"],
)
def admin_list_analyses(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Paginated list of past analyses, newest first."""
    rows = (
        db.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return JSONResponse(
        content=[
            {
                "id": str(r.id),
                "created_at": r.created_at.isoformat(),
                "total_accounts": r.total_accounts,
                "suspicious_flagged": r.suspicious_flagged,
                "rings_detected": r.rings_detected,
                "processing_time": r.processing_time,
            }
            for r in rows
        ]
    )


# ---------------------------------------------------------------------------
# GET /admin/analysis/{analysis_id}
# ---------------------------------------------------------------------------

@app.get(
    "/admin/analysis/{analysis_id}",
    summary="Full detail for a single analysis",
    tags=["Admin"],
)
def admin_get_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Full detail for one analysis including accounts and rings."""
    row = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    return JSONResponse(
        content={
            "id": str(row.id),
            "created_at": row.created_at.isoformat(),
            "total_accounts": row.total_accounts,
            "suspicious_flagged": row.suspicious_flagged,
            "rings_detected": row.rings_detected,
            "processing_time": row.processing_time,
            "accounts": [
                {
                    "account_id": a.account_id,
                    "suspicion_score": a.suspicion_score,
                    "detected_patterns": a.detected_patterns,
                    "ring_id": a.ring_id,
                }
                for a in row.accounts
            ],
            "rings": [
                {
                    "ring_id": r.ring_id,
                    "member_accounts": r.member_accounts,
                    "pattern_type": r.pattern_type,
                    "risk_score": r.risk_score,
                }
                for r in row.rings
            ],
        }
    )


# ---------------------------------------------------------------------------
# GET /admin/reports
# ---------------------------------------------------------------------------

@app.get(
    "/admin/reports",
    summary="List all victim reports",
    tags=["Admin"],
)
def admin_list_reports(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Return a paginated list of victim reports (most recent first)."""
    rows = (
        db.query(Report)
        .order_by(Report.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return JSONResponse(
        content=[
            {
                "id": str(r.id),
                "report_id": r.report_id,
                "reporter_name": r.reporter_name,
                "reporter_contact": r.reporter_contact,
                "suspect_account_id": r.suspect_account_id,
                "incident_description": r.incident_description,
                "incident_date": r.incident_date,
                "status": r.status,
                "submitted_at": r.submitted_at.isoformat(),
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in rows
        ]
    )


# ---------------------------------------------------------------------------
# POST /admin/reports/{id}/approve
# ---------------------------------------------------------------------------

@app.post(
    "/admin/reports/{report_id}/approve",
    summary="Approve a victim report and create a reward entry",
    tags=["Admin"],
    status_code=status.HTTP_200_OK,
)
def admin_approve_report(
    report_id: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Approve report and create a reward entry."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report {report_id!r} not found.")
    if report.status == "approved":
        raise HTTPException(status_code=400, detail="Report is already approved.")

    report.status = "approved"
    report.reviewed_at = datetime.now(tz=timezone.utc)

    if report.reward is None:
        db.add(Reward(report_id_fk=report.id, note="Pending amount assignment"))

    try:
        db.commit()
        db.refresh(report)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {exc}") from exc

    return JSONResponse(
        content={
            "report_id": report_id,
            "status": report.status,
            "reviewed_at": report.reviewed_at.isoformat(),
            "reward_created": True,
        }
    )


# ---------------------------------------------------------------------------
# POST /admin/reports/{id}/reject
# ---------------------------------------------------------------------------

@app.post(
    "/admin/reports/{report_id}/reject",
    summary="Reject a victim report",
    tags=["Admin"],
    status_code=status.HTTP_200_OK,
)
def admin_reject_report(
    report_id: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Set report.status = 'rejected'."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report {report_id!r} not found.")
    if report.status in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail=f"Report is already {report.status}.")

    report.status = "rejected"
    report.reviewed_at = datetime.now(tz=timezone.utc)

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {exc}") from exc

    return JSONResponse(content={"report_id": report_id, "status": "rejected"})


# ---------------------------------------------------------------------------
# GET /admin/reviews
# ---------------------------------------------------------------------------

@app.get(
    "/admin/reviews",
    summary="List all second-chance review requests",
    tags=["Admin"],
)
def admin_list_reviews(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Return a paginated list of second-chance review requests (most recent first)."""
    rows = (
        db.query(ReviewRequest)
        .order_by(ReviewRequest.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return JSONResponse(
        content=[
            {
                "id": str(r.id),
                "review_id": r.review_id,
                "account_id": r.account_id,
                "requester_name": r.requester_name,
                "requester_contact": r.requester_contact,
                "reason": r.reason,
                "supporting_evidence": r.supporting_evidence,
                "status": r.status,
                "submitted_at": r.submitted_at.isoformat(),
                "review_deadline": r.review_deadline,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in rows
        ]
    )


# ---------------------------------------------------------------------------
# POST /admin/review/{id}/approve
# ---------------------------------------------------------------------------

@app.post(
    "/admin/review/{review_id}/approve",
    summary="Approve a second-chance review request",
    tags=["Admin"],
    status_code=status.HTTP_200_OK,
)
def admin_approve_review(
    review_id: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Set review_request.status = 'approved'."""
    rev = db.query(ReviewRequest).filter(ReviewRequest.review_id == review_id).first()
    if rev is None:
        raise HTTPException(status_code=404, detail=f"Review {review_id!r} not found.")
    if rev.status != "pending":
        raise HTTPException(status_code=400, detail=f"Review is already {rev.status}.")

    rev.status = "approved"
    rev.reviewed_at = datetime.now(tz=timezone.utc)

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {exc}") from exc

    return JSONResponse(content={"review_id": review_id, "status": "approved"})


# ---------------------------------------------------------------------------
# POST /admin/review/{id}/reject
# ---------------------------------------------------------------------------

@app.post(
    "/admin/review/{review_id}/reject",
    summary="Reject a second-chance review request",
    tags=["Admin"],
    status_code=status.HTTP_200_OK,
)
def admin_reject_review(
    review_id: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Set review_request.status = 'rejected'."""
    rev = db.query(ReviewRequest).filter(ReviewRequest.review_id == review_id).first()
    if rev is None:
        raise HTTPException(status_code=404, detail=f"Review {review_id!r} not found.")
    if rev.status != "pending":
        raise HTTPException(status_code=400, detail=f"Review is already {rev.status}.")

    rev.status = "rejected"
    rev.reviewed_at = datetime.now(tz=timezone.utc)

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {exc}") from exc

    return JSONResponse(content={"review_id": review_id, "status": "rejected"})
