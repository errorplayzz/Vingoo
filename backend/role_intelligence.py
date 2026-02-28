"""role_intelligence.py – Financial role classification from existing graph signals.

Derives Victim / Mule / Controller probabilities from signals already computed
by the scoring engine.  No new graph traversals or DB queries.

Role definitions
----------------
CONTROLLER : Aggregation hub.  Accumulates funds, high betweenness, fan-in
             dominant, amount-convergence patterns, high graph_score.

MULE       : Relay / transit node.  Fast turn-around, incoming ≈ outgoing,
             high-velocity or round-trip patterns, many counterparties.

POSSIBLE_VICTIM : Passive receiver.  Mostly receives, does not forward,
                  low suspicion on its own, no aggressive forwarding patterns.

The probabilities are normalised so they sum to 1.0 and are stored directly
on the SuspiciousAccount model for downstream display.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import SuspiciousAccount

# ---------------------------------------------------------------------------
# Aggressive-forwarding pattern set (used to rule out victim role)
# ---------------------------------------------------------------------------
_AGGRESSIVE = frozenset({
    "cycle_length_3", "cycle_length_4", "cycle_length_5",
    "fan_out", "shell_chain", "amount_convergence",
})

# Relay patterns (mule signals)
_RELAY = frozenset({
    "high_velocity", "rapid_roundtrip", "fan_in", "fan_out",
})

# Controller / aggregator patterns
_AGGREGATOR = frozenset({
    "fan_in", "amount_convergence", "shell_chain",
})


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------

def classify_financial_role(account: "SuspiciousAccount") -> dict:
    """Return role classification dict for a single SuspiciousAccount.

    Uses only fields already present on the account object:
    - total_sent / total_received      → flow direction
    - graph_score                      → centrality / betweenness proxy
    - behavioral_score                 → pattern breadth
    - temporal_score                   → velocity signals
    - detected_patterns                → pattern labels
    - suspicion_score                  → overall risk
    - transaction_count                → activity volume

    Returns::

        {
          "victim_probability":     float,   # [0,1], normalised
          "mule_probability":       float,
          "controller_probability": float,
          "financial_role":         str,     # CONTROLLER | MULE | POSSIBLE_VICTIM
        }
    """
    sent     = account.total_sent
    received = account.total_received
    total_flow = sent + received + 1e-9

    in_ratio  = received / total_flow   # 0 = pure sender, 1 = pure receiver
    out_ratio = sent     / total_flow

    patterns   = frozenset(account.detected_patterns or [])
    graph_s    = (account.graph_score or 0.0)    / 100.0   # normalise to [0,1]
    behav_s    = (account.behavioral_score or 0.0) / 100.0
    temporal_s = (account.temporal_score or 0.0)  / 100.0
    suspicion  = (account.suspicion_score or 0.0) / 100.0
    tx_count   = account.transaction_count or 0

    # ------------------------------------------------------------------ #
    # MULE (relay / transit)                                               #
    # Key indicators: stays close to 50/50 flow, velocity patterns        #
    # ------------------------------------------------------------------ #
    mule = 0.0

    # Relay balance: highest when in_ratio ≈ out_ratio
    balance_score = 1.0 - abs(in_ratio - out_ratio)   # 1.0 = perfect relay
    mule += 0.25 * balance_score

    if "high_velocity" in patterns:
        mule += 0.18
    if "rapid_roundtrip" in patterns:
        mule += 0.15
    if "fan_in" in patterns and "fan_out" in patterns:
        mule += 0.20
    elif "fan_out" in patterns:
        mule += 0.10

    # Active relay => high tx count and temporal score
    if tx_count > 10:
        mule += 0.08
    mule += 0.10 * temporal_s
    mule += 0.04 * behav_s      # general behavioural breadth

    mule = min(mule, 1.0)

    # ------------------------------------------------------------------ #
    # CONTROLLER (aggregation hub / orchestrator)                          #
    # Key indicators: accumulates funds, high centrality, fan-in patterns  #
    # ------------------------------------------------------------------ #
    ctrl = 0.0

    if "fan_in" in patterns:
        ctrl += 0.22
    if "amount_convergence" in patterns:
        ctrl += 0.18
    if "shell_chain" in patterns:
        ctrl += 0.12         # commands chains

    # Accumulation: predominantly receives (higher in_ratio)
    if in_ratio > 0.60:
        ctrl += 0.15 * in_ratio   # graduated: more skewed = more controller-like
    # High betweenness / centrality → graph_score
    ctrl += 0.25 * graph_s
    # High overall suspicion suggests orchestrator-level involvement
    ctrl += 0.08 * suspicion

    ctrl = min(ctrl, 1.0)

    # ------------------------------------------------------------------ #
    # POSSIBLE VICTIM (passive / pulled into scheme)                       #
    # Key indicators: passive receiver, no forwarding, low suspicion       #
    # ------------------------------------------------------------------ #
    victim = 0.0

    if in_ratio > 0.70:
        victim += 0.30
    if out_ratio < 0.25:
        victim += 0.20
    if not (patterns & _AGGRESSIVE):
        victim += 0.25        # no aggressive activity
    if suspicion < 0.50:
        victim += 0.15
    if tx_count < 5:
        victim += 0.10        # very low activity → accidental involvement

    victim = min(victim, 1.0)

    # ------------------------------------------------------------------ #
    # Normalise to probability simplex                                     #
    # ------------------------------------------------------------------ #
    raw_total = victim + mule + ctrl
    if raw_total < 1e-9:
        # Edge case: no signals → equal split
        return {
            "victim_probability":     0.333,
            "mule_probability":       0.333,
            "controller_probability": 0.334,
            "financial_role":         "UNCLASSIFIED",
        }

    vp = round(victim / raw_total, 4)
    mp = round(mule   / raw_total, 4)
    cp = round(ctrl   / raw_total, 4)

    # Assign primary role (highest probability wins; ties broken by priority order)
    if cp >= mp and cp >= vp:
        role = "CONTROLLER"
    elif mp > vp:
        role = "MULE"
    else:
        role = "POSSIBLE_VICTIM"

    return {
        "victim_probability":     vp,
        "mule_probability":       mp,
        "controller_probability": cp,
        "financial_role":         role,
    }


# ---------------------------------------------------------------------------
# Batch helper
# ---------------------------------------------------------------------------

def apply_role_classification(suspicious_accounts: list) -> list:
    """Mutate each SuspiciousAccount in-place with role fields; return the list."""
    for acc in suspicious_accounts:
        role_data = classify_financial_role(acc)
        acc.victim_probability     = role_data["victim_probability"]
        acc.mule_probability       = role_data["mule_probability"]
        acc.controller_probability = role_data["controller_probability"]
        acc.financial_role         = role_data["financial_role"]
    return suspicious_accounts
