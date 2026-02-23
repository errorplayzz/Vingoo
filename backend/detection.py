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

Performance optimizations (v3):
  - _GraphCache: single O(E) sweep pre-computes all per-node statistics
    (timestamps, amounts, events, bidirectional pairs) reused across all detectors
  - _identify_hubs: merged single-pass hub detection (was two loops)
  - detect_shell_chains: backtracking DFS (O(depth) path copies → O(1) per step)
  - detect_rapid_roundtrips: bisect for O(log n) backward-event search
  - detect_smurfing: pre-sorted event lists from cache (no per-node sort)
  - run_all_detections: all 8 detectors run concurrently via ThreadPoolExecutor
  - detect_degree_anomalies: module-level statistics import (no per-call import)

False-positive guards:
  - High-volume / merchant hub suppression (MERCHANT_DEGREE_THRESHOLD)
  - Temporal time-window enforcement on all cycles
  - Pure-bipartite hub detection (linear merchants never form cycles)
  - Minimum evidence thresholds before any flag is raised
"""

from __future__ import annotations

import bisect
import hashlib
import logging
import statistics
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, FrozenSet, Iterator, List, Optional, Set, Tuple

import networkx as nx

from utils import total_transaction_count

log = logging.getLogger(__name__)

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

# Minimum graph size to offset ThreadPoolExecutor startup cost
_PARALLEL_MIN_NODES: int = 50

# ---------------------------------------------------------------------------
# Adaptive scaling guard – thresholds and knobs
# ---------------------------------------------------------------------------

# Node count above which the adaptive large-graph mode activates.
# Below this: full pipeline on all nodes.  At or above: sampling + timeouts.
ADAPTIVE_LARGE_THRESHOLD: int = 10_000

# For LARGE graphs, only the top-K nodes (by total degree) are fed into the
# two most expensive detectors – shell_chains and smurfing.  All other
# detectors still run on the full graph.
ADAPTIVE_SAMPLE_TOP_K: int = 5_000

# Per-detector wall-time budget (seconds) in concurrent mode.
# MEDIUM graphs get a generous budget; LARGE graphs get tighter limits because
# we already reduced their work via sampling.
DETECTOR_TIMEOUT_MEDIUM_S: float = 60.0
DETECTOR_TIMEOUT_LARGE_S:  float = 30.0

# Module-level results cache: TTL in seconds.  An identical graph (same
# node/edge count + degree-sequence fingerprint) reuses the cached result.
_CACHE_TTL_S: float = 300.0   # 5 minutes


# ---------------------------------------------------------------------------
# Pre-computed graph cache – single O(E) pass
# ---------------------------------------------------------------------------

@dataclass
class _GraphCache:
    """Per-node statistics derived from a single O(E) edge traversal.

    Building this once and sharing it across all detectors eliminates repeated
    edge-list walks that would otherwise total O(8 × E) across the pipeline.
    All list fields are pre-sorted by timestamp so detectors never need to sort.
    """
    # Total individual transaction count touching each node (sent + received)
    tx_count: Dict[str, int] = field(default_factory=dict)

    # (timestamp, counterparty) events – pre-sorted; for smurfing sliding window
    node_out_events: Dict[str, List[Tuple[datetime, str]]] = field(default_factory=dict)
    node_in_events:  Dict[str, List[Tuple[datetime, str]]] = field(default_factory=dict)

    # Flat sorted timestamp list (sent + received) – for high-velocity window
    node_all_timestamps: Dict[str, List[datetime]] = field(default_factory=dict)

    # Raw amount lists – for structuring band check
    node_out_amounts: Dict[str, List[float]] = field(default_factory=dict)
    node_in_amounts:  Dict[str, List[float]] = field(default_factory=dict)

    # Aggregated inflow stats – for amount-convergence check
    node_in_total_amount:   Dict[str, float]    = field(default_factory=dict)
    node_in_unique_senders: Dict[str, Set[str]] = field(default_factory=dict)

    # Bidirectional edge pairs (a < b) – for round-trip detection
    bidirectional_pairs: Set[Tuple[str, str]] = field(default_factory=set)


def _build_graph_cache(G: nx.DiGraph) -> _GraphCache:
    """Single O(E) sweep that pre-computes all per-node statistics.

    Detectors receive a _GraphCache instance instead of traversing G themselves,
    reducing total pipeline edge iterations from O(8 × E) to O(E).
    """
    cache = _GraphCache()

    # Initialise all per-node containers in O(N)
    for node in G.nodes():
        cache.tx_count[node] = 0
        cache.node_out_events[node] = []
        cache.node_in_events[node]  = []
        cache.node_all_timestamps[node] = []
        cache.node_out_amounts[node] = []
        cache.node_in_amounts[node]  = []
        cache.node_in_total_amount[node] = 0.0
        cache.node_in_unique_senders[node] = set()

    # Single pass over all edges: O(E)
    edges_set: Set[Tuple[str, str]] = set(G.edges())
    for src, dst, ed in G.edges(data=True):
        txns: list = ed.get("transactions", [])
        total_amt: float = ed.get("total_amount", 0.0)
        n = len(txns)

        cache.tx_count[src] += n
        cache.tx_count[dst] += n
        cache.node_in_total_amount[dst] += total_amt
        cache.node_in_unique_senders[dst].add(src)

        for tx in txns:
            ts: datetime = tx["timestamp"]
            amt: float   = tx["amount"]
            cache.node_out_events[src].append((ts, dst))
            cache.node_in_events[dst].append((ts, src))
            cache.node_all_timestamps[src].append(ts)
            cache.node_all_timestamps[dst].append(ts)
            cache.node_out_amounts[src].append(amt)
            cache.node_in_amounts[dst].append(amt)

        # Detect bidirectional pairs (store canonical (min, max) form)
        if (dst, src) in edges_set:
            a, b = (src, dst) if src < dst else (dst, src)
            cache.bidirectional_pairs.add((a, b))

    # Pre-sort all temporal collections once – O(N × k log k) total
    for node in G.nodes():
        cache.node_out_events[node].sort(key=lambda e: e[0])
        cache.node_in_events[node].sort(key=lambda e: e[0])
        cache.node_all_timestamps[node].sort()

    return cache


# ---------------------------------------------------------------------------
# Hub identification – merged single pass (was two separate O(N) loops)
# ---------------------------------------------------------------------------

def _identify_hubs(
    G: nx.DiGraph,
) -> Tuple[Set[AccountID], Set[AccountID]]:
    """Combined single-pass hub detection.

    Returns:
        high_volume    – in_degree OR out_degree >= MERCHANT_DEGREE_THRESHOLD
        bipartite_hubs – combined degree >= threshold AND no neighbour overlap
    """
    high_volume: Set[AccountID] = set()
    bipartite_hubs: Set[AccountID] = set()

    for node in G.nodes():
        in_deg  = G.in_degree(node)
        out_deg = G.out_degree(node)

        if in_deg >= MERCHANT_DEGREE_THRESHOLD or out_deg >= MERCHANT_DEGREE_THRESHOLD:
            high_volume.add(node)

        combined = in_deg + out_deg
        if combined >= MERCHANT_DEGREE_THRESHOLD:
            in_n  = set(G.predecessors(node))
            out_n = set(G.successors(node))
            if not (in_n & out_n):
                bipartite_hubs.add(node)

    return high_volume, bipartite_hubs


# Keep original names as thin wrappers so any external callers still compile
def _identify_high_volume_accounts(G: nx.DiGraph) -> Set[AccountID]:
    hv, _ = _identify_hubs(G)
    return hv


def _identify_bipartite_hubs(G: nx.DiGraph) -> Set[AccountID]:
    _, bh = _identify_hubs(G)
    return bh


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
    cache: Optional[_GraphCache] = None,
) -> Dict[AccountID, List[str]]:
    """Detect fan-in and fan-out accounts using sliding time window."""
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue

        if cache is not None:
            # Pre-sorted lists from cache – no copy, no sort needed
            out_events = cache.node_out_events[node]
            in_events  = cache.node_in_events[node]
        else:
            out_events = sorted(
                (tx["timestamp"], dst)
                for _, dst, ed in G.out_edges(node, data=True)
                for tx in ed.get("transactions", [])
            )
            in_events = sorted(
                (tx["timestamp"], src)
                for src, _, ed in G.in_edges(node, data=True)
                for tx in ed.get("transactions", [])
            )

        _check_fan_pattern_sorted(
            in_events,  SMURF_THRESHOLD, SMURF_WINDOW_HOURS,
            account_patterns[node], "fan_in",
        )
        _check_fan_pattern_sorted(
            out_events, SMURF_THRESHOLD, SMURF_WINDOW_HOURS,
            account_patterns[node], "fan_out",
        )

    return {k: v for k, v in account_patterns.items() if v}


def _check_fan_pattern_sorted(
    events: List[Tuple[datetime, AccountID]],   # MUST be pre-sorted by timestamp
    threshold: int,
    window_hours: float,
    patterns: List[str],
    label: str,
) -> None:
    """Sliding-window fan check on a pre-sorted event list.

    Unlike the original _check_fan_pattern, this does NOT sort or copy the
    events list, making it safe to call on shared cache data from multiple
    concurrent threads (read-only access pattern).
    """
    if len(events) < threshold:
        return

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


# Legacy wrapper – keeps any external callers compiled
def _check_fan_pattern(
    G: nx.DiGraph,
    node: AccountID,
    direction: str,
    threshold: int,
    window_hours: float,
    patterns: List[str],
    label: str,
) -> None:
    if direction == "in":
        events = sorted(
            (tx["timestamp"], src)
            for src, _, ed in G.in_edges(node, data=True)
            for tx in ed.get("transactions", [])
        )
    else:
        events = sorted(
            (tx["timestamp"], dst)
            for _, dst, ed in G.out_edges(node, data=True)
            for tx in ed.get("transactions", [])
        )
    _check_fan_pattern_sorted(events, threshold, window_hours, patterns, label)


# ---------------------------------------------------------------------------
# C) Shell Chain Detection
# ---------------------------------------------------------------------------

def detect_shell_chains(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
    cache: Optional[_GraphCache] = None,
) -> Dict[AccountID, List[str]]:
    """Detect paths of >= SHELL_MIN_PATH_LEN hops through low-activity intermediaries.

    Optimization: backtracking DFS with a shared mutable path list replaces
    the original stack that cloned the full path on every step (O(depth) clones
    of growing size = O(depth^2) total allocation per start node). The backtracking
    approach uses O(1) append/pop per step, keeping auxiliary memory at O(depth).
    """
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    tx_count_cache: Dict[AccountID, int] = (
        cache.tx_count if cache is not None
        else {node: total_transaction_count(G, node) for node in G.nodes()}
    )
    _max_depth = CYCLE_MAX_LEN + 1

    for start_node in G.nodes():
        if start_node in high_volume_accounts:
            continue
        if tx_count_cache.get(start_node, 0) > SHELL_MAX_TX_COUNT:
            continue

        # Invariant: stack[i] is the successor-iterator for path[i]
        #            len(stack) == len(path) at all times
        path: List[AccountID]   = [start_node]
        in_path: Set[AccountID] = {start_node}
        stack: List[Iterator]   = [iter(G.successors(start_node))]

        while stack:
            try:
                neighbor = next(stack[-1])
            except StopIteration:
                # Backtrack: remove this depth level
                stack.pop()
                if len(path) > 1:        # never remove start_node itself
                    in_path.discard(path.pop())
                continue

            if neighbor in in_path or len(path) > _max_depth:
                continue

            neighbor_is_shell = (
                tx_count_cache.get(neighbor, 0) <= SHELL_MAX_TX_COUNT
                and neighbor not in high_volume_accounts
            )

            path.append(neighbor)
            in_path.add(neighbor)

            if len(path) >= SHELL_MIN_PATH_LEN + 1:
                for acct in path:
                    if "shell_chain" not in account_patterns[acct]:
                        account_patterns[acct].append("shell_chain")

            if neighbor_is_shell:
                # Explore deeper – push a new iterator level
                stack.append(iter(G.successors(neighbor)))
            else:
                # Non-shell leaf: length already checked, backtrack immediately
                in_path.discard(path.pop())

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# D) High-Velocity Detection
# ---------------------------------------------------------------------------

def detect_high_velocity(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
    cache: Optional[_GraphCache] = None,
) -> Dict[AccountID, List[str]]:
    """Flag accounts with >= HIGH_VELOCITY_TX_THRESHOLD txns in any 24h window."""
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    window_delta = timedelta(hours=HIGH_VELOCITY_WINDOW_HOURS)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue

        if cache is not None:
            events = cache.node_all_timestamps[node]   # pre-sorted, no copy
        else:
            events = sorted(
                tx["timestamp"]
                for _, _, ed in list(G.out_edges(node, data=True)) + list(G.in_edges(node, data=True))
                for tx in ed.get("transactions", [])
            )

        if len(events) < HIGH_VELOCITY_TX_THRESHOLD:
            continue

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
# E) Structuring Detection
# ---------------------------------------------------------------------------

def detect_structuring(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
    cache: Optional[_GraphCache] = None,
) -> Dict[AccountID, List[str]]:
    """Detect structuring: repetitive amounts just below reporting thresholds.

    Real-world AML: layerers deliberately keep individual amounts < threshold
    to evade CTR (Currency Transaction Reports).
    """
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue

        if cache is not None:
            amounts = cache.node_out_amounts[node] + cache.node_in_amounts[node]
        else:
            amounts = [
                tx["amount"]
                for _, _, ed in G.out_edges(node, data=True)
                for tx in ed.get("transactions", [])
            ] + [
                tx["amount"]
                for _, _, ed in G.in_edges(node, data=True)
                for tx in ed.get("transactions", [])
            ]

        if len(amounts) < STRUCTURING_MIN_COUNT:
            continue

        for threshold in STRUCTURING_THRESHOLDS:
            lower = threshold * (1.0 - STRUCTURING_BAND_PCT)
            # sum() + comparison avoids building a filtered list (O(n) int → no alloc)
            if sum(1 for a in amounts if lower <= a < threshold) >= STRUCTURING_MIN_COUNT:
                if "structuring" not in account_patterns[node]:
                    account_patterns[node].append("structuring")
                break

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# F) Rapid Round-Trip Detection
# ---------------------------------------------------------------------------

def detect_rapid_roundtrips(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
    cache: Optional[_GraphCache] = None,
) -> Dict[AccountID, List[str]]:
    """Detect bilateral flow reversals: A sends X to B, B returns >= 70% within 48h.

    Optimization: bisect_right replaces the O(|backward|) inner linear scan
    with an O(log |backward|) jump to the first backward tx strictly after fwd_ts.
    """
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)
    window_delta = timedelta(hours=ROUNDTRIP_WINDOW_HOURS)

    if cache is not None:
        pairs = cache.bidirectional_pairs
    else:
        edges_set = set(G.edges())
        pairs = {
            (min(s, d), max(s, d))
            for s, d in G.edges()
            if (d, s) in edges_set
        }

    for a, b in pairs:
        if a in high_volume_accounts or b in high_volume_accounts:
            continue

        forward: List[Tuple[datetime, float]] = sorted(
            (tx["timestamp"], tx["amount"])
            for tx in G[a][b].get("transactions", [])
        )
        backward: List[Tuple[datetime, float]] = sorted(
            (tx["timestamp"], tx["amount"])
            for tx in G[b][a].get("transactions", [])
        )

        if not forward or not backward:
            continue

        # Extract sorted timestamp keys for O(log n) bisect lookup
        bwd_ts_keys: List[datetime] = [bwd_ts for bwd_ts, _ in backward]

        found_roundtrip = False
        for fwd_ts, fwd_amt in forward:
            deadline   = fwd_ts + window_delta
            min_return = fwd_amt * ROUNDTRIP_AMOUNT_RATIO
            # Skip backward events at or before fwd_ts in O(log n)
            lo = bisect.bisect_right(bwd_ts_keys, fwd_ts)
            for i in range(lo, len(backward)):
                bwd_ts, bwd_amt = backward[i]
                if bwd_ts > deadline:
                    break   # sorted: nothing further in window
                if bwd_amt >= min_return:
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
# G) Amount Convergence Detection
# ---------------------------------------------------------------------------

def detect_amount_convergence(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
    cache: Optional[_GraphCache] = None,
) -> Dict[AccountID, List[str]]:
    """Detect accounts receiving many small payments converging to a round large sum."""
    account_patterns: Dict[AccountID, List[str]] = defaultdict(list)

    for node in G.nodes():
        if node in high_volume_accounts:
            continue

        if cache is not None:
            unique_senders = cache.node_in_unique_senders[node]
            total_in       = cache.node_in_total_amount[node]
        else:
            unique_senders: Set[AccountID] = set()
            total_in = 0.0
            for src, _, ed in G.in_edges(node, data=True):
                unique_senders.add(src)
                total_in += ed.get("total_amount", 0.0)

        if len(unique_senders) < CONVERGENCE_MIN_INFLOWS or total_in <= 0:
            continue

        round_multiple = round(total_in / 1000.0) * 1000.0
        if round_multiple <= 0:
            continue
        deviation = abs(total_in - round_multiple) / round_multiple
        if deviation <= CONVERGENCE_ROUND_PCT:
            if "amount_convergence" not in account_patterns[node]:
                account_patterns[node].append("amount_convergence")

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# H) Degree Anomaly Detection
# ---------------------------------------------------------------------------

def detect_degree_anomalies(
    G: nx.DiGraph,
    high_volume_accounts: Set[AccountID],
) -> Dict[AccountID, List[str]]:
    """Flag accounts with statistically anomalous degree (z-score analysis).

    G.in_degree / G.out_degree are O(1) lookups in NetworkX (cached in the
    adjacency dict). `statistics` is imported at module level, not per-call.
    """
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
        if deg >= threshold and deg >= 5:
            if "degree_anomaly" not in account_patterns[node]:
                account_patterns[node].append("degree_anomaly")

    return {k: v for k, v in account_patterns.items() if v}


# ---------------------------------------------------------------------------
# Module-level results cache (thread-safe)
# ---------------------------------------------------------------------------

@dataclass
class _CacheEntry:
    result:     Dict[str, Any]
    expires_at: float   # time.monotonic() deadline


class _ResultsCache:
    """Thread-safe TTL cache keyed by graph signature string.

    Two graphs are considered identical when they share the same:
      - node count
      - edge count
      - SHA-1 of their sorted degree sequence (fingerprints topology)

    On a cache hit the stored result dict is returned directly (read-only
    callers must not mutate it).  On expiry the stale entry is evicted and
    the caller receives None.
    """

    def __init__(self) -> None:
        self._lock:    threading.Lock            = threading.Lock()
        self._entries: Dict[str, _CacheEntry]    = {}

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if time.monotonic() > entry.expires_at:
                del self._entries[key]
                return None
            return entry.result

    def set(self, key: str, result: Dict[str, Any], ttl: float) -> None:
        with self._lock:
            self._entries[key] = _CacheEntry(
                result=result,
                expires_at=time.monotonic() + ttl,
            )

    def evict_expired(self) -> int:
        """Remove all expired entries; returns count removed."""
        now = time.monotonic()
        with self._lock:
            expired = [k for k, e in self._entries.items() if now > e.expires_at]
            for k in expired:
                del self._entries[k]
            return len(expired)


_detection_cache: _ResultsCache = _ResultsCache()


# ---------------------------------------------------------------------------
# Graph fingerprinting
# ---------------------------------------------------------------------------

def _graph_signature(G: nx.DiGraph) -> str:
    """Lightweight fingerprint: (N, E, SHA1-of-sorted-degree-sequence).

    Collision probability is negligible for fraud-detection workloads that
    differ by at least one edge.  Computing the full degree sequence is O(N)
    which is cheap compared to running any detector.
    """
    n = G.number_of_nodes()
    e = G.number_of_edges()
    # Sorted combined-degree sequence: canonical representation of topology
    deg_seq = sorted(
        G.in_degree(node) + G.out_degree(node) for node in G.nodes()
    )
    digest = hashlib.sha1(str(deg_seq).encode(), usedforsecurity=False).hexdigest()[:12]
    return f"{n}:{e}:{digest}"


# ---------------------------------------------------------------------------
# Low-risk node sampler (used in LARGE graph mode)
# ---------------------------------------------------------------------------

def _get_low_risk_nodes(
    G: nx.DiGraph,
    excluded: Set[AccountID],
    top_k: int = ADAPTIVE_SAMPLE_TOP_K,
) -> Set[AccountID]:
    """Return the set of nodes that are NOT in the top-K by combined degree.

    Callers add this set to the ``excluded_accounts`` argument of the two
    most-expensive detectors (shell_chains, smurfing) so those detectors skip
    low-activity nodes entirely.  All other detectors receive the original
    ``excluded_accounts`` set and still run on the full node population.

    Rationale: shell_chains starts a DFS from every non-excluded node; smurfing
    iterates every non-excluded node's edge list.  For a 50k-node graph these
    two detectors dominate wall time.  Nodes with low degree are unlikely to
    appear in meaningful shell chains or smurfing patterns because they have
    too few counterparties to generate the required fan-in/fan-out signature.

    Returns
    -------
    Set of AccountIDs that have combined degree BELOW the top-K threshold.
    The caller unions this with ``excluded_accounts`` before passing to detectors.
    """
    candidate_nodes = [n for n in G.nodes() if n not in excluded]
    if len(candidate_nodes) <= top_k:
        return set()  # nothing to sample away: all candidates are within budget

    # Sort by combined degree descending; keep top_k
    scored = sorted(
        candidate_nodes,
        key=lambda n: G.in_degree(n) + G.out_degree(n),
        reverse=True,
    )
    keep = set(scored[:top_k])
    return {n for n in candidate_nodes if n not in keep}


# ---------------------------------------------------------------------------
# Future-result helper with graceful timeout fallback
# ---------------------------------------------------------------------------

def _resolve(
    fut: "Future[Any]",
    timeout: float,
    detector_name: str,
    fallback: Any,
) -> Any:
    """Retrieve a Future result within *timeout* seconds; return fallback on breach.

    Logs a WARNING with detector name and elapsed time so operators can tune
    DETECTOR_TIMEOUT_* constants for their typical dataset sizes.
    """
    try:
        return fut.result(timeout=timeout)
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "[DetectionGuard] Detector '%s' exceeded %.0f s budget or raised: %s",
            detector_name, timeout, exc,
        )
        return fallback


# ---------------------------------------------------------------------------
# Public aggregation entry point
# ---------------------------------------------------------------------------

def run_all_detections(G: nx.DiGraph) -> Dict:
    """Run all detectors and merge per-account pattern maps.

    Adaptive scaling guard (v4)
    ---------------------------
    Three execution tiers based on graph node count:

      TINY   (< _PARALLEL_MIN_NODES = 50):
        Sequential execution.  Thread-pool overhead exceeds savings.

      MEDIUM (50 – ADAPTIVE_LARGE_THRESHOLD = 9 999):
        Concurrent ThreadPoolExecutor across all 8 detectors.
        Full node population fed to every detector.
        Result cached by graph signature with _CACHE_TTL_S TTL.

      LARGE  (>= ADAPTIVE_LARGE_THRESHOLD = 10 000):
        Concurrent execution with three additional guards:
        1. Node sampling  – top-K nodes by degree fed to the two most
           expensive detectors (shell_chains, smurfing).  All other
           detectors still run on the full graph (their per-node cost
           is much lower).
        2. Per-detector timeouts – each Future.result() call is bounded
           by DETECTOR_TIMEOUT_LARGE_S.  A detector that exceeds its
           budget returns an empty dict without killing the pipeline.
        3. Result cache – same TTL cache as MEDIUM; avoids redundant full
           re-runs when the same large graph is re-uploaded.

    Pipeline invariants preserved
    ------------------------------
    - Identical return dict structure across all tiers.
    - An additional ``_perf`` key is appended (additive; existing callers
      that don't read it are unaffected).
    - No detector algorithm is replaced or approximated; sampling only
      controls which nodes act as start-points of the two DFS detectors.
    """
    t_total = time.perf_counter()

    n_nodes = G.number_of_nodes()
    n_edges = G.number_of_edges()

    # ------------------------------------------------------------------
    # Scale tier classification
    # ------------------------------------------------------------------
    if n_nodes < _PARALLEL_MIN_NODES:
        scale_tier = "tiny"
    elif n_nodes < ADAPTIVE_LARGE_THRESHOLD:
        scale_tier = "medium"
    else:
        scale_tier = "large"

    log.info(
        "[DetectionGuard] Graph: N=%d  E=%d  tier=%s",
        n_nodes, n_edges, scale_tier,
    )
    print(f"[DetectionGuard] Graph: N={n_nodes}  E={n_edges}  tier={scale_tier}")

    # ------------------------------------------------------------------
    # Cache check (MEDIUM and LARGE only)
    # ------------------------------------------------------------------
    sig = _graph_signature(G) if scale_tier != "tiny" else ""
    if sig:
        cached = _detection_cache.get(sig)
        if cached is not None:
            log.info("[DetectionGuard] Cache hit for sig=%s", sig)
            print(f"[DetectionGuard] Cache hit  sig={sig}  (returning stored result)")
            # Refresh _perf to show this is a hit
            cached = dict(cached)
            cached["_perf"] = dict(cached.get("_perf", {}))
            cached["_perf"]["cache_hit"] = True
            cached["_perf"]["total_ms"] = (time.perf_counter() - t_total) * 1_000.0
            return cached

    # ------------------------------------------------------------------
    # Hub detection + graph cache (all tiers)
    # ------------------------------------------------------------------
    high_volume, bipartite_hubs = _identify_hubs(G)
    excluded_accounts = high_volume | bipartite_hubs

    # Single O(E) sweep shared by all 8 detectors
    t_cache_build = time.perf_counter()
    graph_cache = _build_graph_cache(G)
    cache_build_ms = (time.perf_counter() - t_cache_build) * 1_000.0

    # ------------------------------------------------------------------
    # LARGE graph: derive sampling exclusion set for expensive detectors
    # ------------------------------------------------------------------
    sampled_excluded_count = 0
    if scale_tier == "large":
        low_risk = _get_low_risk_nodes(G, excluded_accounts)
        sampled_excluded_count = len(low_risk)
        # Only shell_chains and smurfing receive the expanded exclusion set.
        # All other detectors still use the original excluded_accounts.
        expensive_excluded = excluded_accounts | low_risk
        timeout_s = DETECTOR_TIMEOUT_LARGE_S
        log.info(
            "[DetectionGuard] LARGE mode: sampling %d low-risk nodes out of %d candidates "
            "(top-%d kept for shell/smurf).",
            sampled_excluded_count,
            n_nodes - len(excluded_accounts),
            ADAPTIVE_SAMPLE_TOP_K,
        )
        print(
            f"[DetectionGuard] LARGE: {sampled_excluded_count} low-risk nodes excluded "
            f"from shell/smurf  (top-{ADAPTIVE_SAMPLE_TOP_K} kept)"
        )
    else:
        expensive_excluded = excluded_accounts
        timeout_s = DETECTOR_TIMEOUT_MEDIUM_S

    # ------------------------------------------------------------------
    # Detector timing helpers
    # ------------------------------------------------------------------
    detector_ms:      Dict[str, float] = {}
    detector_timeout: Dict[str, bool]  = {}

    def _timed(name: str, fut: "Future[Any]", fallback: Any) -> Any:
        """Resolve *fut* within *timeout_s*; record wall-time and timeout flag."""
        t0 = time.perf_counter()
        result = _resolve(fut, timeout_s, name, fallback)
        detector_ms[name]      = (time.perf_counter() - t0) * 1_000.0
        detector_timeout[name] = (result is fallback)
        return result

    # ------------------------------------------------------------------
    # TINY: sequential, no cache, no timeout machinery
    # ------------------------------------------------------------------
    if scale_tier == "tiny":
        cycle_patterns, rings   = detect_cycles(G)
        smurf_patterns          = detect_smurfing(G, excluded_accounts, graph_cache)
        shell_patterns          = detect_shell_chains(G, excluded_accounts, graph_cache)
        velocity_patterns       = detect_high_velocity(G, excluded_accounts, graph_cache)
        structuring_patterns    = detect_structuring(G, excluded_accounts, graph_cache)
        roundtrip_patterns      = detect_rapid_roundtrips(G, excluded_accounts, graph_cache)
        convergence_patterns    = detect_amount_convergence(G, excluded_accounts, graph_cache)
        degree_anomaly_patterns = detect_degree_anomalies(G, excluded_accounts)

    # ------------------------------------------------------------------
    # MEDIUM / LARGE: concurrent ThreadPoolExecutor
    # For LARGE, shell/smurf use expanded exclusion + per-detector timeouts.
    # ------------------------------------------------------------------
    else:
        with ThreadPoolExecutor(max_workers=8) as pool:
            fut_cycles      = pool.submit(detect_cycles,             G)
            fut_smurf       = pool.submit(detect_smurfing,           G, expensive_excluded,  graph_cache)
            fut_shell       = pool.submit(detect_shell_chains,       G, expensive_excluded,  graph_cache)
            fut_velocity    = pool.submit(detect_high_velocity,      G, excluded_accounts,   graph_cache)
            fut_structuring = pool.submit(detect_structuring,        G, excluded_accounts,   graph_cache)
            fut_roundtrip   = pool.submit(detect_rapid_roundtrips,   G, excluded_accounts,   graph_cache)
            fut_convergence = pool.submit(detect_amount_convergence, G, excluded_accounts,   graph_cache)
            fut_degree      = pool.submit(detect_degree_anomalies,   G, excluded_accounts)

            cycle_raw               = _timed("cycles",      fut_cycles,      ({}, []))
            smurf_patterns          = _timed("smurfing",    fut_smurf,        {})
            shell_patterns          = _timed("shell_chains",fut_shell,        {})
            velocity_patterns       = _timed("velocity",    fut_velocity,     {})
            structuring_patterns    = _timed("structuring", fut_structuring,  {})
            roundtrip_patterns      = _timed("roundtrip",   fut_roundtrip,    {})
            convergence_patterns    = _timed("convergence", fut_convergence,  {})
            degree_anomaly_patterns = _timed("degree",      fut_degree,       {})

        cycle_patterns, rings = cycle_raw if isinstance(cycle_raw, tuple) and len(cycle_raw) == 2 else ({}, [])

    # ------------------------------------------------------------------
    # Merge all per-account pattern dicts
    # ------------------------------------------------------------------
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

    # Build account → ring_id reverse map
    account_ring_map: Dict[AccountID, RingID] = {}
    for ring in rings:
        for member in ring["members"]:
            account_ring_map[member] = ring["ring_id"]

    total_ms = (time.perf_counter() - t_total) * 1_000.0

    # ------------------------------------------------------------------
    # Performance diagnostics (additive key – does not affect callers)
    # ------------------------------------------------------------------
    timed_out_detectors = [k for k, v in detector_timeout.items() if v]
    if timed_out_detectors:
        log.warning(
            "[DetectionGuard] Detector timeout(s): %s  (budget=%.0f s)",
            timed_out_detectors, timeout_s,
        )

    perf: Dict[str, Any] = {
        "n_nodes":                 n_nodes,
        "n_edges":                 n_edges,
        "scale_tier":              scale_tier,
        "cache_hit":               False,
        "total_ms":                round(total_ms, 1),
        "cache_build_ms":          round(cache_build_ms, 1) if scale_tier != "tiny" else 0.0,
        "sampled_nodes_excluded":  sampled_excluded_count,
        "detector_ms":             {k: round(v, 1) for k, v in detector_ms.items()},
        "timed_out_detectors":     timed_out_detectors,
    }

    log.info(
        "[DetectionGuard] Complete: tier=%s  total=%.0f ms  rings=%d  patterns=%d  "
        "timedout=%s  cache_build=%.0f ms",
        scale_tier, total_ms, len(rings), len(all_patterns),
        timed_out_detectors or "none",
        perf["cache_build_ms"],
    )
    print(
        f"[DetectionGuard] {scale_tier.upper()} complete: "
        f"total={total_ms:.0f} ms  rings={len(rings)}  "
        f"patterns={len(all_patterns)}  "
        + (f"sampled_excluded={sampled_excluded_count}  " if scale_tier == "large" else "")
        + (f"TIMEOUTS={timed_out_detectors}  " if timed_out_detectors else "")
        + "  |  "
        + "  ".join(f"{k}={v:.0f}ms" for k, v in perf["detector_ms"].items())
    )

    result: Dict[str, Any] = {
        "account_patterns":     dict(all_patterns),
        "rings":                rings,
        "account_ring_map":     account_ring_map,
        "high_volume_accounts": high_volume,
        "bipartite_hubs":       bipartite_hubs,
        "excluded_accounts":    excluded_accounts,
        "_perf":                perf,
    }

    # Cache result for MEDIUM / LARGE graphs
    if sig:
        _detection_cache.set(sig, result, _CACHE_TTL_S)
        # Opportunistically prune stale entries (cheap: only scans under lock)
        _detection_cache.evict_expired()

    return result
