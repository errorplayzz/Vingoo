"""log_config.py – Centralised structured JSON logging for the Vingoo backend.

Usage
-----
Call ``configure_logging()`` once at module load time (before FastAPI is created)::

    from log_config import configure_logging, RequestIdMiddleware
    configure_logging()
    app = FastAPI(...)
    app.add_middleware(RequestIdMiddleware)

What is logged
--------------
  INFO   – request lifecycle (method, path, status, duration_ms, request_id)
  WARN   – cache failures, rate-limit hits, requests returning 4xx
  ERROR  – unhandled exceptions, DB errors, 5xx responses
  DEBUG  – SSE keep-alive frames (disabled by default; set LOG_LEVEL=DEBUG)

What is NOT logged (to prevent noise)
--------------------------------------
  - Request bodies or file contents
  - Successful Redis cache hits
  - OpenAPI / docs asset fetches
  - Static-file serving

CRITICAL naming note
--------------------
This file MUST stay named ``log_config.py`` — never rename it ``logging.py``
or it will shadow the Python standard-library ``logging`` module and cause
``ImportError`` across the entire application.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ---------------------------------------------------------------------------
# Resolve log level once, at import time
# ---------------------------------------------------------------------------

_LOG_LEVEL_STR: str = os.getenv("LOG_LEVEL", "INFO").upper()
_LOG_LEVEL: int = getattr(logging, _LOG_LEVEL_STR, logging.INFO)


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------

class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object.

    Guaranteed output keys::

        {
          "time":    "2025-01-01T00:00:00",   # strftime with datefmt
          "level":   "INFO",
          "logger":  "vingoo.http",
          "message": "REQUEST",
          ... extra kwargs passed to logger.info/warning/error ...
        }

    Any key in ``record.__dict__`` that is not a standard LogRecord
    attribute is forwarded as-is, so callers can attach structured
    context via ``logger.info("msg", extra={"request_id": "a3f9", ...})``.
    """

    # Standard LogRecord fields we never forward (noise / redundant)
    _SKIP: frozenset[str] = frozenset({
        "args", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message",
        "module", "msecs", "msg", "name", "pathname", "process",
        "processName", "relativeCreated", "stack_info", "taskName",
        "thread", "threadName",
    })

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        record.message = record.getMessage()
        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)

        obj: dict = {
            "time":    self.formatTime(record, self.datefmt),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.message,
        }
        if record.exc_text:
            obj["exc"] = record.exc_text

        # Forward any extra fields attached by the caller
        for key, val in record.__dict__.items():
            if key not in self._SKIP and not key.startswith("_"):
                obj[key] = val

        return json.dumps(obj, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Request ID / lifecycle middleware
# ---------------------------------------------------------------------------

class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a short hex ``request_id`` to every request and log lifecycle.

    Per-request behaviour
    ---------------------
    1. Generate ``request_id = uuid4().hex[:8]``.
    2. Store it on ``request.state.request_id`` so downstream handlers can
       include it in their own log lines.
    3. Add ``X-Request-ID`` to the response headers.
    4. Log request completion at INFO (success) or WARNING (4xx) level with::

           method, path, status, duration_ms, request_id

    5. Log unhandled exceptions at ERROR with full traceback, then re-raise.

    Suppressed paths (no lifecycle log emitted)
    --------------------------------------------
    OpenAPI schema, Swagger UI, ReDoc, and favicon — these are fetched
    repeatedly by browsers and would spam the log stream with useless noise.
    """

    _SUPPRESS: frozenset[str] = frozenset({
        "/openapi.json", "/docs", "/redoc", "/favicon.ico",
    })
    _log: logging.Logger = logging.getLogger("vingoo.http")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = uuid.uuid4().hex[:8]
        request.state.request_id = request_id

        suppress = request.url.path in self._SUPPRESS
        t_start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = (time.perf_counter() - t_start) * 1_000.0
            self._log.error(
                "REQUEST_ERROR",
                extra={
                    "method":      request.method,
                    "path":        request.url.path,
                    "duration_ms": round(duration_ms, 1),
                    "request_id":  request_id,
                    "error":       str(exc),
                },
                exc_info=True,
            )
            raise

        duration_ms = (time.perf_counter() - t_start) * 1_000.0
        response.headers["X-Request-ID"] = request_id

        if not suppress:
            lvl = logging.WARNING if response.status_code >= 400 else logging.INFO
            self._log.log(
                lvl,
                "REQUEST",
                extra={
                    "method":      request.method,
                    "path":        request.url.path,
                    "status":      response.status_code,
                    "duration_ms": round(duration_ms, 1),
                    "request_id":  request_id,
                },
            )

        return response


# ---------------------------------------------------------------------------
# Public setup function
# ---------------------------------------------------------------------------

def configure_logging() -> None:
    """Wire JSON formatter to the root logger and all Uvicorn/FastAPI loggers.

    Safe to call multiple times — idempotent (clears and re-applies handlers).
    Reads ``LOG_LEVEL`` from the environment (default: ``INFO``).

    Third-party loggers that produce unactionable chatter are silenced to
    WARNING so they only surface genuine problems.
    """
    formatter = _JsonFormatter(datefmt="%Y-%m-%dT%H:%M:%S")

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    handler.setLevel(_LOG_LEVEL)

    # Root logger: catches everything that propagates up
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(_LOG_LEVEL)

    # Explicit Uvicorn loggers (uvicorn spawns its own handler tree)
    for uv_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(uv_name)
        lg.handlers.clear()
        lg.addHandler(handler)
        lg.setLevel(_LOG_LEVEL)
        lg.propagate = False  # prevent double-printing via root

    # Noisy third-party loggers — downgrade to WARNING
    _noisy = (
        "uvicorn.access",           # per-request HTTP/1.1 access log line
        "httpx",                    # connection pool keep-alive noise
        "hpack",                    # HTTP/2 compression internals
        "apscheduler.executors.default",  # "Running job …" every 30 min
        "apscheduler.scheduler",    # scheduler heartbeat
        "multipart",                # python-multipart form parsing
    )
    for name in _noisy:
        logging.getLogger(name).setLevel(logging.WARNING)

    # Ensure our own loggers inherit root level and propagate
    for our_name in ("vingoo", "vingoo.http", "ml_model", "detection", "cache", "demo"):
        lg = logging.getLogger(our_name)
        lg.setLevel(_LOG_LEVEL)
        lg.propagate = True

    logging.getLogger("vingoo").info(
        "Structured JSON logging enabled",
        extra={"log_level": _LOG_LEVEL_STR},
    )
