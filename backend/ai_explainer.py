"""ai_explainer.py – Two-layer AI explanation overlay (account + ring level) via OpenRouter."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_MODEL          = "anthropic/claude-3.5-sonnet"
_TEMPERATURE    = 0.2
_MAX_TOKENS     = 800
_TIMEOUT_SECS   = 25          # Hard wall-clock cap per request
_TOP_N_ACCOUNTS = 5           # Layer 1 only explains the highest-risk accounts

# ---------------------------------------------------------------------------
# Shared async HTTP client – injected by lifespan in main.py
# ---------------------------------------------------------------------------

# Set by main.py lifespan on startup; falls back to a per-call client if None.
_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    """Return the shared client or a fresh one (fallback — avoids None guard)."""
    if _http_client is not None:
        return _http_client
    # Fallback: create a temporary client (should only happen in tests)
    return httpx.AsyncClient(
        timeout=httpx.Timeout(_TIMEOUT_SECS),
        http2=True,
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )


# ---------------------------------------------------------------------------
# Internal: single async POST to OpenRouter
# ---------------------------------------------------------------------------

async def _call_openrouter_async(prompt: str) -> str:
    """Fully async POST to OpenRouter using the shared httpx.AsyncClient."""
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set or empty.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _MODEL,
        "temperature": _TEMPERATURE,
        "max_tokens": _MAX_TOKENS,
        "messages": [
            {"role": "user", "content": prompt},
        ],
    }

    client = _get_client()
    try:
        resp = await client.post(
            _OPENROUTER_URL,
            headers=headers,
            json=payload,
        )
    except httpx.TimeoutException as exc:
        raise RuntimeError(f"OpenRouter request timed out after {_TIMEOUT_SECS}s.") from exc
    except httpx.ConnectError as exc:
        raise RuntimeError(f"OpenRouter connection error: {exc}") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(f"OpenRouter request failed: {exc}") from exc

    if resp.status_code != 200:
        raise RuntimeError(
            f"OpenRouter returned HTTP {resp.status_code}: {resp.text[:300]}"
        )

    try:
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, ValueError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response shape: {exc}") from exc


# ---------------------------------------------------------------------------
# Internal: parse assistant reply as JSON array
# ---------------------------------------------------------------------------

def _parse_json_array(raw: str) -> List[Dict[str, Any]]:
    """Extract and parse a JSON array from the model reply, stripping markdown fences."""
    text = raw.strip()

    if text.startswith("```"):
        lines = text.splitlines()
        inner_lines = []
        skip_first = True
        for line in lines:
            if skip_first:
                skip_first = False
                continue
            if line.strip() == "```":
                break
            inner_lines.append(line)
        text = "\n".join(inner_lines).strip()

    return json.loads(text)


# ---------------------------------------------------------------------------
# Layer 1 — Account-Level Explanation
# ---------------------------------------------------------------------------

async def generate_account_explanations(
    accounts: List[Any],
) -> Dict[str, Any]:
    """Generate compliance-language explanation for top-N flagged accounts."""
    if not accounts:
        return {"explanations": [], "ai_status": "active"}


    def _score(a: Any) -> float:
        return a.suspicion_score if hasattr(a, "suspicion_score") else a.get("suspicion_score", 0)

    sorted_accs = sorted(accounts, key=_score, reverse=True)[:_TOP_N_ACCOUNTS]

    # prep prompt payload — only forward detection fields
    account_dicts = []
    for a in sorted_accs:
        if hasattr(a, "model_dump"):
            d = a.model_dump()
        else:
            d = dict(a)
        account_dicts.append({
            "account_id":       d.get("account_id"),
            "suspicion_score":  d.get("suspicion_score"),
            "detected_patterns": d.get("detected_patterns", []),
            "ring_id":          d.get("ring_id"),
        })

    prompt = f"""\
You are a financial fraud analyst.
Explain clearly why the following accounts are suspicious.
Use professional compliance language.
Do not hallucinate new data.
Do not change any values.
Return JSON in this exact format (array of objects):

[
  {{
    "account_id": "string",
    "explanation": "string"
  }}
]

Return structured JSON array only. No markdown. No extra text.

Accounts:
{json.dumps(account_dicts, indent=2)}
"""

    try:
        raw = await _call_openrouter_async(prompt)
        parsed = _parse_json_array(raw)
        # Validate minimal shape
        for item in parsed:
            if "account_id" not in item or "explanation" not in item:
                raise ValueError(f"Missing required keys in AI item: {item}")
        logger.info("[AI] Layer 1: generated %d account explanations.", len(parsed))
        return {"explanations": parsed, "ai_status": "active"}

    except Exception as exc:  # noqa: BLE001
        logger.warning("[AI] Layer 1 failed — returning unavailable. Reason: %s", exc)
        return {"explanations": [], "ai_status": "unavailable"}


# ---------------------------------------------------------------------------
# Layer 2 — Ring-Level Case Summary
# ---------------------------------------------------------------------------

async def generate_ring_summaries(
    rings: List[Any],
) -> Dict[str, Any]:
    """Generate law-enforcement-ready investigation summary per fraud ring."""
    if not rings:
        return {"summaries": [], "ai_status": "active"}

    ring_dicts = []
    for r in rings:
        if hasattr(r, "model_dump"):
            d = r.model_dump()
        else:
            d = dict(r)
        ring_dicts.append({
            "ring_id":         d.get("ring_id"),
            "pattern_type":    d.get("pattern_type"),
            "member_accounts": d.get("member_accounts", []),
            "risk_score":      d.get("risk_score"),
        })

    prompt = f"""\
You are generating a law-enforcement ready investigation summary.

For each fraud ring:
- Describe the structure
- Mention pattern type
- Explain why it is risky
- Suggest next investigative steps

Return JSON in this exact format (array of objects):

[
  {{
    "ring_id": "string",
    "summary": "string"
  }}
]

Return JSON array only. No markdown. No extra commentary.

Fraud rings:
{json.dumps(ring_dicts, indent=2)}
"""

    try:
        raw = await _call_openrouter_async(prompt)
        parsed = _parse_json_array(raw)
        for item in parsed:
            if "ring_id" not in item or "summary" not in item:
                raise ValueError(f"Missing required keys in AI ring item: {item}")
        logger.info("[AI] Layer 2: generated %d ring summaries.", len(parsed))
        return {"summaries": parsed, "ai_status": "active"}

    except Exception as exc:  # noqa: BLE001
        logger.warning("[AI] Layer 2 failed — returning unavailable. Reason: %s", exc)
        return {"summaries": [], "ai_status": "unavailable"}
