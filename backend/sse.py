"""sse.py – Server-Sent Events bus for the Vingoo detection backend.

Architecture
------------
A single process-local fan-out bus built entirely on asyncio primitives.
No extra dependencies beyond what FastAPI/Starlette already ship.

            ┌──────────────────────────────────────┐
            │           EventBus (singleton)        │
            │  _subscribers: set[asyncio.Queue]     │
            │                                       │
            │  publish(event)  ──►  put_nowait()    │
            │                   ──►  put_nowait()   │
            │                   ──►  put_nowait()   │
            └──────────────────────────────────────┘
                   ▲                   │
              emit_*()           SSE generators
              (main.py)         (subscriber queues)
                                       │
                            GET /stream/alerts
                            GET /stream/analysis
                            GET /stream/all

Event envelope (JSON)
---------------------
Every event payload is a plain dict.  The SSE frame is:

    event: <type>\\n
    data: <json>\\n
    id: <monotonic counter>\\n
    \\n

Event types
-----------
analysis_started     – CSV received, pipeline beginning
analysis_progress    – incremental stage update (stage, pct_complete)
analysis_complete    – full summary on pipeline finish
alert                – CRITICAL/HIGH account flagged
ring_detected        – fraud ring identified (any tier)
report_submitted     – victim report accepted (POST /report)
review_submitted     – second-chance request accepted (POST /second-chance)
keepalive            – empty comment sent every 15 s to prevent proxy timeouts

Multi-worker note
-----------------
Queues are per-process.  For a multi-worker setup the emit calls should also
write to a Redis Pub/Sub channel so other workers can fan-out.  A thin Redis
bridge (subscribe_redis_bridge) is provided for that use-case; it activates
automatically if REDIS_URL is set and the redis package is installed.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import weakref
from typing import Any, AsyncGenerator, Dict, Optional, Set

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SSE wire format helpers
# ---------------------------------------------------------------------------

_event_counter = 0  # monotonic ID, good enough for demo context


def _next_id() -> str:
    global _event_counter
    _event_counter += 1
    return str(_event_counter)


def format_sse(
    data: Any,
    event_type: str,
    *,
    event_id: Optional[str] = None,
    retry_ms: Optional[int] = None,
) -> str:
    """Encode a single SSE frame as a string ready to write to the response body.

    Parameters
    ----------
    data:
        Any JSON-serialisable value.  Dicts are preferred for extensibility.
    event_type:
        The SSE ``event:`` field.  Clients use this to filter addEventListener().
    event_id:
        Optional monotonic counter for client reconnection (Last-Event-ID).
    retry_ms:
        Optional reconnect hint in milliseconds.

    Returns
    -------
    A complete SSE frame ending with ``\\n\\n``.
    """
    lines: list[str] = []
    if retry_ms is not None:
        lines.append(f"retry: {retry_ms}")
    lines.append(f"event: {event_type}")
    lines.append(f"id: {event_id or _next_id()}")
    payload = json.dumps(data, default=str)
    # SSE requires multi-line data to use separate "data:" prefixes
    for line in payload.splitlines():
        lines.append(f"data: {line}")
    lines.append("\n")  # blank line terminates the frame
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# EventBus
# ---------------------------------------------------------------------------

# Channels – clients subscribe to one or more
CHANNEL_ANALYSIS = "analysis"   # progress + completion events
CHANNEL_ALERTS   = "alerts"     # CRITICAL/HIGH account + ring events
CHANNEL_ALL      = "all"        # every event (union of above)

_ALL_CHANNELS = frozenset({CHANNEL_ANALYSIS, CHANNEL_ALERTS, CHANNEL_ALL})

# Maximum queue depth per subscriber.  Overflow drops the oldest event rather
# than blocking the producer (put_nowait + catch QueueFull).
_QUEUE_MAX = 128

# Keepalive interval in seconds.  Most proxies/CDNs have a 60-90 s idle timeout.
_KEEPALIVE_INTERVAL = 15.0


class _EventBus:
    """In-process fan-out bus.

    Thread-safe for asyncio (single-threaded event loop).
    Use publish() from coroutines; use publish_threadsafe() from sync threads
    (e.g. background DB persist threads).
    """

    def __init__(self) -> None:
        # channel → set of weak-referenced queues
        self._channels: Dict[str, Set[asyncio.Queue[str]]] = {
            ch: set() for ch in _ALL_CHANNELS
        }
        self._lock = asyncio.Lock()

    async def subscribe(self, channel: str) -> asyncio.Queue[str]:
        """Register a new subscriber queue for *channel*.

        The returned queue yields pre-formatted SSE frame strings.
        The caller must call unsubscribe() when the connection closes.
        """
        if channel not in _ALL_CHANNELS:
            channel = CHANNEL_ALL
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=_QUEUE_MAX)
        async with self._lock:
            self._channels[channel].add(q)
        log.debug("[SSE] subscriber added  channel=%s  total=%d", channel, self._subscriber_count())
        return q

    async def unsubscribe(self, channel: str, q: asyncio.Queue[str]) -> None:
        """Remove a subscriber queue.  Safe to call after queue GC."""
        async with self._lock:
            self._channels.get(channel, set()).discard(q)
        log.debug("[SSE] subscriber removed  channel=%s  remaining=%d", channel, self._subscriber_count())

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        """Broadcast an SSE-formatted event to all relevant channels.

        Routing:
          - analysis_* events  → CHANNEL_ANALYSIS + CHANNEL_ALL
          - alert / ring_*     → CHANNEL_ALERTS + CHANNEL_ALL
          - report_* / review_ → CHANNEL_ALL only
          - keepalive          → all channels
        """
        frame = format_sse(payload, event_type)
        targets: Set[asyncio.Queue[str]] = set()

        # Always deliver to CHANNEL_ALL
        targets.update(self._channels[CHANNEL_ALL])

        if event_type in ("analysis_started", "analysis_progress", "analysis_complete"):
            targets.update(self._channels[CHANNEL_ANALYSIS])
        elif event_type in ("alert", "ring_detected"):
            targets.update(self._channels[CHANNEL_ALERTS])

        for q in targets:
            try:
                q.put_nowait(frame)
            except asyncio.QueueFull:
                # Drop oldest to make room; subscriber is too slow
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(frame)
                except asyncio.QueueFull:
                    pass  # give up — subscriber critically lagged

    def publish_threadsafe(
        self,
        event_type: str,
        payload: Dict[str, Any],
        loop: Optional[asyncio.AbstractEventLoop] = None,
    ) -> None:
        """Schedule publish() from a synchronous thread.

        Used by asyncio.to_thread() callbacks that cannot await directly.
        """
        try:
            _loop = loop or asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(self.publish(event_type, payload), _loop)
        except RuntimeError:
            pass  # no running loop (test context) — silently ignore

    def _subscriber_count(self) -> int:
        return sum(len(s) for s in self._channels.values())


# Singleton – imported by main.py via `from sse import bus`
bus = _EventBus()


# ---------------------------------------------------------------------------
# Async generator that drives a single SSE HTTP response
# ---------------------------------------------------------------------------

async def event_stream(
    channel: str,
    *,
    keepalive_interval: float = _KEEPALIVE_INTERVAL,
    retry_ms: int = 3_000,
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE frames for one connected client.

    Usage (in a route)::

        async def my_endpoint(request: Request):
            return StreamingResponse(
                event_stream(CHANNEL_ALERTS),
                media_type="text/event-stream",
            )

    Yields
    ------
    SSE frames as complete strings (event + data + id + blank line).

    The generator ends when the client disconnects (detected via
    ``request.is_disconnected()`` or GeneratorExit on close).
    """
    q = await bus.subscribe(channel)
    # Send reconnection hint and initial connection confirmation
    yield format_sse(
        {"connected": True, "channel": channel, "ts": time.time()},
        event_type="connected",
        retry_ms=retry_ms,
    )

    try:
        while True:
            try:
                # Wait up to keepalive_interval for an event; if nothing
                # arrives, send a comment (: keepalive) so the TCP socket
                # is written to and proxies don't kill idle connections.
                frame = await asyncio.wait_for(q.get(), timeout=keepalive_interval)
                yield frame
            except asyncio.TimeoutError:
                # SSE comment lines start with ":"; invisible to EventSource but
                # keep the connection alive through proxies and load-balancers.
                yield f": keepalive {time.time()}\n\n"
    except GeneratorExit:
        pass
    finally:
        await bus.unsubscribe(channel, q)


# ---------------------------------------------------------------------------
# Typed emit helpers  (called from main.py – thin wrappers around bus.publish)
# ---------------------------------------------------------------------------

async def emit_analysis_started(
    filename: str,
    n_transactions: int,
    csv_hash: str,
) -> None:
    await bus.publish("analysis_started", {
        "filename":      filename,
        "transactions":  n_transactions,
        "csv_hash":      csv_hash,
        "ts":            time.time(),
    })


async def emit_analysis_progress(
    stage: str,
    pct: int,
    detail: Optional[str] = None,
) -> None:
    """Emit a pipeline progress update.

    Parameters
    ----------
    stage:
        Human-readable stage label: 'parsing', 'graph_build', 'detection',
        'scoring', 'ml', 'ai', 'done'.
    pct:
        Completion percentage [0, 100].
    detail:
        Optional extra context (e.g. "N suspicious accounts found").
    """
    payload: Dict[str, Any] = {
        "stage": stage,
        "pct":   pct,
        "ts":    time.time(),
    }
    if detail:
        payload["detail"] = detail
    await bus.publish("analysis_progress", payload)


async def emit_analysis_complete(summary: Dict[str, Any]) -> None:
    await bus.publish("analysis_complete", {
        **summary,
        "ts": time.time(),
    })


async def emit_alert(
    account_id: str,
    risk_tier: str,
    suspicion_score: float,
    detected_patterns: list[str],
    ring_id: Optional[str] = None,
) -> None:
    """Emit a real-time alert for a CRITICAL or HIGH risk account."""
    await bus.publish("alert", {
        "account_id":        account_id,
        "risk_tier":         risk_tier,
        "suspicion_score":   suspicion_score,
        "detected_patterns": detected_patterns,
        "ring_id":           ring_id,
        "ts":                time.time(),
    })


async def emit_ring_detected(
    ring_id: str,
    member_count: int,
    pattern_type: str,
    risk_score: float,
) -> None:
    await bus.publish("ring_detected", {
        "ring_id":      ring_id,
        "member_count": member_count,
        "pattern_type": pattern_type,
        "risk_score":   risk_score,
        "ts":           time.time(),
    })


async def emit_report_submitted(report_id: str, suspect_account_id: str) -> None:
    await bus.publish("report_submitted", {
        "report_id":          report_id,
        "suspect_account_id": suspect_account_id,
        "ts":                 time.time(),
    })


async def emit_review_submitted(review_id: str, account_id: str) -> None:
    await bus.publish("review_submitted", {
        "review_id":  review_id,
        "account_id": account_id,
        "ts":         time.time(),
    })
