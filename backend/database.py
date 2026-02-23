"""
database.py – SQLAlchemy engine, session factory, and base model.

Reads DATABASE_URL from the environment (loaded from .env via python-dotenv).
Exposes:
  engine       – SQLAlchemy engine (psycopg2 driver, pool_pre_ping=True)
  SessionLocal – session factory
  Base         – declarative base (imported by models_db.py)
  get_db()     – FastAPI dependency that yields a DB session and closes it safely
  verify_connection() – called at startup to assert the DB is reachable
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Load .env before reading any environment variable
load_dotenv()

# ---------------------------------------------------------------------------
# Database URL
# ---------------------------------------------------------------------------

DATABASE_URL: str | None = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set.  "
        "Create a .env file with DATABASE_URL=postgresql://... or set it in your shell."
    )

# Supabase (and many PaaS providers) supply a URL that starts with
# "postgres://" but SQLAlchemy 1.4+ requires "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

engine = create_engine(
    DATABASE_URL,
    # Send a lightweight probe on each connection checkout to detect
    # stale connections before they cause mid-request failures.
    pool_pre_ping=True,
    # Keep a pool of 10 persistent connections; allow 20 additional overflow
    # connections under burst load.
    pool_size=10,
    max_overflow=20,
    # Recycle connections every 30 minutes to prevent stale/half-open TCP
    # sockets (especially important behind PgBouncer / cloud proxies).
    pool_recycle=1800,
    # Maximum seconds to wait for a connection from the pool before raising.
    pool_timeout=30,
    # Pass a TCP-level connect timeout so cold-start hangs fail fast.
    connect_args={"connect_timeout": 10},
    # Silence per-statement SQL echo (set to True for debugging).
    echo=False,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# ---------------------------------------------------------------------------
# Declarative base (shared by models_db.py)
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def get_db():
    """
    Yield a SQLAlchemy session and guarantee it is closed on exit.

    Usage in an endpoint::

        @app.get("/something")
        def read_something(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Startup probe
# ---------------------------------------------------------------------------


def verify_connection() -> bool:
    """
    Execute ``SELECT 1`` against the database.

    Returns True on success, False (with a printed error) on failure.
    Called once during application lifespan startup.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[DB ERROR] Could not connect to database: {exc}")
        return False
