"""evidence_seal.py – Cryptographic integrity layer for analysis results.

Generates a SHA-256 seal over the full serialised analysis JSON.
This provides tamper-evident assurance that the investigation record
has not been modified after it was produced by the detection pipeline.

Usage
-----
    from evidence_seal import generate_analysis_seal, verify_analysis_seal

    # When producing a result:
    seal = generate_analysis_seal(response_dict)
    # { integrity_hash, sealed_at, algorithm, integrity_verified: True }

    # When auditing a stored result:
    status = verify_analysis_seal(stored_dict)
    # { verified: bool, detail: str, ... }

Design notes
------------
- Only the CONTENT fields are hashed; the seal fields themselves
  (integrity_hash, sealed_at, integrity_verified) are excluded before
  hashing to avoid circular dependencies.
- sort_keys=True guarantees a canonical serialisation that is stable
  across Python dict insertion order.
- default=str coerces non-serialisable types (datetime, UUID, Decimal)
  to their string representation for a deterministic canonical form.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Fields excluded from hash computation (seal metadata itself)
_SEAL_FIELDS = frozenset({"integrity_hash", "sealed_at", "integrity_verified"})

ALGORITHM = "SHA-256"


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def _canonical_json(data: Dict[str, Any]) -> str:
    """Produce a stable, sorted JSON string from a dict, excluding seal fields."""
    clean = {k: v for k, v in data.items() if k not in _SEAL_FIELDS}
    return json.dumps(clean, sort_keys=True, default=str, ensure_ascii=True)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_analysis_seal(analysis_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a cryptographic integrity seal for an analysis result.

    Parameters
    ----------
    analysis_dict : dict
        The full analysis response serialised to a plain dict
        (e.g. via ``AnalysisResponse.model_dump()``).

    Returns
    -------
    dict with keys:
        ``integrity_hash``   – 64-char hex SHA-256 digest
        ``sealed_at``        – ISO-8601 UTC timestamp
        ``algorithm``        – ``"SHA-256"``
        ``integrity_verified`` – always ``True`` (freshly generated)
    """
    canonical = _canonical_json(analysis_dict)
    digest    = _sha256(canonical)
    sealed_at = datetime.now(timezone.utc).isoformat()

    return {
        "integrity_hash":     digest,
        "sealed_at":          sealed_at,
        "algorithm":          ALGORITHM,
        "integrity_verified": True,
    }


def verify_analysis_seal(stored_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Re-derive the hash from stored data and compare to the stored hash.

    Parameters
    ----------
    stored_dict : dict
        The analysis result as it was stored (must include ``integrity_hash``).

    Returns
    -------
    dict with keys:
        ``verified``        – bool
        ``stored_hash``     – the hash in the stored record
        ``recomputed_hash`` – freshly derived hash
        ``detail``          – human-readable verdict string
        ``algorithm``       – ``"SHA-256"``
    """
    stored_hash = stored_dict.get("integrity_hash")
    if not stored_hash:
        return {
            "verified":        False,
            "stored_hash":     None,
            "recomputed_hash": None,
            "detail":          "No integrity_hash found in stored record.",
            "algorithm":       ALGORITHM,
        }

    canonical     = _canonical_json(stored_dict)
    recomputed    = _sha256(canonical)
    verified      = (recomputed == stored_hash)

    return {
        "verified":        verified,
        "stored_hash":     stored_hash,
        "recomputed_hash": recomputed,
        "detail":          "VERIFIED — record integrity confirmed." if verified
                           else "INTEGRITY MISMATCH — record may have been modified.",
        "algorithm":       ALGORITHM,
    }
