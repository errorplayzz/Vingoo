"""
_test_ai.py – Live test for the OpenRouter AI explanation layer.
Run with:  python _test_ai.py
"""
import asyncio
import sys
sys.path.insert(0, ".")

from ai_explainer import generate_account_explanations, generate_ring_summaries

FAKE_ACCOUNTS = [
    {
        "account_id": "ACC-441",
        "suspicion_score": 94.2,
        "detected_patterns": ["cycle_length_3", "shell_chain"],
        "ring_id": "RING-001",
    },
    {
        "account_id": "ACC-112",
        "suspicion_score": 81.5,
        "detected_patterns": ["fan_in"],
        "ring_id": "RING-001",
    },
]

FAKE_RINGS = [
    {
        "ring_id": "RING-001",
        "pattern_type": "cycle",
        "member_accounts": ["ACC-441", "ACC-112", "ACC-789"],
        "risk_score": 90.0,
    },
]


async def main():
    print("Calling OpenRouter (both layers concurrently)...\n")
    acct, ring = await asyncio.gather(
        generate_account_explanations(FAKE_ACCOUNTS),
        generate_ring_summaries(FAKE_RINGS),
    )

    print("=" * 60)
    print("Layer 1 — Account Explanations")
    print("=" * 60)
    print("ai_status:", acct["ai_status"])
    for e in acct["explanations"]:
        print(f"\n  Account : {e['account_id']}")
        print(f"  Explanation:\n    {e['explanation']}")

    print()
    print("=" * 60)
    print("Layer 2 — Ring Summaries")
    print("=" * 60)
    print("ai_status:", ring["ai_status"])
    for s in ring["summaries"]:
        print(f"\n  Ring  : {s['ring_id']}")
        print(f"  Summary:\n    {s['summary']}")

    both_ok = acct["ai_status"] == "active" and ring["ai_status"] == "active"
    print()
    print("[PASS] Both AI layers active — API key is valid." if both_ok
          else "[WARN] At least one layer returned unavailable — check logs above.")


if __name__ == "__main__":
    asyncio.run(main())
