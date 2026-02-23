"""
_test_perf.py – Performance test with ~10,000 transactions.

Generates a realistic mix of patterns and measures total processing time.
Must complete in ≤ 30 seconds to pass the RIFT 2026 constraint.
"""
import sys, time, random, io
from datetime import datetime, timedelta

sys.path.insert(0, ".")

from utils import parse_csv, build_graph
from detection import run_all_detections
from scoring import compute_suspicion_scores, compute_ring_scores, build_score_lookup

random.seed(42)

TOTAL_TRANSACTIONS = 10_000
NUM_ACCOUNTS = 800        # realistic: ~12.5 txns per account on average
NUM_RING_ACCOUNTS = 30    # small cluster forming cycles
NUM_SMURF_TARGETS = 5     # accounts that receive from many senders
SMURF_SENDERS_PER = 15    # senders per smurf target (> threshold of 10)

base_time = datetime(2024, 1, 1, 0, 0, 0)
accounts = [f"ACC_{i:05d}" for i in range(NUM_ACCOUNTS)]

rows = ["transaction_id,sender_id,receiver_id,amount,timestamp"]
tx_id = 0

# ── 1. Normal random transactions (majority of traffic) ──────────────────────
for _ in range(TOTAL_TRANSACTIONS - 500):
    s = random.choice(accounts)
    r = random.choice(accounts)
    while r == s:
        r = random.choice(accounts)
    ts = base_time + timedelta(hours=random.randint(0, 2000))
    amount = round(random.uniform(10, 5000), 2)
    rows.append(f"TX_{tx_id:06d},{s},{r},{amount},{ts.strftime('%Y-%m-%d %H:%M:%S')}")
    tx_id += 1

# ── 2. Cycles: small rings of 3–5 accounts ───────────────────────────────────
ring_accs = [f"RING_{i:03d}" for i in range(NUM_RING_ACCOUNTS)]
# Create 6 triangles
for i in range(0, 18, 3):
    a, b, c = ring_accs[i], ring_accs[i+1], ring_accs[i+2]
    ts = base_time + timedelta(hours=10)
    for src, dst in [(a, b), (b, c), (c, a)]:
        rows.append(f"TX_{tx_id:06d},{src},{dst},100.00,{ts.strftime('%Y-%m-%d %H:%M:%S')}")
        tx_id += 1

# ── 3. Smurfing: fan-in to 5 target accounts ─────────────────────────────────
smurf_targets = [f"SMURF_{i}" for i in range(NUM_SMURF_TARGETS)]
for target in smurf_targets:
    base_smurf = base_time + timedelta(hours=5)
    senders = [f"SNDR_{target}_{j}" for j in range(SMURF_SENDERS_PER)]
    for j, sender in enumerate(senders):
        ts = base_smurf + timedelta(hours=j * 2)   # all within 30h << 72h window
        rows.append(f"TX_{tx_id:06d},{sender},{target},250.00,{ts.strftime('%Y-%m-%d %H:%M:%S')}")
        tx_id += 1

# ── 4. Shell chains: P → Q → R → S → T (depth 4) ────────────────────────────
for chain_idx in range(5):
    chain = [f"SHELL_{chain_idx}_{k}" for k in range(5)]
    ts = base_time + timedelta(hours=100 + chain_idx * 5)
    for k in range(len(chain) - 1):
        rows.append(
            f"TX_{tx_id:06d},{chain[k]},{chain[k+1]},50.00,{ts.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        tx_id += 1

csv_bytes = "\n".join(rows).encode()
print(f"Generated CSV: {len(rows) - 1} transactions")

# ── Full pipeline ─────────────────────────────────────────────────────────────
t0 = time.perf_counter()

txs, _ = parse_csv(csv_bytes)
print(f"[{time.perf_counter()-t0:.3f}s] Parsed {len(txs)} transactions")

G = build_graph(txs)
print(f"[{time.perf_counter()-t0:.3f}s] Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

det = run_all_detections(G)
print(f"[{time.perf_counter()-t0:.3f}s] Detection done. Rings={len(det['rings'])}, Patterned accounts={len(det['account_patterns'])}")

sus = compute_suspicion_scores(G, det["account_patterns"], det["account_ring_map"], det["high_volume_accounts"])
print(f"[{time.perf_counter()-t0:.3f}s] Scoring done. Suspicious={len(sus)}")

rings = compute_ring_scores(det["rings"], build_score_lookup(sus), G=G)
print(f"[{time.perf_counter()-t0:.3f}s] Ring scoring done. Fraud rings={len(rings)}")

elapsed = time.perf_counter() - t0
print(f"\nTotal processing time: {elapsed:.3f}s")

if elapsed <= 30.0:
    print("PERFORMANCE PASS: ≤ 30 seconds")
else:
    print("PERFORMANCE FAIL: > 30 seconds")

# Validate cycle rings found
cycle_accs = {a.account_id for a in sus if "cycle_length_3" in a.detected_patterns}
print(f"Cycle accounts detected: {len(cycle_accs)} (expected ≥ 18)")

# Validate smurfing
smurf_accs = {a.account_id for a in sus if "fan_in" in a.detected_patterns}
print(f"Fan-in smurfing detected: {len(smurf_accs)} (expected {NUM_SMURF_TARGETS})")

# Validate shells
shell_accs = {a.account_id for a in sus if "shell_chain" in a.detected_patterns}
print(f"Shell chain accounts:     {len(shell_accs)} (expected ≥ 25)")

# Sample top 5 suspicious accounts
print("\nTop 5 suspicious accounts:")
for s in sus[:5]:
    print(f"  {s.account_id:20s}  score={s.suspicion_score:5.1f}  patterns={s.detected_patterns}")
