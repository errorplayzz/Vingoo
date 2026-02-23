"""
_test_api.py – Full API integration test using FastAPI TestClient.
Run: python _test_api.py
"""
import sys, json

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Test CSV payload
# ---------------------------------------------------------------------------
CSV_BYTES = b"""transaction_id,sender_id,receiver_id,amount,timestamp
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

# ---------------------------------------------------------------------------
# 1. GET /health
# ---------------------------------------------------------------------------
print("=" * 60)
print("TEST 1: GET /health")
r = client.get("/health")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
data = r.json()
assert data["status"] == "healthy"
print(f"  PASS  status={data['status']}")

# ---------------------------------------------------------------------------
# 2. POST /analyze
# ---------------------------------------------------------------------------
print("TEST 2: POST /analyze")
r = client.post(
    "/analyze",
    files={"file": ("transactions.csv", CSV_BYTES, "text/csv")},
)
assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
body = r.json()

# Validate top-level keys
assert "suspicious_accounts" in body
assert "fraud_rings" in body
assert "summary" in body

summary = body["summary"]
print(f"  total_accounts_analyzed   : {summary['total_accounts_analyzed']}")
print(f"  suspicious_accounts_flagged: {summary['suspicious_accounts_flagged']}")
print(f"  fraud_rings_detected       : {summary['fraud_rings_detected']}")
print(f"  processing_time_seconds    : {summary['processing_time_seconds']}")

# Validate sorting: descending by suspicion_score
scores = [a["suspicion_score"] for a in body["suspicious_accounts"]]
assert scores == sorted(scores, reverse=True), "FAIL: accounts not sorted by score"
print(f"  Accounts sorted correctly: YES")

# Validate cycle detection
pattern_sets = [set(a["detected_patterns"]) for a in body["suspicious_accounts"]]
has_cycle = any("cycle_length_3" in p for p in pattern_sets)
has_fanin = any("fan_in" in p for p in pattern_sets)
assert has_cycle, "FAIL: cycle_length_3 not detected"
assert has_fanin, "FAIL: fan_in not detected"
print(f"  cycle_length_3 detected: YES")
print(f"  fan_in detected        : YES")

# Validate ring fields
for ring in body["fraud_rings"]:
    assert "ring_id" in ring
    assert "member_accounts" in ring
    assert "pattern_type" in ring
    assert "risk_score" in ring
print(f"  Fraud ring schema valid: YES ({len(body['fraud_rings'])} rings)")

print("  PASS")

# ---------------------------------------------------------------------------
# 3. GET /export  (after /analyze, should return cached result)
# ---------------------------------------------------------------------------
print("TEST 3: GET /export")
r = client.get("/export")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
export_body = r.json()
assert "suspicious_accounts" in export_body
assert export_body["summary"]["total_accounts_analyzed"] == summary["total_accounts_analyzed"]
print("  PASS  (export matches analyze result)")

# ---------------------------------------------------------------------------
# 4. POST /report
# ---------------------------------------------------------------------------
print("TEST 4: POST /report")
r = client.post(
    "/report",
    json={
        "reporter_name": "Jane Doe",
        "reporter_contact": "jane@example.com",
        "suspect_account_id": "ACC_A",
        "incident_description": "Suspicious round-trip transfers",
        "incident_date": "2024-01-10",
    },
)
assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
ack = r.json()
assert ack["status"] == "received"
assert ack["report_id"].startswith("RPT-")
print(f"  PASS  report_id={ack['report_id']}")

# ---------------------------------------------------------------------------
# 5. Error case: empty body
# ---------------------------------------------------------------------------
print("TEST 5: POST /second-chance")
r = client.post(
    "/second-chance",
    json={
        "account_id": "ACC_A",
        "requester_name": "Alice Smith",
        "requester_contact": "alice@example.com",
        "reason": "These transactions were part of a legitimate business arrangement.",
        "supporting_evidence": "Invoice #INV-2024-001",
    },
)
assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
ack = r.json()
assert ack["status"] == "pending"
assert ack["review_id"].startswith("REV-")
assert "review_deadline" in ack
assert "ACC_A" in ack["message"]
print(f"  PASS  review_id={ack['review_id']}  deadline={ack['review_deadline']}")

print("TEST 6: GET /legal-info")
r = client.get("/legal-info")
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
legal = r.json()
assert "disclaimer" in legal
assert "what_is_money_muling" in legal
assert "rights_of_flagged_account" in legal
assert "how_to_report_financial_crime" in legal
assert "legal_resources" in legal
assert "NOT constitute legal advice" in legal["disclaimer"]
print("  PASS  (all legal-info fields present, disclaimer correct)")

print("TEST 7: POST /analyze with empty file → 400")
r = client.post(
    "/analyze",
    files={"file": ("empty.csv", b"", "text/csv")},
)
assert r.status_code == 400, f"Expected 400, got {r.status_code}"
print("  PASS")

print("TEST 8: POST /analyze with missing column → 422")
bad_csv = b"sender_id,receiver_id,amount\nACC_A,ACC_B,100\n"
r = client.post(
    "/analyze",
    files={"file": ("bad.csv", bad_csv, "text/csv")},
)
assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
print("  PASS")

print("=" * 60)
print("ALL 8 API TESTS PASSED")
print("=" * 60)

# Pretty-print a sample of the analyze response
print("\nSample /analyze response (first 3 suspicious accounts):")
for acc in body["suspicious_accounts"][:3]:
    print(f"  {json.dumps(acc, indent=4)}")
