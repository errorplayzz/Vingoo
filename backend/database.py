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
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

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

# Many PaaS providers (Neon, Supabase, Heroku …) supply a URL that starts with
# "postgres://" but SQLAlchemy 1.4+ requires "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

# Detect PgBouncer transaction-mode proxies (Neon pooled URLs use PgBouncer
# on port 6432).  In that mode the server recycles connections between
# requests, so prepared statements and connection-level settings don't
# survive – use NullPool + disable prepared statements.
# Set PGBOUNCER_MODE=1 in .env when using Neon's *pooled* connection string.
_PGBOUNCER_MODE: bool = os.getenv("PGBOUNCER_MODE", "0") == "1"

# SSL mode – Neon (and most cloud Postgres providers) require encrypted
# connections.  Override with DB_SSL_MODE=disable for local development.
_SSL_MODE: str = os.getenv("DB_SSL_MODE", "require")

# psycopg2 TCP keepalive settings prevent ghost connections after network
# blips (especially important on cloud PaaS with 5-min idle timeouts).
_KEEPALIVE_CONNECT_ARGS = {
    "connect_timeout": 10,
    "keepalives": 1,
    "keepalives_idle": 60,      # seconds before first keepalive probe
    "keepalives_interval": 10,  # seconds between probes
    "keepalives_count": 5,      # probes before declaring dead
    "sslmode": _SSL_MODE,       # "require" for Neon/cloud; "disable" for local
}

if _PGBOUNCER_MODE:
    # PgBouncer transaction mode: no persistent connections, no prepared stmts
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={**_KEEPALIVE_CONNECT_ARGS},
        echo=False,
        # Disable prepared-statement cache so psycopg2 never sends PREPARE
        execution_options={"postgresql_prepare_threshold": None},
    )
    print("[DB] PgBouncer/NullPool mode active.")
else:
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
        # TCP-level connect + keepalive settings
        connect_args={**_KEEPALIVE_CONNECT_ARGS},
        echo=False,
        # Use psycopg2's executemany_values fast path: sends all rows in a
        # single multi-row INSERT instead of one round-trip per row.
        # This is the biggest write-path win for bulk account/ring inserts.
        execution_options={"executemany_mode": "values_plus_batch"},
    )


# ---------------------------------------------------------------------------
# After-connect hook: set session-level planner parameters
# ---------------------------------------------------------------------------

@event.listens_for(engine, "connect")
def _set_session_options(dbapi_conn, _connection_record) -> None:  # noqa: ANN001
    """Apply PostgreSQL session settings on each new physical connection.

    work_mem controls the memory budget for sorting/hashing before spilling to
    disk. Raising it from the default (4 MB) to 16 MB avoids disk sorts on the
    ORDER BY created_at / submitted_at queries in admin endpoints.
    """
    with dbapi_conn.cursor() as cur:
        cur.execute("SET work_mem = '16MB'")
        cur.execute("SET synchronous_commit = 'local'")
        # Use index-only scans when statistics are fresh (default is on, just explicit)
        cur.execute("SET enable_seqscan = on")
        cur.execute("SET jit = off")  # JIT adds latency for OLTP queries < 10ms

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
