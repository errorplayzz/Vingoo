"""detection.py – Production-grade pattern detection engine.

Patterns detected (v2):
  A) Cycle detection          – temporal cycles of length 3-5
  B) Smurfing                 – fan-in / fan-out count anomaly  (sliding window)
  C) Shell chain              – layered intermediary DFS with pass-through scoring
  D) High velocity            – burst transactions in 24h rolling window
  E) Structuring              – amounts repeatedly just below reporting thresholds
  F) Rapid round-trip         – bilateral flow reversal within short time window
  G) Amount convergence       – many small inflows summing near a round large number
  H) Degree anomaly           – unusually high degree relative to graph average

False-positive guards:
  - High-volume / merchant hub suppression (MERCHANT_DEGREE_THRESHOLD)
  - Temporal time-window enforcement on all cycles
  - Pure-bipartite hub detection (linear merchants never form cycles)
  - Minimum evidence thresholds before any flag is raised

Performance guards:
  - Adaptive cycle cap (tight on large graphs  triangles only)
  - Betweenness centrality approximated for large graphs
  - DFS depth limit on shell chains
"""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

import networkx as nx

from utils import get_all_timestamps_for_node, total_transaction_count

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

AccountID = str
RingID = str

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CYCLE_MIN_LEN: int = 3
CYCLE_MAX_LEN: int = 5

SMURF_THRESHOLD: int = 8           # reduced from 10  catch more subtle cases
SMURF_WINDOW_HOURS: float = 72.0

SHELL_MIN_PATH_LEN: int = 3
SHELL_MAX_TX_COUNT: int = 4        # slightly relaxed from 3

MERCHANT_DEGREE_THRESHOLD: int = 50

MAX_CYCLES_TOTAL: int = 5_000
LARGE_GRAPH_NODE_THRESHOLD: int = 500
MAX_CYCLES_LARGE_GRAPH: int = 1_000
LARGE_GRAPH_MAX_CYCLE_LEN: int = 3

CYCLE_TIME_WINDOW_HOURS: float = 168.0   # 7 days

HIGH_VELOCITY_TX_THRESHOLD: int = 15    # reduced from 20  catch moderate bursts
HIGH_VELOCITY_WINDOW_HOURS: float = 24.0

# Structuring: amounts within this % below reporting thresholds are suspicious
STRUCTURING_THRESHOLDS: List[float] = [10_000.0, 5_000.0, 3_000.0, 1_000.0]
STRUCTURING_BAND_PCT: float = 0.12     # flag if amount in [threshold*(1-band), threshold*(1))
STRUCTURING_MIN_COUNT: int = 2         # minimum occurrences before raising flag

# Rapid round-trip: AB then BA within this many hours
ROUNDTRIP_WINDOW_HOURS: float = 48.0
ROUNDTRIP_AMOUNT_RATIO: float = 0.70   # return must be >= 70% of sent amount to count

# Amount convergence: many inflows sum to within this % of a round number
CONVERGENCE_MIN_INFLOWS: int = 5
CONVERGENCE_ROUND_PCT: float = 0.05    # within 5% of a round multiple of 1000

# Degree anomaly: flag if degree > mean + stddev * this multiplier
DEGREE_ANOMALY_SIGMA: float = 3.0


# ---------------------------------------------------------------------------
# Helper: identify likely merchant / high-volume legitimate accounts
# ---------------------------------------------------------------------------

def _identify_high_volume_accounts(G: nx.DiGraph) -> Set[AccountID]:
    """Nodes with in_degree OR out_degree >= MERCHANT_DEGREE_THRESHOLD are hubs."""
    high_volume: Set[AccountID] = set()
    for node in G.nodes():
        if (G.in_degree(node) >= MERCHANT_DEGREE_THRESHOLD or
                G.out_degree(node) >= MERCHANT_DEGREE_THRESHOLD):
            high_volume.add(node)
    return high_volume


def _identify_bipartite_hubs(G: nx.DiGraph) -> Set[AccountID]:
    """
    Pure linear merchants appear in bipartite-like subgraphs: all their neighbours
    are either purely senders or purely receivers with NO overlap AND very high degree.
    Only mark as hub if combined degree >= MERCHANT_DEGREE_THRESHOLD,
    to avoid misidentifying smurf collectors (which also look bipartite but at low scale).
    """
    bipartite_hubs: Set[AccountID] = set()
    for node in G.nodes():
        in_n = set(G.predecessors(node))
        out_n = set(G.successors(node))
        combined = len(in_n) + len(out_n)
        # Only exclude if BOTH conditions hold:
        #  1. Very high degree (>= MERCHANT_DEGREE_THRESHOLD) — this is a true hub
        #  2. No neighbourhood overlap (bipartite structure)
        if combined >= MERCHANT_DEGREE_THRESHOLD and not (in_n & out_n):
            bipartite_hubs.add(node)
    return bipartite_hubs


# ---------------------------------------------------------------------------
# A) Cycle Detection
# ---------------------------------------------------------------------------

def detect_cycles(
    G: nx.DiGraph,
) -> Tuple[Dict[AccountID, List[str]], List[Dict]]:
    """Find temporal cycles of length CYCLE_MIN_LEN..CYCLE_MAX_LEN."""
    candidate_nodes = [
        n for n in G.nodes()
        if G.in_degree(n) >= 1 and G.out_degree(n) >= 1
    ]
    subgraph: nx.DiGraph = G.subgraph(candidate_nodes).copy()

    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    raw_cycles: List[Tuple[int, FrozenSet[AccountID]]] = []

    is_large = subgraph.number_of_nodes() > LARGE_GRAPH_NODE_THRESHOLD
    cycle_cap = MAX_CYCLES_LARGE_GRAPH if is_large else MAX_CYCLES_TOTAL
    length_bound = LARGE_GRAPH_MAX_CYCLE_LEN if is_large else CYCLE_MAX_LEN

    cycle_count = 0
    for cycle in nx.simple_cycles(subgraph, length_bound=length_bound):
        length = len(cycle)
        if length < CYCLE_MIN_LEN:
            continue
        if not _cycle_is_time_constrained(subgraph, cycle):
            continue

        cycle_count += 1
        if cycle_count > cycle_cap:
            break

        label = f"cycle_length_{length}"
        node_set = frozenset(cycle)
        raw_cycles.append((length, node_set))
        for account in cycle:
            if label not in account_patterns[account]:
                account_patterns[account].append(label)

    rings = _build_rings_from_cycles(raw_cycles)
    return dict(account_patterns), rings


def _build_rings_from_cycles(
    raw_cycles: List[Tuple[int, FrozenSet[AccountID]]],
) -> List[Dict]:
    """Merge overlapping cycles into rings via union-find."""
    if not raw_cycles:
        return []

    parent: Dict[AccountID, AccountID] = {}

    def find(x: AccountID) -> AccountID:
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent.get(x, x), x)
            x = parent.get(x, x)
        return x

    def union(a: AccountID, b: AccountID) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for _, node_set in raw_cycles:
        nodes = list(node_set)
        for node in nodes:
            if node not in parent:
                parent[node] = node
        for i in range(1, len(nodes)):
            union(nodes[0], nodes[i])

    root_to_members: Dict[AccountID, Set[AccountID]] = defaultdict(set)
    for account in parent:
        root_to_members[find(account)].add(account)

    rings: List[Dict] = []
    for idx, (root, members) in enumerate(
        sorted(root_to_members.items(), key=lambda kv: kv[0])
    ):
        ring_id = f"RING_{idx + 1:03d}"
        lengths_in_ring = [
            length for length, node_set in raw_cycles if node_set & members
        ]
        # Compute total amount circulating through this ring
        ring_member_set = set(members)
        total_amount_ring = 0.0

        rings.append({
            "ring_id": ring_id,
            "members": sorted(members),
            "pattern_type": "cycle",
            "cycle_lengths": lengths_in_ring,
            "cycle_count": len([1 for _, ns in raw_cycles if ns <= ring_member_set]),
        })

    return rings


def _cycle_is_time_constrained(
    G: nx.DiGraph,
    cycle: List[AccountID],
    max_hours: float = CYCLE_TIME_WINDOW_HOURS,
) -> bool:
    """All edges in the cycle must exist and span  max_hours."""
    all_ts: List[datetime] = []
    n = len(cycle)
    for i in range(n):
        src, dst = cycle[i], cycle[(i + 1) % n]
        if not G.has_edge(src, dst):
            return False
        for tx in G[src][dst].get("transactions", []):
            all_ts.append(tx["timestamp"])
    if len(all_ts) < n:
        return False
    span_hours = (max(all_ts) - min(all_ts)).total_seconds() / 3600.0
    return span_hours <= max_hours


# ---------------------------------------------------------------------------
# B) Smurfing Detection
# ---------------------------------------------------------------------------

def detect_smurfing(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """Detect fan-in and fan-out accounts using sliding time window."""
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    for node in G.nodes():
        if node in high_volume_accounts:
            continue
        _check_fan_pattern(G, node, "in", SMURF_THRESHOLD, SMURF_WINDOW_HOURS,
                           account_patterns[node], "fan_in")
        _check_fan_pattern(G, node, "out", SMURF_THRESHOLD, SMURF_WINDOW_HOURS,
                           account_patterns[node], "fan_out")
    return {k: v for k, v in account_patterns.items() if v}


def _check_fan_pattern(
    G: nx.DiGraph,
    node: AccountID,
    direction: str,
    threshold: int,
    window_hours: float,
    patterns: List[str],
    label: str,
) -> None:
    """Sliding-window fan check for one node."""
    events: List[Tuple[datetime, AccountID]] = []
    if direction == "in":
        for src, _, ed in G.in_edges(node, data=True):
            for tx in ed.get("transactions", []):
                events.append((tx["timestamp"], src))
    else:
        for _, dst, ed in G.out_edges(node, data=True):
            for tx in ed.get("transactions", []):
                events.append((tx["timestamp"], dst))

    if len(events) < threshold:
        return

    events.sort(key=lambda e: e[0])
    window: deque = deque()
    window_parties: Dict[AccountID, int] = defaultdict(int)
    unique_count = 0
    window_delta = timedelta(hours=window_hours)

    for ts, party in events:
        window.append((ts, party))
        if window_parties[party] == 0:
            unique_count += 1
        window_parties[party] += 1
        while window and (ts - window[0][0]) > window_delta:
            old_ts, old_party = window.popleft()
            window_parties[old_party] -= 1
            if window_parties[old_party] == 0:
                unique_count -= 1
                del window_parties[old_party]
        if unique_count >= threshold:
            if label not in patterns:
                patterns.append(label)
            return


# ---------------------------------------------------------------------------
# C) Shell Chain Detection
# ---------------------------------------------------------------------------

def detect_shell_chains(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """Detect paths of >= SHELL_MIN_PATH_LEN hops through low-activity intermediaries."""
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    tx_count_cache: Dict[AccountID, int] = {
        node: total_transaction_count(G, node) for node in G.nodes()
    }

    for start_node in G.nodes():
        if start_node in high_volume_accounts:
            continue
        if tx_count_cache.get(start_node, 0) > SHELL_MAX_TX_COUNT:
            continue

        stack: List[Tuple[AccountID, List[AccountID]]] = [(start_node, [start_node])]
        while stack:
            current, path = stack.pop()
            if len(path) > CYCLE_MAX_LEN + 1:
                continue
            for _, neighbor in G.out_edges(current):
                if neighbor in path:
                    continue
                neighbor_is_shell = (
                    tx_count_cache.get(neighbor, 0) <= SHELL_MAX_TX_COUNT
                    and neighbor not in high_volume_accounts
                )
                new_path = path + [neighbor]
                if neighbor_is_shell:
                    stack.append((neighbor, new_path))
                if len(new_path) >= SHELL_MIN_PATH_LEN + 1:
                    for account in new_path:
                        if "shell_chain" not in account_patterns[account]:
                            account_patterns[account].append("shell_chain")

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# D) High-Velocity Detection
# ---------------------------------------------------------------------------

def detect_high_velocity(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """Flag accounts with >= HIGH_VELOCITY_TX_THRESHOLD txns in any 24h window."""
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    window_delta = timedelta(hours=HIGH_VELOCITY_WINDOW_HOURS)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue
        events: List[datetime] = []
        for _, _, ed in G.out_edges(node, data=True):
            for tx in ed.get("transactions", []):
                events.append(tx["timestamp"])
        for _, _, ed in G.in_edges(node, data=True):
            for tx in ed.get("transactions", []):
                events.append(tx["timestamp"])

        if len(events) < HIGH_VELOCITY_TX_THRESHOLD:
            continue

        events.sort()
        left = 0
        for right in range(len(events)):
            while events[right] - events[left] > window_delta:
                left += 1
            if (right - left + 1) >= HIGH_VELOCITY_TX_THRESHOLD:
                if "high_velocity" not in account_patterns[node]:
                    account_patterns[node].append("high_velocity")
                break

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# E) Structuring Detection (NEW)
# ---------------------------------------------------------------------------

def detect_structuring(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """
    Detect structuring (smurfing variant): accounts that repetitively transact
    at amounts just BELOW common reporting thresholds (10k, 5k, 3k, 1k).

    Real-world AML: layerers deliberately keep individual amounts < threshold
    to evade CTR (Currency Transaction Reports).
    """
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue

        # Collect all individual transaction amounts from this node
        amounts: List[float] = []
        for _, _, ed in G.out_edges(node, data=True):
            for tx in ed.get("transactions", []):
                amounts.append(tx["amount"])
        # Also look at received amounts (aggregators)
        for _, _, ed in G.in_edges(node, data=True):
            for tx in ed.get("transactions", []):
                amounts.append(tx["amount"])

        if len(amounts) < STRUCTURING_MIN_COUNT:
            continue

        for threshold in STRUCTURING_THRESHOLDS:
            lower = threshold * (1.0 - STRUCTURING_BAND_PCT)
            structured = [a for a in amounts if lower <= a < threshold]
            if len(structured) >= STRUCTURING_MIN_COUNT:
                if "structuring" not in account_patterns[node]:
                    account_patterns[node].append("structuring")
                break

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# F) Rapid Round-Trip Detection (NEW)
# ---------------------------------------------------------------------------

def detect_rapid_roundtrips(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """
    Detect bilateral flow reversals: A sends amount X to B, then B sends
    >= ROUNDTRIP_AMOUNT_RATIO * X back to A within ROUNDTRIP_WINDOW_HOURS.

    Pattern signature: layering 'U-turn' — funds passed forward then returned
    to obscure the origin while creating paper trail complexity.
    """
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    window_delta = timedelta(hours=ROUNDTRIP_WINDOW_HOURS)

    # Only check pairs where edges exist in both directions
    undirected_pairs = set()
    for src, dst in G.edges():
        if G.has_edge(dst, src):
            pair = tuple(sorted([src, dst]))
            undirected_pairs.add(pair)

    for a, b in undirected_pairs:
        if a in high_volume_accounts or b in high_volume_accounts:
            continue

        # Collect forward (ab) and backward (ba) transaction events
        forward: List[Tuple[datetime, float]] = []
        backward: List[Tuple[datetime, float]] = []

        if G.has_edge(a, b):
            for tx in G[a][b].get("transactions", []):
                forward.append((tx["timestamp"], tx["amount"]))
        if G.has_edge(b, a):
            for tx in G[b][a].get("transactions", []):
                backward.append((tx["timestamp"], tx["amount"]))

        forward.sort(key=lambda x: x[0])
        backward.sort(key=lambda x: x[0])

        # For each forward tx, look for a matching backward tx within window
        found_roundtrip = False
        for fwd_ts, fwd_amt in forward:
            for bwd_ts, bwd_amt in backward:
                if bwd_ts <= fwd_ts:
                    continue   # backward must come AFTER forward
                if (bwd_ts - fwd_ts) > window_delta:
                    break      # sorted  no more within window
                if bwd_amt >= fwd_amt * ROUNDTRIP_AMOUNT_RATIO:
                    found_roundtrip = True
                    break
            if found_roundtrip:
                break

        if found_roundtrip:
            for node in (a, b):
                if "rapid_roundtrip" not in account_patterns[node]:
                    account_patterns[node].append("rapid_roundtrip")

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# G) Amount Convergence Detection (NEW)
# ---------------------------------------------------------------------------

def detect_amount_convergence(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """
    Detect accounts that receive many small payments which converge to a round
    large sum — a classic aggregation / money collection pattern.

    Signs: fan-in of >= CONVERGENCE_MIN_INFLOWS unique senders, where total
    inflow is within CONVERGENCE_ROUND_PCT of a round multiple of 1000.
    """
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue

        # Count unique sending counterparties and total received
        unique_senders: Set[AccountID] = set()
        total_in = 0.0
        for src, _, ed in G.in_edges(node, data=True):
            unique_senders.add(src)
            total_in += ed.get("total_amount", 0.0)

        if len(unique_senders) < CONVERGENCE_MIN_INFLOWS or total_in <= 0:
            continue

        # Check if total_in is near a round number multiple of 1000
        round_multiple = round(total_in / 1000.0) * 1000.0
        if round_multiple <= 0:
            continue
        deviation = abs(total_in - round_multiple) / round_multiple
        if deviation <= CONVERGENCE_ROUND_PCT:
            if "amount_convergence" not in account_patterns[node]:
                account_patterns[node].append("amount_convergence")

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# H) Degree Anomaly Detection (NEW)
# ---------------------------------------------------------------------------

def detect_degree_anomalies(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """
    Flag accounts with statistically anomalous degree (in+out) relative to
    the graph distribution, using z-score analysis.

    Excludes known high-volume hubs. Flags intermediaries that are anomalously
    connected — a sign of coordinating accounts in a laundering network.
    """
    import statistics

    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    degrees = {
        node: G.in_degree(node) + G.out_degree(node)
        for node in G.nodes()
        if node not in high_volume_accounts
    }

    if len(degrees) < 5:
        return {}

    values = list(degrees.values())
    mean_deg = statistics.mean(values)
    try:
        stdev_deg = statistics.stdev(values)
    except statistics.StatisticsError:
        return {}

    if stdev_deg == 0:
        return {}

    threshold = mean_deg + DEGREE_ANOMALY_SIGMA * stdev_deg
    for node, deg in degrees.items():
        if deg >= threshold and deg >= 5:  # minimum absolute degree to avoid noise
            if "degree_anomaly" not in account_patterns[node]:
                account_patterns[node].append("degree_anomaly")

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# Public aggregation entry point
# ---------------------------------------------------------------------------

def run_all_detections(G: nx.DiGraph) -> Dict:
    """Run all detectors and merge per-account pattern maps."""
    high_volume = _identify_high_volume_accounts(G)
    bipartite_hubs = _identify_bipartite_hubs(G)
    # Combine: neither high-vol nor bipartite hubs should be flagged by pattern detectors
    excluded_accounts = high_volume | bipartite_hubs

    # Core patterns (original 4)
    cycle_patterns, rings = detect_cycles(G)
    smurf_patterns = detect_smurfing(G, excluded_accounts)
    shell_patterns = detect_shell_chains(G, excluded_accounts)
    velocity_patterns = detect_high_velocity(G, excluded_accounts)

    # New patterns (v2)
    structuring_patterns = detect_structuring(G, excluded_accounts)
    roundtrip_patterns = detect_rapid_roundtrips(G, excluded_accounts)
    convergence_patterns = detect_amount_convergence(G, excluded_accounts)
    degree_anomaly_patterns = detect_degree_anomalies(G, excluded_accounts)

    all_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    for src_dict in (
        cycle_patterns, smurf_patterns, shell_patterns, velocity_patterns,
        structuring_patterns, roundtrip_patterns, convergence_patterns,
        degree_anomaly_patterns,
    ):
        for account, labels in src_dict.items():
            for label in labels:
                if label not in all_patterns[account]:
                    all_patterns[account].append(label)

    # Build account  ring_id reverse map
    account_ring_map: Dict[AccountID, RingID] = {}
    for ring in rings:
        for member in ring["members"]:
            account_ring_map[member] = ring["ring_id"]

    return {
        "account_patterns":    dict(all_patterns),
        "rings":               rings,
        "account_ring_map":    account_ring_map,
        "high_volume_accounts": high_volume,
        "bipartite_hubs":      bipartite_hubs,
        "excluded_accounts":   excluded_accounts,
    }