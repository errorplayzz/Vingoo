"""scoring.py – Multi-factor suspicion scoring engine (v2).

Upgrades vs v1:
- Three independent score components: behavioral, graph, temporal
- Amount-based scoring component (structuring/convergence amplifier)
- Confidence score: breadth x depth of evidence, independent of suspicion score
- Risk tier classification: CRITICAL / HIGH / MEDIUM / LOW
- Investigation priority: 1 (immediate)  4 (monitor)
- Human-readable explanation synthesis per account
- Pattern strength multiplier: more distinct pattern types = higher confidence
- Amount-weighted scoring: high-value suspicious accounts score higher
- Adaptive MIN_SUSPICIOUS_SCORE based on graph size
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Set, Tuple

import networkx as nx

from models import FraudRing, SuspiciousAccount
from utils import get_node_amounts

# ---------------------------------------------------------------------------
# Component weights (must sum = 1.0)
# ---------------------------------------------------------------------------

# Behavioral component weights (patterns found by detectors)
W_CYCLE       = 0.28   # cycle participation (strongest AML signal)
W_SMURF       = 0.22   # fan-in / fan-out smurfing
W_SHELL       = 0.12   # shell chain participation
W_VELOCITY    = 0.10   # high-velocity burst
W_STRUCTURING = 0.12   # structuring (amounts just below thresholds)
W_ROUNDTRIP   = 0.10   # rapid round-trip (bilateral reversal)
W_CONVERGENCE = 0.04   # amount convergence aggregation
W_DEGREE      = 0.02   # degree anomaly (weak on its own)

# Graph topology component weights
W_BETWEENNESS = 0.60   # betweenness: intermediary importance
W_DEG_CENT    = 0.25   # degree centrality
W_FLOW_IMBAL  = 0.15   # flow imbalance (pure source/sink)

# Temporal component weight
W_VELOCITY_TEMPORAL = 0.70
W_ROUNDTRIP_TEMPORAL = 0.30

# Final composite weights: behavioral, graph, temporal, amount
COMP_BEHAVIORAL = 0.55
COMP_GRAPH      = 0.20
COMP_TEMPORAL   = 0.15
COMP_AMOUNT     = 0.10

SCORE_PRECISION = 1
HV_PENALTY      = 30.0
MIN_SUSPICIOUS_SCORE: float = 35.0


# ---------------------------------------------------------------------------
# Risk tier thresholds
# ---------------------------------------------------------------------------

TIER_CRITICAL = 80.0
TIER_HIGH     = 60.0
TIER_MEDIUM   = 35.0

# Investigation priority mapping (risk_tier -> priority)
PRIORITY_MAP = {
    "CRITICAL": 1,
    "HIGH":     2,
    "MEDIUM":   3,
    "LOW":      4,
}

# Pattern strength: how many unique pattern categories (out of max 8) are needed
# for high confidence
MAX_PATTERN_CATEGORIES = 8


# ---------------------------------------------------------------------------
# Pattern score extractors
# ---------------------------------------------------------------------------

def _behavioral_sub_scores(patterns: List[str]) -> Dict[str, float]:
    """Return a dict of pattern_key -> [0,1] sub-score for each behavioural detector."""
    scores: Dict[str, float] = {
        "cycle":       0.0,
        "smurf":       0.0,
        "shell":       0.0,
        "velocity":    0.0,
        "structuring": 0.0,
        "roundtrip":   0.0,
        "convergence": 0.0,
        "degree":      0.0,
    }

    # Cycle: shorter cycles = riskier
    if "cycle_length_3" in patterns:
        scores["cycle"] = 1.00
    elif "cycle_length_4" in patterns:
        scores["cycle"] = 0.85
    elif "cycle_length_5" in patterns:
        scores["cycle"] = 0.65

    # Smurfing: bidirectional is worst
    if "fan_in" in patterns and "fan_out" in patterns:
        scores["smurf"] = 1.00
    elif "fan_in" in patterns or "fan_out" in patterns:
        scores["smurf"] = 0.72

    scores["shell"]       = 1.0 if "shell_chain"      in patterns else 0.0
    scores["velocity"]    = 1.0 if "high_velocity"    in patterns else 0.0
    scores["structuring"] = 1.0 if "structuring"      in patterns else 0.0
    scores["roundtrip"]   = 1.0 if "rapid_roundtrip"  in patterns else 0.0
    scores["convergence"] = 1.0 if "amount_convergence" in patterns else 0.0
    scores["degree"]      = 1.0 if "degree_anomaly"   in patterns else 0.0

    return scores


def _compute_behavioral_score(sub: Dict[str, float]) -> float:
    """Weighted sum of behavioral sub-scores  [0,1]."""
    return (
        W_CYCLE       * sub["cycle"]
        + W_SMURF       * sub["smurf"]
        + W_SHELL       * sub["shell"]
        + W_VELOCITY    * sub["velocity"]
        + W_STRUCTURING * sub["structuring"]
        + W_ROUNDTRIP   * sub["roundtrip"]
        + W_CONVERGENCE * sub["convergence"]
        + W_DEGREE      * sub["degree"]
    )


def _compute_graph_score(
    degree_norm: float,
    betweenness_norm: float,
    flow_imbalance: float,
) -> float:
    """Topology-based score  [0,1]."""
    return (
        W_DEG_CENT    * degree_norm
        + W_BETWEENNESS * betweenness_norm
        + W_FLOW_IMBAL  * flow_imbalance
    )


def _compute_temporal_score(patterns: List[str]) -> float:
    """Temporal anomaly score  [0,1]."""
    vel = 1.0 if "high_velocity" in patterns else 0.0
    rtr = 1.0 if "rapid_roundtrip" in patterns else 0.0
    return W_VELOCITY_TEMPORAL * vel + W_ROUNDTRIP_TEMPORAL * rtr


def _compute_amount_score(
    sent: float,
    received: float,
    patterns: List[str],
    graph_mean_amount: float,
) -> float:
    """Amount-based anomaly score  [0,1]."""
    total = sent + received
    if total <= 0 or graph_mean_amount <= 0:
        return 0.0

    # Amount magnitude: how many sigmas above mean
    ratio = total / (graph_mean_amount + 1e-9)
    magnitude_score = min(math.log1p(ratio) / math.log1p(10), 1.0)  # log-scaled, cap at 10x

    # Structuring penalty
    struct_boost = 0.30 if "structuring" in patterns else 0.0
    convergence_boost = 0.20 if "amount_convergence" in patterns else 0.0

    return min(magnitude_score + struct_boost + convergence_boost, 1.0)


def _compute_confidence_score(
    patterns: List[str],
    sub_scores: Dict[str, float],
    behavioral_score: float,
    graph_score: float,
) -> float:
    """
    Confidence = how sure are we this is truly suspicious?

    Formula: breadth (distinct pattern categories)  evidence strength
    - breadth:  number of distinct pattern categories active / max possible
    - strength: average of behavioral + graph component scores
    - Combined: geometric mean amplifies cases with BOTH pattern breadth AND strong scores
    """
    active_categories = sum(1 for v in sub_scores.values() if v > 0)
    breadth = active_categories / MAX_PATTERN_CATEGORIES  # [0,1]

    strength = (behavioral_score + graph_score) / 2.0   # [0,1]

    # Geometric mean — requires both breadth and strength to score high
    if breadth <= 0 or strength <= 0:
        confidence_raw = (breadth + strength) * 0.5     # fallback: arithmetic mean
    else:
        confidence_raw = math.sqrt(breadth * strength)  # [0,1]

    return round(min(confidence_raw * 100.0, 100.0), SCORE_PRECISION)


def _build_explanation(
    account_id: str,
    patterns: List[str],
    sub_scores: Dict[str, float],
    risk_tier: str,
    suspicion_score: float,
    sent: float,
    received: float,
    ring_id: Optional[str],
) -> str:
    """Produce a concise human-readable explanation string."""
    parts: List[str] = []

    pattern_descriptions = {
        "cycle_length_3":    "participates in a 3-node circular money flow (triangle)",
        "cycle_length_4":    "participates in a 4-node circular money flow",
        "cycle_length_5":    "participates in a 5-node circular money flow",
        "fan_in":            "receives from an unusually large number of unique senders",
        "fan_out":           "sends to an unusually large number of unique recipients",
        "shell_chain":       "routes funds through a chain of low-activity shell accounts",
        "high_velocity":     "executes abnormally high transaction volume within 24 hours",
        "structuring":       "repeatedly transacts at amounts just below reporting thresholds",
        "rapid_roundtrip":   "sends funds that are quickly returned (bilateral flow reversal)",
        "amount_convergence":"receives many small payments converging to a round large sum",
        "degree_anomaly":    "is unusually connected within the transaction network",
    }

    for p in sorted(patterns):
        if p in pattern_descriptions:
            parts.append(pattern_descriptions[p])

    if not parts:
        return f"Account {account_id} exhibits graph-centrality anomalies without explicit pattern flags."

    evidence_str = "; ".join(parts)
    ring_str = f" Member of fraud ring {ring_id}." if ring_id else ""
    amount_str = (
        f" Total sent: {sent:,.2f}, received: {received:,.2f}."
        if sent + received > 0 else ""
    )

    return (
        f"[{risk_tier}] Account {account_id} flagged with score {suspicion_score:.1f}/100. "
        f"Evidence: {evidence_str}.{ring_str}{amount_str}"
    )


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------

def compute_suspicion_scores(
    G: nx.DiGraph,
    account_patterns: Dict[str, List[str]],
    account_ring_map: Dict[str, str],
    high_volume_accounts: Set[str],
) -> List[SuspiciousAccount]:
    """Score every node in G; return sorted list of SuspiciousAccount."""
    num_nodes = G.number_of_nodes()
    if num_nodes == 0:
        return []

    #  Batch centrality 
    degree_centrality: Dict[str, float] = nx.degree_centrality(G)

    # For large graphs use approximate betweenness (k=min(100, nodes))
    k_approx = min(100, num_nodes) if num_nodes > 200 else None
    betweenness: Dict[str, float] = nx.betweenness_centrality(
        G, normalized=True, weight=None, k=k_approx
    )

    _max_deg  = max(degree_centrality.values(), default=1.0) or 1.0
    _max_betw = max(betweenness.values(), default=1.0) or 1.0
    degree_centrality = {k: v / _max_deg  for k, v in degree_centrality.items()}
    betweenness       = {k: v / _max_betw for k, v in betweenness.items()}

    flow_imbalance: Dict[str, float] = _compute_flow_imbalance(G)

    #  Pre-compute graph-wide amount stats 
    all_amounts: List[float] = []
    for _, _, ed in G.edges(data=True):
        all_amounts.append(ed.get("total_amount", 0.0))
    graph_mean_amount = sum(all_amounts) / len(all_amounts) if all_amounts else 1.0

    results: List[SuspiciousAccount] = []

    for account in G.nodes():
        patterns = account_patterns.get(account, [])

        #  Component scores 
        sub_scores = _behavioral_sub_scores(patterns)
        b_score = _compute_behavioral_score(sub_scores)

        deg_norm  = min(degree_centrality.get(account, 0.0), 1.0)
        betw_norm = min(betweenness.get(account, 0.0), 1.0)
        flow_val  = flow_imbalance.get(account, 0.0)
        g_score   = _compute_graph_score(deg_norm, betw_norm, flow_val)

        t_score = _compute_temporal_score(patterns)

        sent, received = get_node_amounts(G, account)
        a_score = _compute_amount_score(sent, received, patterns, graph_mean_amount)

        #  Composite suspicion score 
        raw = (
            COMP_BEHAVIORAL * b_score
            + COMP_GRAPH      * g_score
            + COMP_TEMPORAL   * t_score
            + COMP_AMOUNT     * a_score
        )
        score = raw * 100.0

        # HV penalty
        if account in high_volume_accounts:
            score = max(0.0, score - HV_PENALTY)

        score = round(score, SCORE_PRECISION)

        # Skip accounts with no evidence and low score
        if not patterns and score < MIN_SUSPICIOUS_SCORE:
            continue

        #  Confidence score 
        confidence = _compute_confidence_score(patterns, sub_scores, b_score, g_score)

        #  Risk tier 
        if score >= TIER_CRITICAL:
            risk_tier = "CRITICAL"
        elif score >= TIER_HIGH:
            risk_tier = "HIGH"
        elif score >= TIER_MEDIUM:
            risk_tier = "MEDIUM"
        else:
            risk_tier = "LOW"

        priority = PRIORITY_MAP.get(risk_tier, 3)

        ring_id = account_ring_map.get(account)

        explanation = _build_explanation(
            account, patterns, sub_scores, risk_tier, score, sent, received, ring_id
        )

        tx_count = sum(
            len(ed.get("transactions", []))
            for _, _, ed in list(G.out_edges(account, data=True)) + list(G.in_edges(account, data=True))
        )

        results.append(SuspiciousAccount(
            account_id=account,
            suspicion_score=score,
            confidence_score=confidence,
            risk_tier=risk_tier,
            detected_patterns=sorted(patterns),
            behavioral_score=round(b_score * 100, SCORE_PRECISION),
            graph_score=round(g_score * 100, SCORE_PRECISION),
            temporal_score=round(t_score * 100, SCORE_PRECISION),
            amount_score=round(a_score * 100, SCORE_PRECISION),
            total_sent=round(sent, 2),
            total_received=round(received, 2),
            transaction_count=tx_count,
            ring_id=ring_id,
            investigation_priority=priority,
            explanation=explanation,
        ))

    results.sort(key=lambda a: (-a.suspicion_score, -a.confidence_score, a.account_id))
    return results


# ---------------------------------------------------------------------------
# Fraud ring risk scores
# ---------------------------------------------------------------------------

def compute_ring_scores(
    rings: List[Dict],
    account_scores: Dict[str, float],
    G: Optional[nx.DiGraph] = None,
) -> List[FraudRing]:
    """Average member score + cycle-length boost + pattern-type classification."""
    fraud_rings: List[FraudRing] = []

    for ring in rings:
        ring_id: str = ring["ring_id"]
        members: List[str] = ring["members"]
        cycle_lengths: List[int] = ring.get("cycle_lengths", [])

        if not members:
            continue

        member_scores = [account_scores.get(m, 0.0) for m in members]
        avg_score = sum(member_scores) / len(member_scores) if member_scores else 0.0

        # Cycle-length boost
        boost = 0.0
        if 3 in cycle_lengths:
            boost = 12.0
        elif 4 in cycle_lengths:
            boost = 6.0

        risk_score = round(min(avg_score + boost, 100.0), SCORE_PRECISION)

        # Ring confidence: based on number of members and cycle count
        cycle_count = len(cycle_lengths)
        ring_confidence = min((len(members) / 10.0 + cycle_count / 20.0) * 100, 100.0)
        ring_confidence = round(ring_confidence, SCORE_PRECISION)

        # Compute total amount circulated within ring
        total_amount_circulated = 0.0
        if G is not None:
            member_set = set(members)
            for m in members:
                for _, dst, ed in G.out_edges(m, data=True):
                    if dst in member_set:
                        total_amount_circulated += ed.get("total_amount", 0.0)

        fraud_rings.append(FraudRing(
            ring_id=ring_id,
            member_accounts=sorted(members),
            pattern_type=ring.get("pattern_type", "cycle"),
            risk_score=risk_score,
            total_amount_circulated=round(total_amount_circulated, 2),
            cycle_count=cycle_count,
            confidence_score=ring_confidence,
        ))

    fraud_rings.sort(key=lambda r: (-r.risk_score, r.ring_id))
    return fraud_rings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_flow_imbalance(G: nx.DiGraph) -> Dict[str, float]:
    """imbalance = |sent - received| / (sent + received + eps)  [0,1]"""
    imbalance: Dict[str, float] = {}
    eps = 1e-9
    for node in G.nodes():
        sent = sum(ed.get("total_amount", 0.0) for _, _, ed in G.out_edges(node, data=True))
        recv = sum(ed.get("total_amount", 0.0) for _, _, ed in G.in_edges(node, data=True))
        total = sent + recv
        imbalance[node] = abs(sent - recv) / (total + eps)
    return imbalance


def build_score_lookup(suspicious_accounts: List[SuspiciousAccount]) -> Dict[str, float]:
    """Return plain dict mapping account_id  suspicion_score."""
    return {sa.account_id: sa.suspicion_score for sa in suspicious_accounts}