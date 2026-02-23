"""cache.py – Redis-backed distributed cache for the Vingoo detection backend.

Design principles
-----------------
1. **Graceful degradation**: every public function catches Redis errors and returns
   a safe default (None / False).  If Redis is unreachable the app continues to
   work; it just loses caching benefits.

2. **Multi-worker safe**: all state lives in Redis, not in process memory, so any
   number of Uvicorn workers (or Gunicorn processes) share the same view.

3. **Additive only**: this module is imported by main.py but requires no changes to
   models, database, or detection logic.

Key namespace
-------------
    vingoo:latest_analysis           – most recent /analyze result (serialised JSON)
    vingoo:graph_metrics:{csv_hash}  – lightweight graph stats for a given CSV upload
    vingoo:admin_analysis:{uuid}     – cached /admin/analysis/{id} response
    vingoo:recent_reports            – Redis list (LPUSH, bounded) of submitted reports
    vingoo:recent_reviews            – Redis list (LPUSH, bounded) of review requests

TTL strategy
------------
    ANALYSIS_TTL      = 7 200 s  (2 h)   – matches a typical session / tab lifetime
    GRAPH_METRICS_TTL = 1 800 s  (30 min) – re-upload of same CSV refreshes anyway
    ADMIN_DETAIL_TTL  =   300 s  (5 min)  – admin views are low-frequency reads
    REPORT_LIST_TTL   = 3 600 s  (1 h)   – bounded list of recent submissions
    REVIEW_LIST_TTL   = 3 600 s  (1 h)   – same

Environment variable
--------------------
    REDIS_URL  –  Redis connection string, e.g.
                  redis://localhost:6379/0
                  rediss://:<password>@redis-1234.upstash.io:6379  (TLS)
    Defaults to redis://localhost:6379/0 when unset.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy import — redis[hiredis] is optional at import time so the app can start
# without Redis installed (it will just log a warning and skip caching).
# ---------------------------------------------------------------------------
try:
    import redis.asyncio as aioredis  # type: ignore[import-untyped]
    _REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False
    log.warning("[CACHE] redis package not installed – caching disabled.")

# ---------------------------------------------------------------------------
# TTL constants (seconds)
# ---------------------------------------------------------------------------
TTL_ANALYSIS: int      = 7_200   # 2 hours
TTL_GRAPH_METRICS: int = 1_800   # 30 minutes
TTL_ADMIN_DETAIL: int  =   300   # 5 minutes
TTL_REPORT_LIST: int   = 3_600   # 1 hour
TTL_REVIEW_LIST: int   = 3_600   # 1 hour

# Max items kept in the bounded Redis lists
_REPORT_LIST_MAX: int  = 200
_REVIEW_LIST_MAX: int  = 200

# ---------------------------------------------------------------------------
# Key builders – centralised so a rename is one-line change
# ---------------------------------------------------------------------------
KEY_LATEST_ANALYSIS  = "vingoo:latest_analysis"
KEY_RECENT_REPORTS   = "vingoo:recent_reports"
KEY_RECENT_REVIEWS   = "vingoo:recent_reviews"


def key_graph_metrics(csv_hash: str) -> str:
    """Redis key for graph metrics derived from a specific CSV upload."""
    return f"vingoo:graph_metrics:{csv_hash}"


def key_admin_analysis(analysis_id: str) -> str:
    """Redis key for a cached /admin/analysis/{id} response."""
    return f"vingoo:admin_analysis:{analysis_id}"


# ---------------------------------------------------------------------------
# Module-level client reference – set by init_cache() inside the FastAPI
# lifespan so the same connection pool is shared across all requests.
# ---------------------------------------------------------------------------
_redis: "Optional[aioredis.Redis]" = None  # type: ignore[type-arg]


# ---------------------------------------------------------------------------
# Lifecycle helpers (called from main.lifespan)
# ---------------------------------------------------------------------------

async def init_cache(url: Optional[str] = None) -> None:
    """Open a Redis connection pool and verify connectivity with PING.

    Sets the module-level ``_redis`` reference.  Silently skips if the
    ``redis`` package is not installed or the server is unreachable.
    """
    global _redis

    if not _REDIS_AVAILABLE:
        log.warning("[CACHE] Skipping Redis init – redis package missing.")
        return

    redis_url = url or os.getenv("REDIS_URL", "redis://localhost:6379/0")

    try:
        client: aioredis.Redis = aioredis.from_url(  # type: ignore[attr-defined]
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        await client.ping()
        _redis = client
        log.info("[CACHE] Redis connected: %s", redis_url.split("@")[-1])
        print(f"[CACHE] Redis connected – URL tail: ...{redis_url.split('@')[-1]}")
    except Exception as exc:  # noqa: BLE001
        _redis = None
        log.warning("[CACHE] Redis unavailable (%s) – running without cache.", exc)
        print(f"[CACHE WARNING] Redis unavailable ({exc}) – in-memory fallback active.")


async def close_cache() -> None:
    """Drain the Redis connection pool on shutdown."""
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
            log.info("[CACHE] Redis connection closed.")
            print("[CACHE] Redis connection closed.")
        except Exception as exc:  # noqa: BLE001
            log.debug("[CACHE] Error closing Redis: %s", exc)
        finally:
            _redis = None


# ---------------------------------------------------------------------------
# Core cache operations (all return safe defaults on failure)
# ---------------------------------------------------------------------------

async def cache_set(key: str, value: Any, ttl: int = TTL_ANALYSIS) -> bool:
    """Serialise *value* to JSON and store it under *key* with expiry *ttl* seconds.

    Returns True on success, False if Redis is unavailable or serialisation fails.
    """
    if _redis is None:
        return False
    try:
        payload = json.dumps(value, default=str)
        await _redis.set(key, payload, ex=ttl)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("[CACHE] cache_set(%s) failed: %s", key, exc)
        return False


async def cache_get(key: str) -> Optional[Any]:
    """Retrieve and deserialise the value at *key*.

    Returns the deserialised object on hit, or None on miss / error.
    """
    if _redis is None:
        return None
    try:
        raw = await _redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        log.warning("[CACHE] cache_get(%s) failed: %s", key, exc)
        return None


async def cache_delete(key: str) -> None:
    """Remove *key* from Redis.  No-op if Redis is down or key doesn't exist."""
    if _redis is None:
        return
    try:
        await _redis.delete(key)
    except Exception as exc:  # noqa: BLE001
        log.debug("[CACHE] cache_delete(%s) failed: %s", key, exc)


async def cache_exists(key: str) -> bool:
    """Return True iff *key* exists in Redis."""
    if _redis is None:
        return False
    try:
        return bool(await _redis.exists(key))
    except Exception as exc:  # noqa: BLE001
        log.debug("[CACHE] cache_exists(%s) failed: %s", key, exc)
        return False


# ---------------------------------------------------------------------------
# Bounded list helper – for multi-worker safe recent-item lists
# ---------------------------------------------------------------------------

async def cache_lpush_bounded(
    key: str,
    value: Any,
    max_len: int = 200,
    ttl: int = TTL_REPORT_LIST,
) -> None:
    """Prepend a JSON-serialised *value* to a Redis list and trim it to *max_len*.

    This replaces in-process Python lists for shared state across workers:
    - LPUSH adds the new item at the head (newest first).
    - LTRIM discards items beyond *max_len* to bound memory usage.
    - EXPIRE resets the TTL on every write.

    Falls back silently if Redis is unavailable.
    """
    if _redis is None:
        return
    try:
        payload = json.dumps(value, default=str)
        pipe = _redis.pipeline()
        pipe.lpush(key, payload)
        pipe.ltrim(key, 0, max_len - 1)
        pipe.expire(key, ttl)
        await pipe.execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("[CACHE] cache_lpush_bounded(%s) failed: %s", key, exc)


async def cache_lrange(key: str, start: int = 0, stop: int = -1) -> list[Any]:
    """Return a slice of the Redis list at *key*, deserialised from JSON.

    Returns an empty list on miss or error.
    """
    if _redis is None:
        return []
    try:
        raw_items = await _redis.lrange(key, start, stop)
        return [json.loads(item) for item in raw_items]
    except Exception as exc:  # noqa: BLE001
        log.warning("[CACHE] cache_lrange(%s) failed: %s", key, exc)
        return []


# ---------------------------------------------------------------------------
# Health helper (called by GET /health to report cache status)
# ---------------------------------------------------------------------------

async def cache_ping() -> str:
    """Return 'ok', 'degraded', or 'unavailable'."""
    if _redis is None:
        return "unavailable"
    try:
        await _redis.ping()
        return "ok"
    except Exception:  # noqa: BLE001
        return "degraded"
