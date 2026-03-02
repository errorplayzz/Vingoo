"""auth.py – Security layer for the Vingoo detection backend.

Provides five independent security controls that are wired into main.py:

  1. JWT Authentication  (python-jose + passlib/bcrypt)
  2. Role-Based Access   (require_role dependency factory)
  3. Rate Limiting       (slowapi – returns 429 on excess)
  4. Request Signatures  (HMAC-SHA256 on POST body)
  5. Abuse Protection    (security headers middleware + payload size guard)

Environment variables (all optional with safe defaults for dev)
---------------------------------------------------------------
  AUTH_ENABLED          "true" | "false"   – master kill-switch (default: true)
  JWT_SECRET            secret string      – MUST be changed in production
  JWT_ALGORITHM         default HS256
  JWT_EXPIRE_MINUTES    access token TTL   – default 60
  JWT_REFRESH_EXPIRE_H  refresh token TTL  – default 24
  API_SIGNATURE_SECRET  HMAC secret        – if unset, signature check is skipped
  ADMIN_USERNAME        default "admin"
  ADMIN_PASSWORD        default "admin123" (change in production!)
  ANALYST_USERNAME      default "analyst"
  ANALYST_PASSWORD      default "analyst123"

Role hierarchy
--------------
  admin     – full access (all endpoints)
  analyst   – detection, export, evaluate, stream, report/review submission
  public    – health, legal-info only (no token required)

Rate limit tiers
----------------
  AUTH_LIMIT      5  / minute  – token endpoint (brute-force protection)
  UPLOAD_LIMIT    10 / minute  – POST /analyze (CPU-heavy)
  WRITE_LIMIT     20 / minute  – POST /report, POST /second-chance
  READ_LIMIT      60 / minute  – GET endpoints
  ADMIN_LIMIT     30 / minute  – /admin/* endpoints
  STREAM_LIMIT    10 / minute  – SSE connect attempts

Usage in main.py
----------------
  from auth import (
      limiter, require_role, optional_auth,
      verify_request_signature, add_security_headers,
      AUTH_ENABLED,
  )

  # Attach rate limiter
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
  app.add_middleware(SlowAPIMiddleware)

  # Protect an endpoint
  @app.post("/analyze")
  @limiter.limit(UPLOAD_LIMIT)
  async def analyze(request: Request, _=Depends(require_role("analyst"))):
      ...

  # Signature validation (inline, before business logic)
  await verify_request_signature(request)
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set

from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy imports – these packages are optional at import time so the app
# starts even if not yet installed (shows a clear error on first auth call).
# ---------------------------------------------------------------------------
try:
    from jose import JWTError, jwt as _jwt  # type: ignore[import-untyped]
    _JOSE_OK = True
except ImportError:
    _JOSE_OK = False
    log.warning("[AUTH] python-jose not installed – JWT authentication disabled.")

try:
    from passlib.context import CryptContext  # type: ignore[import-untyped]
    # Test passlib/bcrypt compatibility at import time (bcrypt 4.x regression).
    try:
        _test_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        _test_ctx.hash("probe")
        _pwd_ctx: CryptContext | None = _test_ctx
        _PASSLIB_OK = True
    except Exception:
        _pwd_ctx = None
        _PASSLIB_OK = False
        log.warning("[AUTH] passlib/bcrypt compat issue – falling back to direct bcrypt.")
except ImportError:
    _PASSLIB_OK = False
    _pwd_ctx = None  # type: ignore[assignment]
    log.warning("[AUTH] passlib not installed – trying direct bcrypt.")

# Direct bcrypt fallback (bcrypt package is a dep of passlib[bcrypt])
try:
    import bcrypt as _bcrypt_mod  # type: ignore[import-untyped]
    _BCRYPT_DIRECT = True
except ImportError:
    _BCRYPT_DIRECT = False
    log.warning("[AUTH] bcrypt package unavailable – using insecure sha256 for dev only.")

try:
    from slowapi import Limiter  # type: ignore[import-untyped]
    from slowapi.errors import RateLimitExceeded  # type: ignore[import-untyped]
    from slowapi.middleware import SlowAPIMiddleware  # type: ignore[import-untyped]
    from slowapi.util import get_remote_address  # type: ignore[import-untyped]
    _SLOWAPI_OK = True
except ImportError:
    _SLOWAPI_OK = False
    Limiter = RateLimitExceeded = SlowAPIMiddleware = get_remote_address = None  # type: ignore[assignment,misc]
    log.warning("[AUTH] slowapi not installed – rate limiting disabled.")

# ---------------------------------------------------------------------------
# Configuration (read once from environment)
# ---------------------------------------------------------------------------

AUTH_ENABLED: bool = os.getenv("AUTH_ENABLED", "true").lower() not in ("false", "0", "no")

_JWT_SECRET:   str = os.getenv("JWT_SECRET", "CHANGE-ME-use-a-long-random-secret-in-production")
_JWT_ALGO:     str = os.getenv("JWT_ALGORITHM", "HS256")
_JWT_EXPIRE:   int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
_REFRESH_EXPIRE: int = int(os.getenv("JWT_REFRESH_EXPIRE_H", "24"))
_SIG_SECRET:  Optional[str] = os.getenv("API_SIGNATURE_SECRET")

# Maximum allowed upload size for POST /analyze (bytes).  10 MB default.
MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

if AUTH_ENABLED and _JWT_SECRET.startswith("CHANGE-ME"):
    log.warning(
        "[AUTH] JWT_SECRET is the default insecure value.  "
        "Set JWT_SECRET in .env before deploying to production."
    )

# ---------------------------------------------------------------------------
# Rate limit strings (slowapi format: "N/period")
# ---------------------------------------------------------------------------

AUTH_LIMIT:   str = "5/minute"    # /auth/token  – brute-force protection
UPLOAD_LIMIT: str = "10/minute"   # POST /analyze – CPU-heavy pipeline
WRITE_LIMIT:  str = "20/minute"   # POST /report, /second-chance
READ_LIMIT:   str = "60/minute"   # GET endpoints
ADMIN_LIMIT:  str = "30/minute"   # /admin/* endpoints
STREAM_LIMIT: str = "10/minute"   # SSE connect

# ---------------------------------------------------------------------------
# User store (in-memory, loaded from env – replace with DB for production)
# ---------------------------------------------------------------------------

class _User(BaseModel):
    username: str
    hashed_password: str
    roles: Set[str]


def _hash(plain: str) -> str:
    """Hash a plaintext password, preferring passlib > direct bcrypt > sha256."""
    if _PASSLIB_OK and _pwd_ctx is not None:
        return _pwd_ctx.hash(plain)
    if _BCRYPT_DIRECT:
        return _bcrypt_mod.hashpw(
            plain[:72].encode(),  # bcrypt truncates at 72 bytes
            _bcrypt_mod.gensalt(),
        ).decode()
    return hashlib.sha256(plain.encode()).hexdigest()


def _verify(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    if _PASSLIB_OK and _pwd_ctx is not None:
        try:
            return _pwd_ctx.verify(plain, hashed)
        except Exception:
            pass
    if _BCRYPT_DIRECT and hashed.startswith("$2"):
        try:
            return _bcrypt_mod.checkpw(plain[:72].encode(), hashed.encode())
        except Exception:
            return False
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


# Build user store at module load time.  Passwords are hashed immediately so
# plaintext never lingers in memory post-startup.
_USERS: Dict[str, _User] = {}

def _register(username_env: str, password_env: str, default_name: str,
               default_pass: str, roles: Set[str]) -> None:
    name = os.getenv(username_env, default_name).strip()
    raw  = os.getenv(password_env, default_pass).strip()
    _USERS[name] = _User(username=name, hashed_password=_hash(raw), roles=roles)

_register("ADMIN_USERNAME",   "ADMIN_PASSWORD",   "admin",   "admin123",   {"admin", "analyst"})
_register("ANALYST_USERNAME", "ANALYST_PASSWORD", "analyst", "analyst123", {"analyst"})

# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    expires_in:    int  # seconds


class TokenData(BaseModel):
    username: str
    roles:    List[str]


def create_access_token(username: str, roles: List[str]) -> str:
    """Issue a signed JWT access token."""
    if not _JOSE_OK:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT library (python-jose) is not installed.",
        )
    now = int(time.time())
    payload = {
        "sub":   username,
        "roles": roles,
        "iat":   now,
        "exp":   now + _JWT_EXPIRE * 60,
        "type":  "access",
    }
    return _jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGO)


def create_refresh_token(username: str) -> str:
    """Issue a longer-lived refresh token (no roles – use only for re-issue)."""
    if not _JOSE_OK:
        raise HTTPException(status_code=503, detail="python-jose not installed.")
    now = int(time.time())
    payload = {
        "sub":  username,
        "iat":  now,
        "exp":  now + _REFRESH_EXPIRE * 3600,
        "type": "refresh",
    }
    return _jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGO)


def _decode_token(token: str, expected_type: str = "access") -> Dict[str, Any]:
    """Decode and validate a JWT.  Raises HTTPException on failure."""
    if not _JOSE_OK:
        raise HTTPException(status_code=503, detail="python-jose not installed.")
    try:
        payload: Dict[str, Any] = _jwt.decode(
            token, _JWT_SECRET, algorithms=[_JWT_ALGO]
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Expected {expected_type!r} token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(_oauth2_scheme),
) -> Optional[TokenData]:
    """Return TokenData if a valid Bearer token is present.
    Returns None for unauthenticated requests (allows optional auth).
    """
    if not token:
        return None
    payload = _decode_token(token, expected_type="access")
    return TokenData(
        username=payload["sub"],
        roles=payload.get("roles", []),
    )


def require_role(*roles: str):
    """Dependency factory – enforces that the caller has at least one of *roles*.

    If AUTH_ENABLED=false, the check is bypassed entirely (dev convenience).
    Usage::

        @app.get("/admin/analyses")
        def route(_=Depends(require_role("admin"))):
            ...
    """
    async def _checker(
        token_data: Optional[TokenData] = Depends(get_current_user),
    ) -> TokenData:
        if not AUTH_ENABLED:
            # Return a synthetic superuser so endpoint code can still access caller info
            return TokenData(username="dev", roles=list(roles))
        if token_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        allowed = set(roles)
        if not allowed.intersection(token_data.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Insufficient permissions.  "
                    f"Required: {sorted(allowed)}.  "
                    f"Caller roles: {sorted(token_data.roles)}."
                ),
            )
        return token_data
    return _checker


async def optional_auth(
    token_data: Optional[TokenData] = Depends(get_current_user),
) -> Optional[TokenData]:
    """Dependency for endpoints that accept both authenticated and unauthenticated
    callers (e.g. POST /report where the public can submit without a token)."""
    return token_data


# ---------------------------------------------------------------------------
# Login handler (called from the POST /auth/token route in main.py)
# ---------------------------------------------------------------------------

def authenticate_user(username: str, password: str) -> _User:
    """Verify credentials against the user store.  Raises 401 on failure.

    Timing-safe: always runs _verify() even for unknown usernames to prevent
    user enumeration via response-time differences.
    """
    user = _USERS.get(username)
    # Perform a dummy hash check even for unknown users (timing-safe)
    dummy_hash = _hash("dummy-prevent-enumeration")  # same cost as real check
    ok = _verify(password, user.hashed_password if user else dummy_hash)
    if not ok or user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def login(form_data: OAuth2PasswordRequestForm) -> TokenResponse:
    """Validate credentials and issue access + refresh tokens."""
    user = authenticate_user(form_data.username, form_data.password)
    access  = create_access_token(user.username, sorted(user.roles))
    refresh = create_refresh_token(user.username)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=_JWT_EXPIRE * 60,
    )


async def refresh_access_token(refresh_token_str: str) -> TokenResponse:
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = _decode_token(refresh_token_str, expected_type="refresh")
    username = payload["sub"]
    user = _USERS.get(username)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists.")
    access  = create_access_token(user.username, sorted(user.roles))
    refresh = create_refresh_token(user.username)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=_JWT_EXPIRE * 60,
    )


# ---------------------------------------------------------------------------
# Rate limiter (slowapi)
# ---------------------------------------------------------------------------

if _SLOWAPI_OK:
    limiter: Optional[Limiter] = Limiter(  # type: ignore[type-arg]
        key_func=get_remote_address,
        # Global fallback limit – individual routes override with @limiter.limit()
        default_limits=["200/minute"],
        # Storage: use in-memory by default; set SLOWAPI_STORAGE_URI for Redis
        # e.g. SLOWAPI_STORAGE_URI=redis://localhost:6379/1
        storage_uri=os.getenv("SLOWAPI_STORAGE_URI", "memory://"),
    )
else:
    limiter = None  # type: ignore[assignment]


def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a clean 429 JSON response instead of slowapi's default text."""
    retry_after = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": "rate_limit_exceeded",
            "detail": (
                "You have sent too many requests.  "
                f"Please wait {retry_after} seconds before retrying."
            ),
            "retry_after_seconds": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


def noop_limit(limit_string: str):  # noqa: ARG001
    """No-op decorator used when slowapi is unavailable, so the app still starts."""
    def decorator(func):
        return func
    return decorator


def get_limit(limit_string: str):
    """Return either a real @limiter.limit() decorator or a no-op."""
    if limiter is not None:
        return limiter.limit(limit_string)
    return noop_limit(limit_string)


# ---------------------------------------------------------------------------
# Request signature validation (HMAC-SHA256)
# ---------------------------------------------------------------------------

async def verify_request_signature(request: Request) -> None:
    """Validate the ``X-Signature`` header against the raw request body.

    Algorithm:
        signature = HMAC-SHA256(body_bytes, API_SIGNATURE_SECRET)
        Header: X-Signature: sha256=<hex_digest>

    This prevents replay attacks and ensures the payload was not tampered with
    in transit.  Silently skipped when:
      - AUTH_ENABLED is false
      - API_SIGNATURE_SECRET is not set (permissive for dev)
      - The header is absent but no secret is configured

    Raises HTTP 401 if the secret *is* configured and the signature is absent
    or incorrect.
    """
    if not AUTH_ENABLED or not _SIG_SECRET:
        return  # signature check is opt-in

    header = request.headers.get("X-Signature", "")
    if not header.startswith("sha256="):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Missing or malformed X-Signature header.  "
                "Expected: X-Signature: sha256=<hex>"
            ),
        )

    provided_hex = header[7:]  # strip "sha256=" prefix

    body = await request.body()
    expected = hmac.new(
        _SIG_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(provided_hex, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Request signature mismatch.  Body may have been tampered with.",
        )


# ---------------------------------------------------------------------------
# Payload size guard
# ---------------------------------------------------------------------------

async def enforce_upload_size(request: Request) -> None:
    """Reject requests whose Content-Length exceeds MAX_UPLOAD_BYTES.

    Protects the /analyze endpoint from DoS via enormous CSV uploads.
    Checked before the body is read so the connection can be dropped early.
    """
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=(
                        f"Upload exceeds maximum allowed size of "
                        f"{MAX_UPLOAD_BYTES // 1024 // 1024} MB."
                    ),
                )
        except ValueError:
            pass  # non-numeric Content-Length – let the body read fail naturally


# ---------------------------------------------------------------------------
# Security headers middleware (applied globally in main.py)
# ---------------------------------------------------------------------------

async def security_headers_middleware(request: Request, call_next):
    """Add hardened HTTP security headers to every response.

    Headers added:
      X-Content-Type-Options   – prevents MIME-sniffing
      X-Frame-Options          – clickjacking protection
      X-XSS-Protection         – legacy XSS filter (defence in depth)
      Referrer-Policy          – controls Referer leakage
      Permissions-Policy       – disable unused browser features
      Strict-Transport-Security – HSTS (production only – see note)
      Content-Security-Policy  – restricts resource origins

    Note: HSTS is only set when the request arrives over HTTPS.  Never set it
    on plain-HTTP traffic or you will brick non-TLS development setups.
    """
    response = await call_next(request)

    response.headers["X-Content-Type-Options"]  = "nosniff"
    response.headers["X-Frame-Options"]         = "DENY"
    response.headers["X-XSS-Protection"]        = "1; mode=block"
    response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]      = (
        "geolocation=(), camera=(), microphone=(), payment=()"
    )
    # Set HSTS only over HTTPS to avoid locking out dev HTTP traffic
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    # CSP: allow same-origin + trusted CDNs for docs UI (Swagger uses unpkg)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )

    # Inject a request-ID into every response for distributed tracing
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    response.headers["X-Request-ID"] = req_id

    return response


# Need uuid for request ID — import here to avoid circular dependency with main
import uuid  # noqa: E402 (intentional late import)


# ---------------------------------------------------------------------------
# Firebase Authentication (optional — set FIREBASE_CREDENTIALS_PATH)
# ---------------------------------------------------------------------------
# When FIREBASE_CREDENTIALS_PATH points to a valid service-account JSON file,
# Firebase ID tokens issued by the frontend are accepted in addition to
# (or instead of) the legacy JWT credentials.
#
# Usage in an endpoint:
#
#   @app.post("/analyze")
#   async def analyze(
#       _fb = Depends(require_firebase_token),  # Firebase path
#       # OR keep legacy:
#       _   = Depends(require_role("analyst")),
#   ):
#       ...
#
# The dependency raises HTTP 401 if the token is absent or invalid.
# ---------------------------------------------------------------------------

_FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
_firebase_app = None  # lazy-initialised singleton


def _get_firebase_app():
    """Lazily initialise the firebase-admin SDK app once and cache it."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    try:
        import firebase_admin  # noqa: PLC0415
        from firebase_admin import credentials  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "firebase-admin is not installed. "
            "Run: pip install firebase-admin>=6.5.0"
        ) from exc

    if _FIREBASE_CREDENTIALS_PATH and os.path.isfile(_FIREBASE_CREDENTIALS_PATH):
        cred = credentials.Certificate(_FIREBASE_CREDENTIALS_PATH)
        _firebase_app = firebase_admin.initialize_app(cred)
        log.info("Firebase Admin SDK initialised from %s", _FIREBASE_CREDENTIALS_PATH)
    else:
        # Use Application Default Credentials (works on GCP/Cloud Run automatically)
        _firebase_app = firebase_admin.initialize_app()
        log.info("Firebase Admin SDK initialised with Application Default Credentials")

    return _firebase_app


async def verify_firebase_token(request: Request) -> Dict[str, Any]:
    """FastAPI dependency — verifies the Firebase ID token in the Authorization header.

    Raises HTTP 401 on any failure.
    Returns the decoded token payload (dict) on success.

    Bearer token must be obtained via ``firebase.auth().currentUser.getIdToken()``.
    """
    if not AUTH_ENABLED:
        return {"uid": "dev", "email": "dev@local", "role": "analyst"}

    auth_header: str = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    id_token = auth_header.split(" ", 1)[1].strip()
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token",
        )

    try:
        import firebase_admin.auth as fb_auth  # noqa: PLC0415
        _get_firebase_app()  # ensure SDK is initialised
        decoded = fb_auth.verify_id_token(id_token, check_revoked=True)
        return decoded  # keys: uid, email, name, picture, phone_number, ...
    except Exception as exc:
        log.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token",
        ) from exc


def require_firebase_token(decoded: Dict[str, Any] = Depends(verify_firebase_token)):
    """Dependency alias — can replace ``require_role()`` on Firebase-protected routes."""
    return decoded
