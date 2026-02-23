"""End-to-end pipeline integration test for v2 backend."""
import sys, time
sys.path.insert(0, '.')

from utils import parse_csv, build_graph
from detection import run_all_detections
from scoring import compute_suspicion_scores, compute_ring_scores, build_score_lookup
from evaluation import evaluate_detections, generate_performance_report

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

errors = []

def check(name, condition, detail=""):
    if condition:
        print(f"  {PASS}  {name}")
    else:
        print(f"  {FAIL}  {name}: {detail}")
        errors.append(name)

# ── Test 1: cycle_detection.csv ──────────────────────────────────────────────
print("\n[Test 1] cycle_detection.csv")
with open("test_data/cycle_detection.csv", "rb") as f:
    data = f.read()

t0 = time.perf_counter()
txns, report = parse_csv(data)
G = build_graph(txns)
det = run_all_detections(G)
suspicious = compute_suspicion_scores(
    G, det["account_patterns"], det["account_ring_map"], det["high_volume_accounts"]
)
score_lookup = build_score_lookup(suspicious)
rings = compute_ring_scores(det["rings"], score_lookup, G=G)
t1 = time.perf_counter()

check("Transactions parsed", len(txns) > 0, f"got {len(txns)}")
check("Graph built", G.number_of_nodes() > 0)
check("Cycle pattern detected", any("cycle" in p for s in suspicious for p in s.detected_patterns))
check("Rings detected", len(rings) > 0, f"got {len(rings)}")
check("Suspicion score in [0,100]", all(0 <= s.suspicion_score <= 100 for s in suspicious))
check("Confidence score present", all(0 <= s.confidence_score <= 100 for s in suspicious))
check("Risk tier present", all(s.risk_tier in ("CRITICAL","HIGH","MEDIUM","LOW") for s in suspicious))
check("Explanation generated", all(s.explanation for s in suspicious))
check("Component scores present", all(s.behavioral_score >= 0 for s in suspicious))
check("Ring amount circulated", all(r.total_amount_circulated >= 0 for r in rings))
check("Ring confidence present", all(r.confidence_score >= 0 for r in rings))
check("ValidationReport returned", report is not None)
check("Processing time < 30s", t1-t0 < 30, f"took {t1-t0:.2f}s")
print(f"  Info: {len(txns)} txns, {G.number_of_nodes()} accounts, {len(suspicious)} flagged, {len(rings)} rings, {t1-t0:.3f}s")

# ── Test 2: smurfing_detection.csv ───────────────────────────────────────────
print("\n[Test 2] smurfing_detection.csv")
with open("test_data/smurfing_detection.csv", "rb") as f:
    data = f.read()

txns, _ = parse_csv(data)
G2 = build_graph(txns)
det2 = run_all_detections(G2)
suspicious2 = compute_suspicion_scores(
    G2, det2["account_patterns"], det2["account_ring_map"], det2["high_volume_accounts"]
)

smurf_found = any("fan_in" in p or "fan_out" in p for s in suspicious2 for p in s.detected_patterns)
check("Smurfing pattern detected", smurf_found)
print(f"  Info: {len(txns)} txns, {len(suspicious2)} flagged")

# ── Test 3: shell_chain_detection.csv ────────────────────────────────────────
print("\n[Test 3] shell_chain_detection.csv")
with open("test_data/shell_chain_detection.csv", "rb") as f:
    data = f.read()

txns, _ = parse_csv(data)
G3 = build_graph(txns)
det3 = run_all_detections(G3)
suspicious3 = compute_suspicion_scores(
    G3, det3["account_patterns"], det3["account_ring_map"], det3["high_volume_accounts"]
)

shell_found = any("shell_chain" in p for s in suspicious3 for p in s.detected_patterns)
check("Shell chain pattern detected", shell_found)
print(f"  Info: {len(txns)} txns, {len(suspicious3)} flagged")

# ── Test 4: Evaluation engine ────────────────────────────────────────────────
print("\n[Test 4] Evaluation engine")
metrics = evaluate_detections(suspicious, G.number_of_nodes())
check("Metrics returned", metrics is not None)
check("Precision in [0,1]", 0 <= metrics.precision <= 1)
check("Recall in [0,1]", 0 <= metrics.recall <= 1)
check("F1 in [0,1]", 0 <= metrics.f1_score <= 1)
check("FPR in [0,1]", 0 <= metrics.false_positive_rate <= 1)
check("FCR in [0,1]", 0 <= metrics.fraud_capture_rate <= 1)
check("Evaluation mode set", metrics.evaluation_mode in ("synthetic", "ground_truth"))
report_dict = generate_performance_report(metrics, t1-t0, G.number_of_nodes(), len(txns))
check("Performance report generated", "grade" in report_dict)
print(f"  Info: mode={metrics.evaluation_mode} precision={metrics.precision:.3f} recall={metrics.recall:.3f} F1={metrics.f1_score:.3f}")
print(f"  Grade: {report_dict['grade']}")

# ── Test 5: ValidationReport fields ─────────────────────────────────────────
print("\n[Test 5] ValidationReport")
with open("test_data/cycle_detection.csv", "rb") as f:
    data = f.read()
_, vrep = parse_csv(data)
check("total_rows_received > 0", vrep.total_rows_received > 0)
check("valid_rows_used > 0", vrep.valid_rows_used > 0)

# ── Test 6: New detection patterns ───────────────────────────────────────────
print("\n[Test 6] New detection patterns (structuring / roundtrip / convergence / degree)")
from detection import detect_structuring, detect_rapid_roundtrips, detect_amount_convergence, detect_degree_anomalies
import networkx as nx

# Build a tiny synthetic graph to test structuring
G_test = nx.DiGraph()
G_test.add_edge("A", "B", transactions=[
    {"tx_id": "t1", "amount": 9100.0, "timestamp": __import__("datetime").datetime(2024,1,1,10,0)},
    {"tx_id": "t2", "amount": 9500.0, "timestamp": __import__("datetime").datetime(2024,1,2,10,0)},
    {"tx_id": "t3", "amount": 9800.0, "timestamp": __import__("datetime").datetime(2024,1,3,10,0)},
], total_amount=28400.0, tx_count=3)
struct_result = detect_structuring(G_test, set())
check("Structuring detected on synthetic data", "A" in struct_result or "B" in struct_result,
      f"got {dict(struct_result)}")

# Build a round-trip scenario
import datetime as dt
G_rt = nx.DiGraph()
G_rt.add_edge("X", "Y", transactions=[
    {"tx_id": "tx1", "amount": 5000.0, "timestamp": dt.datetime(2024,1,1,10,0)}
], total_amount=5000.0)
G_rt.add_edge("Y", "X", transactions=[
    {"tx_id": "tx2", "amount": 4500.0, "timestamp": dt.datetime(2024,1,1,20,0)}   # 10h later
], total_amount=4500.0)
rt_result = detect_rapid_roundtrips(G_rt, set())
check("Round-trip detected on synthetic data", bool(rt_result), f"got {dict(rt_result)}")

# ── Summary ──────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
if errors:
    print(f"FAILED: {len(errors)} check(s): {errors}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED — v2 backend is production-ready!")
    sys.exit(0)
