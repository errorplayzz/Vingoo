"""demo.py – Synthetic fraud scenario generator for demo / hackathon use.

Generates deterministic, in-memory transaction datasets that reliably trigger
all four detection patterns in the Vingoo pipeline:

  1. Laundering ring   – 3-node temporal cycle       → cycle_length_3
  2. Mule chain        – 4-hop shell chain            → shell_chain
  3. Smurfing hub      – fan-in from 12+ senders      → fan_in / smurfing
  4. Normal traffic    – benign background filler      → (no patterns)

Size presets control the number of filler (normal) transactions:
  small  –  ~60 transactions   (fastest; good for a 30-second live demo)
  medium –  ~160 transactions  (more realistic noise ratio)
  large  –  ~360 transactions  (stress / scalability scenario)

Usage
-----
    from demo import generate_demo_csv, DemoSize

    csv_bytes: bytes = generate_demo_csv("medium")
    # feed directly to parse_csv(csv_bytes)
"""

from __future__ import annotations

import io
import random
import uuid
from datetime import datetime, timedelta
from typing import Literal

# ---------------------------------------------------------------------------
# Public type alias
# ---------------------------------------------------------------------------

DemoSize = Literal["small", "medium", "large"]

# Multiplier on the number of *filler* transaction blocks (15 tx per block)
_NOISE_MULT: dict[str, int] = {
    "small":  1,
    "medium": 6,
    "large":  20,
}

# Fixed base timestamp so replayed demos produce identical data (no test flakiness)
_BASE_TS: datetime = datetime(2025, 1, 1, 0, 0, 0)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ts(hours_offset: float) -> str:
    """Return an ISO-style datetime string offset from the base timestamp."""
    return (_BASE_TS + timedelta(hours=hours_offset)).strftime("%Y-%m-%d %H:%M:%S")


def _tid() -> str:
    """Short, uppercase unique transaction ID."""
    return f"TX{uuid.uuid4().hex[:10].upper()}"


def _row(sender: str, receiver: str, amount: float, hours: float) -> dict:
    return {
        "transaction_id": _tid(),
        "sender_id":      sender,
        "receiver_id":    receiver,
        "amount":         round(amount, 2),
        "timestamp":      _ts(hours),
    }


# ---------------------------------------------------------------------------
# Pattern builders
# ---------------------------------------------------------------------------

def _build_laundering_ring() -> list[dict]:
    """3-node cycle: RING_A → RING_B → RING_C → RING_A.

    Two transactions per edge, all within 24 h, triggers cycle_length_3.
    Amounts deliberately close to reporting thresholds (structuring).
    """
    nodes = ["RING_ALPHA", "RING_BETA", "RING_GAMMA"]
    edges = [(nodes[0], nodes[1]), (nodes[1], nodes[2]), (nodes[2], nodes[0])]
    rows: list[dict] = []
    for i, (src, dst) in enumerate(edges):
        for j in range(2):
            rows.append(_row(src, dst, 9_450.00 - j * 200, i * 5 + j * 1.5))
    return rows


def _build_mule_chain() -> list[dict]:
    """4-hop shell chain: ORIGIN → MULE_1 → MULE_2 → MULE_3 → ENDPOINT.

    Each mule has ≤ 2 transactions (well under SHELL_MAX_TX_COUNT), which is
    the key signal for shell_chain detection.  ORIGIN is given one inbound tx
    from a normal payer so it doesn't look like a leaf node.
    """
    chain = ["CHAIN_ORIGIN", "CHAIN_MULE_1", "CHAIN_MULE_2", "CHAIN_MULE_3", "CHAIN_ENDPOINT"]
    rows: list[dict] = []
    for i in range(len(chain) - 1):
        rows.append(_row(chain[i], chain[i + 1], 48_000.00 - i * 500, 30 + i * 4))
    # One inbound tx into ORIGIN so graph is not trivially isolated
    rows.append(_row("NORMAL_PAYER_A", "CHAIN_ORIGIN", 49_000.00, 26))
    return rows


def _build_smurfing_hub() -> list[dict]:
    """12 unique senders → SMURF_HUB within 36 h (fan-in / smurfing signal).

    Then SMURF_HUB disperses to 8 destinations (fan-out), showing full cycle.
    Detection requires ≥ 8 unique senders in a 72-h window.
    """
    hub = "SMURF_CENTER"
    rows: list[dict] = []
    for k in range(12):
        rows.append(_row(f"SMURF_SRC_{k:02d}", hub, 900.00 + k * 55, 60 + k * 2.5))
    for k in range(8):
        rows.append(_row(hub, f"SMURF_DST_{k:02d}", 1_150.00 + k * 30, 96 + k * 1.5))
    return rows


def _build_normal_traffic(n_blocks: int) -> list[dict]:
    """Filler transactions between a pool of normal users.

    ``n_blocks`` × 15 transactions.  Uses a seeded RNG so output is identical
    on every run (useful for repeatable demos).
    """
    users = [f"CITIZEN_{i:03d}" for i in range(max(10, n_blocks * 3))]
    rng = random.Random(42)
    rows: list[dict] = []
    for block in range(n_blocks):
        for _ in range(15):
            src, dst = rng.sample(users, 2)
            rows.append(_row(
                src, dst,
                round(rng.uniform(50.0, 4_500.0), 2),
                rng.uniform(0, 120),
            ))
    return rows


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_demo_csv(size: DemoSize = "small") -> bytes:
    """Return CSV bytes encoding a synthetic fraud scenario of the given size.

    The CSV conforms exactly to the schema expected by ``parse_csv()``::

        transaction_id, sender_id, receiver_id, amount, timestamp

    All four fraud patterns are always present regardless of size.
    ``size`` only controls the amount of normal background traffic.

    Args:
        size: ``"small"`` | ``"medium"`` | ``"large"``

    Returns:
        UTF-8 encoded CSV bytes with a header row.

    Raises:
        ValueError: if ``size`` is not one of the accepted literals.
    """
    if size not in _NOISE_MULT:
        raise ValueError(f"size must be one of {list(_NOISE_MULT)}, got {size!r}")

    noise_mult = _NOISE_MULT[size]

    all_rows: list[dict] = (
        _build_laundering_ring()
        + _build_mule_chain()
        + _build_smurfing_hub()
        + _build_normal_traffic(noise_mult)
    )

    # Build CSV manually to avoid a pandas dependency at the module level
    header = "transaction_id,sender_id,receiver_id,amount,timestamp"
    lines = [header]
    for r in all_rows:
        lines.append(
            f"{r['transaction_id']},"
            f"{r['sender_id']},"
            f"{r['receiver_id']},"
            f"{r['amount']},"
            f"{r['timestamp']}"
        )

    return "\n".join(lines).encode("utf-8")


def scenario_description(size: DemoSize) -> dict:
    """Return a human-readable summary of what the demo scenario contains."""
    noise_blocks = _NOISE_MULT.get(size, 1)
    return {
        "size":              size,
        "patterns_included": [
            "laundering_ring (cycle_length_3: RING_ALPHA→RING_BETA→RING_GAMMA→RING_ALPHA)",
            "mule_chain (shell_chain: 4-hop CHAIN_ORIGIN→…→CHAIN_ENDPOINT)",
            "smurfing_hub (fan_in: 12 unique sources → SMURF_CENTER within 36 h)",
        ],
        "normal_transactions": noise_blocks * 15,
        "total_transactions":  6 + 5 + 20 + noise_blocks * 15,  # ring+chain+smurf+noise
    }
