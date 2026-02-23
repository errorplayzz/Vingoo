"""
_test_pipeline.py – Quick smoke test for the full detection pipeline.
Run: python _test_pipeline.py
"""
import sys
import time

sys.path.insert(0, ".")

from utils import parse_csv, build_graph
from detection import run_all_detections
from scoring import compute_suspicion_scores, compute_ring_scores, build_score_lookup

# ---------------------------------------------------------------------------
# Synthetic CSV: cycle (A→B→C→A), fan-in to ACC_E, shell chain P→Q→R→S
# ---------------------------------------------------------------------------
CSV_DATA = b"""transaction_id,sender_id,receiver_id,amount,timestamp
T001,ACC_A,ACC_B,500.00,2024-01-10 09:00:00
T002,ACC_B,ACC_C,450.00,2024-01-10 10:00:00
T003,ACC_C,ACC_A,400.00,2024-01-10 11:00:00
T004,ACC_D,ACC_E,100.00,2024-01-11 08:00:00
T005,ACC_F,ACC_E,120.00,2024-01-11 08:30:00
T006,ACC_G,ACC_E,130.00,2024-01-11 09:00:00
T007,ACC_H,ACC_E,140.00,2024-01-11 09:30:00
T008,ACC_I,ACC_E,150.00,2024-01-11 10:00:00
T009,ACC_J,ACC_E,160.00,2024-01-11 10:30:00
T010,ACC_K,ACC_E,170.00,2024-01-11 11:00:00
T011,ACC_L,ACC_E,180.00,2024-01-11 11:30:00
T012,ACC_M,ACC_E,190.00,2024-01-11 12:00:00
T013,ACC_N,ACC_E,200.00,2024-01-11 12:30:00
T014,ACC_O,ACC_E,210.00,2024-01-11 13:00:00
T015,ACC_P,ACC_Q,50.00,2024-01-12 07:00:00
T016,ACC_Q,ACC_R,45.00,2024-01-12 08:00:00
T017,ACC_R,ACC_S,40.00,2024-01-12 09:00:00
"""

t0 = time.perf_counter()

# Parse
txs, _ = parse_csv(CSV_DATA)
print(f"Parsed {len(txs)} transactions")

# Build graph
G = build_graph(txs)
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

# Detect
result = run_all_detections(G)
print(f"Accounts with patterns: {sorted(result['account_patterns'].keys())}")
print(f"Rings found: {len(result['rings'])}")

# Score
sus = compute_suspicion_scores(
    G,
    result["account_patterns"],
    result["account_ring_map"],
    result["high_volume_accounts"],
)
fraud_rings = compute_ring_scores(result["rings"], build_score_lookup(sus), G=G)

elapsed = round(time.perf_counter() - t0, 4)

print(f"\nProcessing time: {elapsed}s")
print(f"Suspicious accounts ({len(sus)} total):")
for s in sus[:8]:
    print(f"  {s.account_id:12s} score={s.suspicion_score:5.1f}  patterns={s.detected_patterns}  ring={s.ring_id}")

print(f"\nFraud rings ({len(fraud_rings)} total):")
for r in fraud_rings:
    print(f"  {r.ring_id}: members={r.member_accounts}  risk={r.risk_score}")

# Assertions
assert any("cycle_length_3" in s.detected_patterns for s in sus), "FAIL: no cycle_length_3 detected"
assert any("fan_in" in s.detected_patterns for s in sus), "FAIL: no fan_in detected"

print("\nALL ASSERTIONS PASSED – pipeline is working correctly.")
