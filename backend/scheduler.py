"""scheduler.py – APScheduler wiring for periodic IsolationForest retraining.

The BackgroundScheduler runs entirely in a daemon thread — it never touches
the event loop and therefore never blocks API requests.

Usage (from main.py lifespan):

    from scheduler import start_scheduler, stop_scheduler

    # startup:
    start_scheduler(SessionLocal)

    # shutdown:
    stop_scheduler()

Interval: every 30 minutes (RETRAIN_INTERVAL_MINUTES).
Job: ml_model.scheduled_retrain(db_session_factory)
"""

from __future__ import annotations

import logging
from typing import Callable, Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# APScheduler – optional dependency; degrades gracefully if not installed
# ---------------------------------------------------------------------------

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    _APSCHEDULER_AVAILABLE = True
except ImportError:
    _APSCHEDULER_AVAILABLE = False
    log.warning(
        "[Scheduler] APScheduler not installed – periodic ML retraining disabled. "
        "Install with: pip install apscheduler>=3.10.0"
    )

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RETRAIN_INTERVAL_MINUTES: int = 30

# ---------------------------------------------------------------------------
# Module-level scheduler instance (one per process)
# ---------------------------------------------------------------------------

_scheduler: Optional["BackgroundScheduler"] = None  # type: ignore[name-defined]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def start_scheduler(session_local: Callable) -> None:
    """Create and start the APScheduler background scheduler.

    Parameters
    ----------
    session_local:
        SQLAlchemy ``SessionLocal`` factory (a bound ``sessionmaker`` instance).
        Passed directly into ``scheduled_retrain`` so it can open a fresh DB
        session without touching the async ORM session owned by the request handler.

    Notes
    -----
    * ``daemon=True`` ensures the thread is killed automatically when the main
      process exits, even if ``stop_scheduler()`` is not called.
    * ``coalesce=True`` collapses multiple missed firings into one catch-up run.
    * ``max_instances=1`` prevents a new retrain from starting while one is
      already running (e.g., if training stalls on a very large dataset).
    * ``misfire_grace_time=60`` allows a run that missed its window by up to
      60 seconds (e.g., server was briefly overloaded) to still execute once.
    """
    global _scheduler

    if not _APSCHEDULER_AVAILABLE:
        print("[Scheduler] APScheduler unavailable – skipping scheduler startup.")
        return

    # Lazy import to avoid circular dependency at module load time
    from ml_model import scheduled_retrain

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        func=scheduled_retrain,
        trigger=IntervalTrigger(minutes=RETRAIN_INTERVAL_MINUTES),
        args=[session_local],
        id="ml_retrain",
        name="IsolationForest periodic retrain",
        misfire_grace_time=60,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.start()

    log.info(
        "[Scheduler] Background scheduler started – IsolationForest retrain every %d min.",
        RETRAIN_INTERVAL_MINUTES,
    )
    print(
        f"[Scheduler] APScheduler started – "
        f"IsolationForest retrain every {RETRAIN_INTERVAL_MINUTES} min."
    )


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler.

    Called from the FastAPI lifespan exit block.  ``wait=False`` means we
    do not block shutdown waiting for a retrain job to finish; the daemon
    thread is cleaned up by the OS.
    """
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("[Scheduler] Background scheduler stopped.")
        print("[Scheduler] APScheduler stopped.")

    _scheduler = None


def get_scheduler_status() -> dict:
    """Return a dict with scheduler health info (used by /health or /admin)."""
    if not _APSCHEDULER_AVAILABLE:
        return {"available": False, "running": False}

    if _scheduler is None:
        return {"available": True, "running": False}

    jobs = _scheduler.get_jobs()
    job_info = []
    for job in jobs:
        job_info.append({
            "id":       job.id,
            "name":     job.name,
            "next_run": str(job.next_run_time) if job.next_run_time else None,
        })

    return {
        "available": True,
        "running":   _scheduler.running,
        "jobs":      job_info,
    }
