"""utils.py – Robust CSV parsing, validation, and graph-building utilities.

Upgrades vs v1:
- Multi-format timestamp normalisation (ISO 8601, slash formats, date-only)
- Soft validation: bad rows are skipped + reported instead of crashing
- Duplicate transaction detection and removal
- Self-transfer detection (sender == receiver)
- Amount outlier detection using IQR with optional capping
- Validation report returned alongside transactions
- Weighted graph building (amount, tx_count on edges)
"""

from __future__ import annotations

import io
import math
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import networkx as nx
import pandas as pd

from models import Transaction, ValidationReport

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS: Tuple[str, ...] = (
    "transaction_id",
    "sender_id",
    "receiver_id",
    "amount",
    "timestamp",
)

# Canonical format for all internal timestamps
CANONICAL_FMT = "%Y-%m-%d %H:%M:%S"

# Accepted input formats (tried in order)
TIMESTAMP_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M",
    "%d/%m/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
    "%Y-%m-%d",
    "%d-%m-%Y %H:%M:%S",
    "%d-%m-%Y",
]

# IQR multiplier for outlier detection (3 = very conservative; 1.5 = standard)
OUTLIER_IQR_MULTIPLIER: float = 3.0


# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------

def _parse_any_timestamp(raw: str) -> Optional[datetime]:
    """Try all known formats; return None if none match."""
    s = str(raw).strip()
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    # Last-ditch attempt: pandas parse
    try:
        return pd.to_datetime(s, utc=False).to_pydatetime().replace(tzinfo=None)
    except Exception:
        return None


def to_datetime(ts: str) -> datetime:
    """Parse canonical YYYY-MM-DD HH:MM:SS string to datetime object."""
    return datetime.strptime(ts, CANONICAL_FMT)


def hours_between(dt1: datetime, dt2: datetime) -> float:
    return abs((dt2 - dt1).total_seconds()) / 3600.0


# ---------------------------------------------------------------------------
# Amount outlier detection
# ---------------------------------------------------------------------------

def _compute_outlier_cap(amounts: List[float]) -> Optional[float]:
    """Return an upper cap based on IQR analysis, or None if dataset is too small."""
    if len(amounts) < 20:
        return None
    amounts_sorted = sorted(amounts)
    n = len(amounts_sorted)
    q1 = amounts_sorted[n // 4]
    q3 = amounts_sorted[3 * n // 4]
    iqr = q3 - q1
    if iqr <= 0:
        return None
    return q3 + OUTLIER_IQR_MULTIPLIER * iqr


# ---------------------------------------------------------------------------
# CSV parser (soft-validation mode)
# ---------------------------------------------------------------------------

def parse_csv(contents: bytes) -> Tuple[List[Transaction], ValidationReport]:
    """
    Parse raw CSV bytes into validated Transaction objects.

    Instead of raising on bad rows, skip them and accumulate a ValidationReport.
    Only raises ValueError for structural failures (missing columns, unparseable file).

    Returns:
        (transactions, validation_report)
    """
    report = ValidationReport()

    #  File parsing 
    try:
        df = pd.read_csv(io.BytesIO(contents), dtype=str)
    except Exception as exc:
        raise ValueError(f"Could not parse CSV file: {exc}") from exc

    # Normalise column names (strip whitespace, lowercase)
    df.columns = [c.strip().lower() for c in df.columns]

    #  Column validation 
    missing = set(REQUIRED_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required column(s): {sorted(missing)}")

    # Keep only required columns; ignore extras
    df = df[list(REQUIRED_COLUMNS)].copy()

    report.total_rows_received = len(df)

    #  Drop fully-null rows 
    df = df.dropna(how="all")

    #  Validate + normalise timestamps 
    bad_ts_idx: List[int] = []
    normalised_ts: List[str] = []
    for idx, raw_ts in enumerate(df["timestamp"]):
        parsed = _parse_any_timestamp(str(raw_ts) if pd.notna(raw_ts) else "")
        if parsed is None:
            bad_ts_idx.append(idx)
            normalised_ts.append("")
        else:
            normalised_ts.append(parsed.strftime(CANONICAL_FMT))

    df["timestamp"] = normalised_ts
    if bad_ts_idx:
        report.bad_timestamp_rows_dropped = len(bad_ts_idx)
        report.warnings.append(
            f"{len(bad_ts_idx)} rows dropped: unrecognisable timestamp format."
        )
        df = df.drop(df.index[bad_ts_idx]).reset_index(drop=True)

    #  Validate amounts 
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    neg_rows = df[df["amount"].isna() | (df["amount"] <= 0)]
    if not neg_rows.empty:
        report.negative_amount_rows_dropped = len(neg_rows)
        report.warnings.append(
            f"{len(neg_rows)} rows dropped: amount  0 or non-numeric."
        )
        df = df[df["amount"] > 0].reset_index(drop=True)

    #  String normalisation 
    for col in ("transaction_id", "sender_id", "receiver_id"):
        df[col] = df[col].astype(str).str.strip()

    #  Drop self-transfers 
    self_tx = df[df["sender_id"] == df["receiver_id"]]
    if not self_tx.empty:
        report.self_transfer_rows_dropped = len(self_tx)
        report.warnings.append(
            f"{len(self_tx)} rows dropped: sender_id == receiver_id (self-transfer)."
        )
        df = df[df["sender_id"] != df["receiver_id"]].reset_index(drop=True)

    #  Drop duplicate transaction IDs 
    dupes = df.duplicated(subset=["transaction_id"], keep="first")
    if dupes.any():
        n_dupes = int(dupes.sum())
        report.duplicate_rows_dropped = n_dupes
        report.warnings.append(
            f"{n_dupes} duplicate transaction_id rows dropped (kept first occurrence)."
        )
        df = df[~dupes].reset_index(drop=True)

    #  Amount outlier capping (non-destructive: cap not remove) 
    amounts_list = df["amount"].tolist()
    cap = _compute_outlier_cap(amounts_list)
    if cap is not None:
        extreme = df[df["amount"] > cap]
        if not extreme.empty:
            report.outlier_amounts_capped = len(extreme)
            df.loc[df["amount"] > cap, "amount"] = cap
            report.warnings.append(
                f"{len(extreme)} extreme amounts capped at IQR upper fence "
                f"({cap:,.2f}) to prevent score distortion."
            )

    if df.empty:
        raise ValueError(
            "No valid rows remain after validation. Check CSV format and data quality."
        )

    #  Build Transaction objects 
    transactions: List[Transaction] = []
    for _, row in df.iterrows():
        transactions.append(
            Transaction(
                transaction_id=str(row["transaction_id"]),
                sender_id=str(row["sender_id"]),
                receiver_id=str(row["receiver_id"]),
                amount=float(row["amount"]),
                timestamp=str(row["timestamp"]),
            )
        )

    report.valid_rows_used = len(transactions)
    return transactions, report


# ---------------------------------------------------------------------------
# Transaction list  NetworkX DiGraph
# ---------------------------------------------------------------------------

def build_graph(transactions: List[Transaction]) -> nx.DiGraph:
    """Build a directed weighted graph from transaction list.

    Edge attributes:
        transactions   – list of individual tx dicts
        total_amount   – sum of tx amounts (float)
        tx_count       – number of individual transactions on this edge (int)
        avg_amount     – mean transaction amount (float)
        max_amount     – maximum single transaction amount (float)
        min_amount     – minimum single transaction amount (float)
        first_ts       – earliest transaction datetime
        last_ts        – latest transaction datetime
        time_span_h    – hours between first and last tx on this edge
    """
    G = nx.DiGraph()

    for tx in transactions:
        ts_dt = datetime.strptime(tx.timestamp, CANONICAL_FMT)
        tx_record = {
            "tx_id":     tx.transaction_id,
            "amount":    tx.amount,
            "timestamp": ts_dt,
            "ts_raw":    tx.timestamp,
        }

        src, dst = tx.sender_id, tx.receiver_id

        if G.has_edge(src, dst):
            ed = G[src][dst]
            ed["transactions"].append(tx_record)
            ed["total_amount"] += tx.amount
            ed["tx_count"] += 1
            if tx.amount > ed["max_amount"]:
                ed["max_amount"] = tx.amount
            if tx.amount < ed["min_amount"]:
                ed["min_amount"] = tx.amount
            if ts_dt < ed["first_ts"]:
                ed["first_ts"] = ts_dt
            if ts_dt > ed["last_ts"]:
                ed["last_ts"] = ts_dt
            ed["time_span_h"] = (ed["last_ts"] - ed["first_ts"]).total_seconds() / 3600.0
            ed["avg_amount"] = ed["total_amount"] / ed["tx_count"]
        else:
            G.add_edge(
                src, dst,
                transactions=[tx_record],
                total_amount=tx.amount,
                tx_count=1,
                avg_amount=tx.amount,
                max_amount=tx.amount,
                min_amount=tx.amount,
                first_ts=ts_dt,
                last_ts=ts_dt,
                time_span_h=0.0,
            )

    return G


# ---------------------------------------------------------------------------
# Graph helper utilities
# ---------------------------------------------------------------------------

def get_all_timestamps_for_node(G: nx.DiGraph, account_id: str) -> List[datetime]:
    """Return all transaction timestamps (sent + received) for a node."""
    timestamps: List[datetime] = []
    for _, _, ed in G.out_edges(account_id, data=True):
        for tx in ed.get("transactions", []):
            timestamps.append(tx["timestamp"])
    for _, _, ed in G.in_edges(account_id, data=True):
        for tx in ed.get("transactions", []):
            timestamps.append(tx["timestamp"])
    return timestamps


def total_transaction_count(G: nx.DiGraph, account_id: str) -> int:
    """Total individual transactions touching a node (sender + receiver)."""
    count = 0
    for _, _, ed in G.out_edges(account_id, data=True):
        count += len(ed.get("transactions", []))
    for _, _, ed in G.in_edges(account_id, data=True):
        count += len(ed.get("transactions", []))
    return count


def get_node_amounts(G: nx.DiGraph, account_id: str) -> Tuple[float, float]:
    """Return (total_sent, total_received) for account_id."""
    sent = sum(ed.get("total_amount", 0.0) for _, _, ed in G.out_edges(account_id, data=True))
    recv = sum(ed.get("total_amount", 0.0) for _, _, ed in G.in_edges(account_id, data=True))
    return sent, recv