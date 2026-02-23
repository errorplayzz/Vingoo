"""
End-to-end test: POST /analyze → /admin/analyses → /admin/analysis/{id}
Run: python _test_db_e2e.py
"""
import io, sys, time
import requests

BASE = "http://localhost:8001"

CSV = (
    "transaction_id,sender_id,receiver_id,amount,timestamp\n"
    "T001,A001,A002,500,2024-01-01 10:00:00\n"
    "T002,A002,A003,500,2024-01-01 10:01:00\n"
    "T003,A003,A001,500,2024-01-01 10:02:00\n"
    "T004,B001,B002,1000,2024-01-01 11:00:00\n"
    "T005,B002,B003,1000,2024-01-01 11:01:00\n"
    "T006,B003,B001,1000,2024-01-01 11:02:00\n"
)

# ── Phase 1: /analyze ────────────────────────────────────────────────────────
r = requests.post(f"{BASE}/analyze", files={"file": ("test.csv", io.BytesIO(CSV.encode()), "text/csv")})
r.raise_for_status()
d = r.json()
suspicious = d["summary"]["suspicious_accounts_flagged"]
rings = d["summary"]["fraud_rings_detected"]
print(f"[OK]  Phase 1 /analyze  =>  suspicious={suspicious}  rings={rings}")
assert suspicious >= 3 and rings >= 1, f"Detection weak: {d['summary']}"

# ── Phase 2: /admin/analyses ─────────────────────────────────────────────────
time.sleep(0.5)
r2 = requests.get(f"{BASE}/admin/analyses?limit=5")
r2.raise_for_status()
items = r2.json()
print(f"[OK]  Phase 2 /admin/analyses  =>  {len(items)} row(s)")
assert len(items) >= 1, "No analyses in DB"
latest = items[0]
print(f"      id={latest['id']}  suspicious_flagged={latest['suspicious_flagged']}  rings_detected={latest['rings_detected']}")

# ── Phase 3: /admin/analysis/{id} ────────────────────────────────────────────
r3 = requests.get(f"{BASE}/admin/analysis/{latest['id']}")
r3.raise_for_status()
detail = r3.json()
n_accounts = len(detail.get("accounts", []))
n_rings = len(detail.get("rings", []))
print(f"[OK]  Phase 3 /admin/analysis/{latest['id'][:8]}...  =>  {n_accounts} accounts, {n_rings} rings")
assert n_accounts >= 1 and n_rings >= 1

# ── Done ──────────────────────────────────────────────────────────────────────
print()
print("=== ALL PHASES PASSED — API + DB persistence is fully operational ===")
