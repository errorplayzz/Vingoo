/**
 * sections/ResultsDashboard.jsx
 * Structured Results View:
 *  1. Executive Summary Bar â€” 5 KPI cards
 *  2. Suspicious Accounts Table â€” account_id | suspicion_score | detected_patterns | ring_id
 *     â€£ Default sort: suspicion_score desc
 *     â€£ Pattern filter pills
 *     â€£ Investigator mode: ring filter, all sorting
 *  3. Detected Fraud Rings â€” expandable cards, click â†’ highlight in graph
 */
import { useState, useMemo, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "../context/AnalysisContext";
import { useToast } from "../context/ToastContext";
import { submitSecondChance } from "../api/client";

const EASE = [0.4, 0, 0.2, 1];

/* â”€â”€â”€ Primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SortIcon({ active, dir }) {
  return (
    <span className={`inline-block ml-0.5 text-[9px] ${active ? "text-accent" : "text-slate-300"}`}>
      {active ? (dir === "desc" ? "â†“" : "â†‘") : "â†•"}
    </span>
  );
}

function ScorePill({ score }) {
  const n = Math.round(Math.max(0, Math.min(100, score)));
  const cls =
    n >= 70 ? "bg-red-50 text-red-700 border-red-200" :
    n >= 40 ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-green-50 text-green-700 border-green-200";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
      <span className="tabular-nums">{n}</span>
      <span className="hidden sm:inline text-[9px] opacity-60">/ 100</span>
    </span>
  );
}

function RoleBadge({ role }) {
  if (!role || role === 'UNCLASSIFIED') return null;
  const cfg = {
    CONTROLLER:      { label: 'Controller',     cls: 'bg-red-50 text-red-700 border-red-200' },
    MULE:            { label: 'Mule',           cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    POSSIBLE_VICTIM: { label: 'Possible Victim', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  };
  const { label, cls } = cfg[role] ?? { label: role, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center text-[9.5px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

/* ─── Integrity Seal Badge ────────────────────────────────────────────────── */
function IntegritySeal({ hash, sealedAt }) {
  if (!hash) return null;
  return (
    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-emerald-50 border border-emerald-200 text-emerald-700">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
        <path d="M6 1L2 3v3c0 2.5 1.7 4.7 4 5.4C8.3 10.7 10 8.5 10 6V3L6 1z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-[10px] font-mono font-semibold">
        SHA-256 &nbsp;·&nbsp; {hash.slice(0, 16)}&hellip;
      </span>
      {sealedAt && (
        <span className="text-[9px] text-emerald-500 hidden sm:inline">
          &nbsp;·&nbsp; sealed {sealedAt.slice(0, 19).replace('T', ' ')} UTC
        </span>
      )}
    </div>
  );
}

function RingTag({ ringId }) {
  if (!ringId) return <span className="text-[11px] text-slate-300">â€”</span>;
  return (
    <span className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md
                     bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
      {ringId}
    </span>
  );
}

/* â”€â”€â”€ Executive Summary Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SummaryBar({ result }) {
  const s = result.summary;
  const top = result.suspicious_accounts?.[0]?.suspicion_score;
  const cards = [
    { label: "Accounts analysed",   value: s.total_accounts_analyzed.toLocaleString(), icon: "ðŸ”", accent: false },
    { label: "Suspicious flagged",  value: s.suspicious_accounts_flagged,              icon: "âš ï¸", accent: s.suspicious_accounts_flagged > 0 },
    { label: "Fraud rings detected",value: s.fraud_rings_detected,                     icon: "ðŸ”—", accent: s.fraud_rings_detected > 0 },
    { label: "Processing time",     value: `${s.processing_time_seconds}s`,             icon: "â±",  accent: false },
    { label: "Highest risk score",  value: top != null ? top.toFixed(1) : "â€”",          icon: "ðŸŽ¯", accent: top != null && top >= 70 },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          className={`flex flex-col gap-1.5 p-4 rounded-2xl border bg-white
                      ${c.accent ? "border-red-200" : "border-black/[0.06]"}`}
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
        >
          <span className="text-base">{c.icon}</span>
          <span className={`text-2xl font-black tracking-tight tabular-nums
                            ${c.accent ? "text-red-600" : "text-ink"}`}>
            {c.value}
          </span>
          <span className="text-[11px] text-faint font-medium leading-tight">{c.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}
/* ─── Detection Accuracy Panel ──────────────────────────────────────────────── */

function AccuracyBar({ pct, color = "bg-accent" }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: "0%" }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

function DetectionAccuracyPanel({ result }) {
  const accounts = result.suspicious_accounts ?? [];
  const total    = result.summary.total_accounts_analyzed || 1;
  const flagged  = result.summary.suspicious_accounts_flagged;

  const patternCounts = {};
  accounts.forEach((acc) => {
    (acc.detected_patterns ?? []).forEach((p) => {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
  });

  const cycleCount    = (patternCounts["cycle_length_3"] || 0)
                      + (patternCounts["cycle_length_4"] || 0)
                      + (patternCounts["cycle_length_5"] || 0);
  const smurfCount    = patternCounts["fan_in"]        || 0;
  const shellCount    = patternCounts["shell_chain"]   || 0;
  const velocityCount = patternCounts["high_velocity"] || 0;

  const detectionRate = ((flagged / total) * 100).toFixed(2);

  const detectors = [
    { label: "Circular Routing (Cycles)",  badge: "cycle",         count: cycleCount,    color: "bg-red-500",    dot: "bg-red-500",    desc: "3–5 node closed loops" },
    { label: "Smurfing / Fan-In",          badge: "fan_in",        count: smurfCount,    color: "bg-amber-500",  dot: "bg-amber-500",  desc: "≥10 unique senders in 72 h" },
    { label: "Shell Chain Layering",       badge: "shell_chain",   count: shellCount,    color: "bg-purple-500", dot: "bg-purple-500", desc: "≥3-hop low-activity relay" },
    { label: "High-Velocity Burst",        badge: "high_velocity", count: velocityCount, color: "bg-orange-500", dot: "bg-orange-500", desc: "≥20 transactions in 24 h" },
  ];

  const high = accounts.filter((a) => a.suspicion_score >= 70).length;
  const med  = accounts.filter((a) => a.suspicion_score >= 40 && a.suspicion_score < 70).length;
  const low  = accounts.filter((a) => a.suspicion_score  < 40).length;

  return (
    <motion.div
      className="mb-10 p-6 rounded-2xl border border-black/[0.06] bg-white"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.05)" }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <p className="text-[10px] font-bold text-faint uppercase tracking-widest mb-1">Detection Accuracy</p>
          <h3 className="text-[17px] font-bold text-ink leading-tight">Pattern Coverage Report</h3>
          <p className="text-[12px] text-faint mt-1">
            Breakdown of all fraud signals detected across {total.toLocaleString()} accounts
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/[0.06] border border-accent/20 self-start sm:self-auto">
          <span className="text-3xl font-black text-accent tabular-nums">{detectionRate}%</span>
          <span className="text-[11px] text-faint font-medium leading-snug">
            detection<br />rate
          </span>
        </div>
      </div>

      {/* Per-detector bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5 mb-8">
        {detectors.map((d) => {
          const pct = flagged > 0 ? Math.round((d.count / flagged) * 100) : 0;
          return (
            <div key={d.badge}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.dot}`} />
                  <span className="text-[12px] font-semibold text-ink">{d.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-ink tabular-nums">{d.count}</span>
                  <span className="text-[10px] text-faint">accts ({pct}%)</span>
                </div>
              </div>
              <AccuracyBar pct={pct} color={d.color} />
              <p className="text-[10px] text-faint mt-1.5">{d.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Overall detection rate bar */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Overall Detection Rate
          </span>
          <span className="text-[12px] font-bold text-accent tabular-nums">{flagged} / {total.toLocaleString()}</span>
        </div>
        <AccuracyBar pct={parseFloat(detectionRate)} color="bg-accent" />
      </div>

      {/* Risk score distribution */}
      <div className="border-t border-black/[0.05] pt-5">
        <p className="text-[10px] font-bold text-faint uppercase tracking-widest mb-4">Risk Score Distribution</p>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "High Risk",     range: "score ≥ 70",            count: high,   cls: "bg-red-50 text-red-700 border-red-200" },
            { label: "Medium Risk",   range: "score 40–69",           count: med,    cls: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Low Risk",      range: "score < 40",            count: low,    cls: "bg-slate-50 text-slate-600 border-slate-200" },
            { label: "Total Flagged", range: `of ${total.toLocaleString()}`, count: flagged, cls: "bg-accent/[0.05] text-accent border-accent/20" },
          ].map((tier) => (
            <div
              key={tier.label}
              className={`flex-1 min-w-[110px] px-4 py-3.5 rounded-xl border text-center ${tier.cls}`}
            >
              <div className="text-2xl font-black tabular-nums">{tier.count}</div>
              <div className="text-[10px] font-semibold mt-0.5">{tier.label}</div>
              <div className="text-[9px] opacity-60 mt-0.5">{tier.range}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
/* â”€â”€â”€ Accounts Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* --- Review Status Badge -------------------------------------------------------- */

function ReviewStatusBadge({ status }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      Under Review
    </span>
  );
  if (status === "cleared") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
      Cleared
    </span>
  );
  if (status === "confirmed") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
      Confirmed Suspicious
    </span>
  );
  return null;
}

/* --- Review Modal (right-side slide-over) --------------------------------------- */

function ReviewModal({ account, onClose, onSubmit }) {
  const [form, setForm]       = useState({ requester_name: "", requester_contact: "", reason: "", supporting_evidence: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(null);
  const { addToast }          = useToast();

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await submitSecondChance({
        account_id:        account.account_id,
        requester_name:    form.requester_name,
        requester_contact: form.requester_contact,
        reason:            form.reason,
        ...(form.supporting_evidence ? { supporting_evidence: form.supporting_evidence } : {}),
      });
      setDone(res);
      onSubmit(account.account_id, "pending");
      addToast?.({ type: "success", message: "Review request submitted." });
    } catch (err) {
      addToast?.({ type: "error", message: err?.message ?? "Submission failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <motion.div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[420px] bg-white shadow-2xl flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-black/[0.06] flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-faint uppercase tracking-widest mb-1">Request Review</p>
            <p className="font-mono font-bold text-ink text-[15px]">{account.account_id}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <ScorePill score={account.suspicion_score} />
              {account.ring_id && <RingTag ringId={account.ring_id} />}
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 text-faint hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-black/[0.05]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4 4 8-8" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[15px] font-bold text-ink mb-1">Request Submitted</p>
            <p className="text-[12.5px] text-muted mb-4">Your review request has been logged and will be processed.</p>
            {done.review_id && (
              <p className="text-[11px] text-faint font-mono mb-1">Ref: {done.review_id}</p>
            )}
            {done.review_deadline && (
              <p className="text-[11px] text-faint">Review deadline: {done.review_deadline}</p>
            )}
            <button
              onClick={onClose}
              className="mt-6 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-accent text-white hover:bg-accent-dim transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 py-5 gap-4 overflow-y-auto">
            {(account.detected_patterns ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-faint uppercase tracking-widest mb-1.5">Flagged Patterns</p>
                <div className="flex flex-wrap gap-1">
                  {account.detected_patterns.map((p) => <PatternTag key={p} label={p} />)}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.requester_name}
                onChange={update("requester_name")}
                placeholder="Full name"
                className="w-full text-[12.5px] px-3 py-2 rounded-lg border border-black/[0.10] bg-slate-50
                           text-ink placeholder:text-faint outline-none focus:border-accent/50 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink">
                Contact Email / Phone <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.requester_contact}
                onChange={update("requester_contact")}
                placeholder="email@example.com or +60-xxx"
                className="w-full text-[12.5px] px-3 py-2 rounded-lg border border-black/[0.10] bg-slate-50
                           text-ink placeholder:text-faint outline-none focus:border-accent/50 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink">
                Reason for Review <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={form.reason}
                onChange={update("reason")}
                placeholder="Explain why this account should be reviewed..."
                className="w-full text-[12.5px] px-3 py-2 rounded-lg border border-black/[0.10] bg-slate-50
                           text-ink placeholder:text-faint outline-none focus:border-accent/50 focus:bg-white
                           transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-ink">
                Supporting Evidence{" "}
                <span className="text-[10px] font-normal text-faint">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={form.supporting_evidence}
                onChange={update("supporting_evidence")}
                placeholder="Reference IDs, transaction details, notes…"
                className="w-full text-[12.5px] px-3 py-2 rounded-lg border border-black/[0.10] bg-slate-50
                           text-ink placeholder:text-faint outline-none focus:border-accent/50 focus:bg-white
                           transition-colors resize-none"
              />
            </div>

            <div className="mt-auto pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold
                           hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting…" : "Submit Review Request"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* --- Accounts Table ------------------------------------------------------------- */

function AccountsTable({ result, investigatorMode, onRingClick, highlightedRingId }) {
  const [sortKey,       setSortKey]       = useState("suspicion_score");
  const [sortDir,       setSortDir]       = useState("desc");
  const [filterPattern, setFilterPattern] = useState("all");
  const [filterRing,    setFilterRing]    = useState("all");
  const [expandedId,    setExpandedId]    = useState(null);
  const [reviewStatuses, setReviewStatuses] = useState({});
  const [reviewModal,    setReviewModal]    = useState(null);

  const allPatterns = useMemo(() => {
    const set = new Set();
    for (const acc of result.suspicious_accounts ?? []) {
      (acc.detected_patterns ?? []).forEach((p) => set.add(p));
    }
    return ["all", ...Array.from(set).sort()];
  }, [result]);

  const allRings = useMemo(() => {
    const set = new Set();
    for (const acc of result.suspicious_accounts ?? []) {
      if (acc.ring_id) set.add(acc.ring_id);
    }
    return ["all", ...Array.from(set).sort()];
  }, [result]);

  const filtered = useMemo(() => {
    let list = result.suspicious_accounts ?? [];
    if (filterPattern !== "all") {
      list = list.filter((a) => (a.detected_patterns ?? []).includes(filterPattern));
    }
    if (filterRing !== "all") {
      list = list.filter((a) => a.ring_id === filterRing);
    }
    return [...list].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [result, filterPattern, filterRing, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <>
    <motion.div
      data-focus-target="roles"
      className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden mb-8"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
    >
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-black/[0.05] flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[12px] font-bold text-ink">Suspicious Accounts</span>
          <span className="text-[11px] text-faint">({filtered.length} shown)</span>
        </div>

        <div className="flex gap-1.5 flex-wrap ml-0 sm:ml-auto">
          {allPatterns.slice(0, 7).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPattern(p)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors duration-150
                          ${filterPattern === p
                            ? "bg-accent text-white border-accent"
                            : "bg-white text-muted border-black/[0.08] hover:border-accent/40 hover:text-accent"}`}
            >
              {p === "all" ? "All patterns" : p}
            </button>
          ))}

          {investigatorMode && allRings.length > 1 && (
            <select
              value={filterRing}
              onChange={(e) => setFilterRing(e.target.value)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-black/[0.08]
                         bg-white text-muted hover:border-accent/40 cursor-pointer outline-none"
            >
              {allRings.map((r) => (
                <option key={r} value={r}>{r === "all" ? "All rings" : r}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-black/[0.05]">
              <th className="text-left px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider whitespace-nowrap">
                Account ID
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider whitespace-nowrap">
                <button
                  onClick={() => toggleSort("suspicion_score")}
                  className="flex items-center gap-0.5 hover:text-ink transition-colors"
                >
                  Score <SortIcon active={sortKey === "suspicion_score"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider">
                Detected Patterns
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider whitespace-nowrap">
                Ring ID
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider whitespace-nowrap">
                Role
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider whitespace-nowrap">
                Action
              </th>
              {investigatorMode && (
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-faint uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={investigatorMode ? 6 : 5}
                    className="text-center text-[13px] text-faint py-10 px-5">
                  No accounts match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((acc, i) => {
                const isHighlighted = highlightedRingId && acc.ring_id === highlightedRingId;
                const isExpanded    = expandedId === acc.account_id;
                return (
                  <Fragment key={acc.account_id}>
                    <motion.tr
                      className={`border-b border-black/[0.04] last:border-0 cursor-pointer
                                  transition-colors duration-100
                                  ${isHighlighted ? "bg-amber-50" : "hover:bg-slate-50"}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i, 15) * 0.03, ease: EASE }}
                      onClick={() => setExpandedId(isExpanded ? null : acc.account_id)}
                    >
                      {/* Account ID */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="w-4 h-4 flex-shrink-0 text-faint"
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5"
                                    strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </motion.div>
                          <span className="font-mono font-semibold text-ink text-[11.5px]">
                            {acc.account_id}
                          </span>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3.5">
                        <ScorePill score={acc.suspicion_score} />
                      </td>

                      {/* Detected patterns â€” exact backend names */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(acc.detected_patterns ?? []).length > 0
                            ? acc.detected_patterns.map((p) => (
                                <PatternTag key={p} label={p} />
                              ))
                            : <span className="text-faint text-[11px]">â€”</span>
                          }
                        </div>
                      </td>

                      {/* Ring ID */}
                      <td className="px-4 py-3.5">
                        {acc.ring_id ? (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); onRingClick(acc.ring_id); }}
                            title="Highlight this ring in graph"
                            className="focus:outline-none"
                          >
                            <RingTag ringId={acc.ring_id} />
                          </button>
                        ) : (
                          <span className="text-faint text-[11px]">â€”</span>
                        )}
                      </td>
                      {/* Review action */}
                      <td className="px-4 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                        {reviewStatuses[acc.account_id] ? (
                          <ReviewStatusBadge status={reviewStatuses[acc.account_id]} />
                        ) : (
                          <button
                            onClick={() => setReviewModal(acc)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-50
                                       text-blue-700 border border-blue-200 hover:bg-blue-100
                                       transition-colors whitespace-nowrap"
                          >
                            Request Review
                          </button>
                        )}
                      </td>
                      {/* Investigator actions */}
                      {investigatorMode && (
                        <td className="px-4 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex gap-1.5">
                            <button className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-50
                                               text-green-700 border border-green-200 hover:bg-green-100
                                               transition-colors">
                              Clear
                            </button>
                            <button className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50
                                               text-red-700 border border-red-200 hover:bg-red-100
                                               transition-colors">
                              Escalate
                            </button>
                          </div>
                        </td>
                      )}
                    </motion.tr>

                    {/* Expanded explanation row */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr key={`${acc.account_id}-exp`}>
                          <td colSpan={investigatorMode ? 7 : 6} className="p-0 border-b border-black/[0.04]">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="mx-5 my-3 p-4 rounded-xl bg-slate-50 border border-black/[0.05]">
                                {acc.explanation ? (
                                  <>
                                    <p className="text-[10px] font-semibold text-faint uppercase tracking-widest mb-2">
                                      AI Explanation
                                    </p>
                                    <p className="text-[12.5px] text-muted leading-relaxed">
                                      {acc.explanation}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-[12px] text-faint italic">No explanation available.</p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                                  <span className="text-faint">
                                    Score: <span className="font-bold text-ink">{acc.suspicion_score?.toFixed(2)}</span>
                                  </span>
                                  {acc.ring_id && (
                                    <span className="text-faint">
                                      Ring: <span className="font-mono font-bold text-violet-700">{acc.ring_id}</span>
                                    </span>
                                  )}
                                  {acc.financial_role && acc.financial_role !== 'UNCLASSIFIED' && (
                                    <span className="text-faint">
                                      Role: <RoleBadge role={acc.financial_role} />
                                    </span>
                                  )}
                                  {acc.victim_probability > 0 && (
                                    <span className="text-faint text-[10px]">
                                      V:{(acc.victim_probability * 100).toFixed(0)}%
                                      &nbsp;M:{(acc.mule_probability * 100).toFixed(0)}%
                                      &nbsp;C:{(acc.controller_probability * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-black/[0.04] bg-slate-50 flex items-center justify-between">
        <p className="text-[11px] text-faint">
          {filtered.length} account{filtered.length !== 1 ? "s" : ""} shown
          {filterPattern !== "all" ? ` Â· pattern: "${filterPattern}"` : ""}
          {filterRing !== "all" ? ` Â· ring: "${filterRing}"` : ""}
        </p>
        <p className="text-[11px] text-faint hidden sm:block">
          Click row to expand Â· click ring ID to highlight in graph
        </p>
      </div>
    </motion.div>

    {/* Review slide-over */}
    <AnimatePresence>
      {reviewModal && (
        <ReviewModal
          account={reviewModal}
          onClose={() => setReviewModal(null)}
          onSubmit={(accId, status) => {
            setReviewStatuses((prev) => ({ ...prev, [accId]: status }));
            setReviewModal(null);
          }}
        />
      )}
    </AnimatePresence>
    </>
  );
}

/* â”€â”€â”€ Fraud Rings Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function RingCard({ ring, index, isHighlighted, onClick, aiSummary }) {
  const [expanded, setExpanded] = useState(false);
  const risk = ring.risk_score ?? 0;
  const barWidth = Math.min(100, Math.round(risk));
  const barColor = risk >= 70 ? "#EF4444" : risk >= 40 ? "#F59E0B" : "#22C55E";

  return (
    <motion.div
      className={`rounded-2xl border bg-white overflow-hidden transition-all duration-200
                  ${isHighlighted
                    ? "border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.28)]"
                    : "border-black/[0.06] hover:border-black/[0.12]"}`}
      style={{ boxShadow: isHighlighted ? undefined : "0 2px 10px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: EASE }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => { setExpanded((e) => !e); onClick(ring.ring_id); }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${barColor}18`, border: `1.5px solid ${barColor}40` }}>
          <span className="text-[11px] font-black tabular-nums" style={{ color: barColor }}>
            {Math.round(risk)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[12px] font-mono font-bold text-ink truncate">{ring.ring_id}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-muted capitalize">
                {ring.pattern_type?.replace(/_/g, " ") ?? "unknown"}
              </span>
              {isHighlighted && (
                <span className="text-[9.5px] font-bold text-amber-600 border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  highlighted
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.6, delay: index * 0.07 + 0.2, ease: EASE }}
              />
            </div>
            <span className="text-[10px] text-faint tabular-nums flex-shrink-0">
              {(ring.member_accounts ?? []).length} members
            </span>
          </div>
        </div>

        <motion.div
          className="w-5 h-5 flex items-center justify-center text-faint flex-shrink-0"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-black/[0.05] pt-4 bg-slate-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Ring ID",      value: ring.ring_id,                                          mono: true  },
                  { label: "Pattern",      value: ring.pattern_type?.replace(/_/g, " ") ?? "â€”",         mono: false },
                  { label: "Risk Score",   value: risk.toFixed(1),                                       mono: false },
                  { label: "Members",      value: String((ring.member_accounts ?? []).length),           mono: false },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-faint uppercase tracking-wider text-[9px] font-semibold mb-1">{f.label}</p>
                    <p className={`text-[12px] font-bold text-ink capitalize ${f.mono ? "font-mono" : ""}`}
                       style={f.label === "Risk Score" ? { color: barColor } : undefined}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-faint uppercase tracking-wider text-[9px] font-semibold mb-2">
                  Member Accounts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(ring.member_accounts ?? []).map((id) => (
                    <span key={id}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white
                                     border border-black/[0.07] text-ink">
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Ring Summary (Layer 2) */}
              {aiSummary && (
                <div className="mt-4 pt-4 border-t border-black/[0.06]">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5
                               flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    AI Investigation Summary
                  </p>
                  <p className="text-[12px] text-muted leading-relaxed">{aiSummary}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FraudRingsSection({ result, highlightedRingId, onRingClick }) {
  const rings = result.fraud_rings ?? [];

  // Build ring_id → AI summary lookup from backend Layer 2 output (must be before any early return)
  const ringSummaryMap = useMemo(() => {
    const arr = result.ring_summaries ?? [];
    return Object.fromEntries(arr.map((s) => [s.ring_id, s.summary]));
  }, [result.ring_summaries]);

  if (rings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
    >
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p className="section-label mb-1">Fraud Intelligence</p>
          <h3 className="text-[1.25rem] font-bold text-ink tracking-tight">
            Detected Fraud Rings
            <span className="ml-2 text-[1rem] font-semibold text-faint">({rings.length})</span>
          </h3>
        </div>
        {highlightedRingId && (
          <button
            onClick={() => onRingClick(null)}
            className="text-[11px] font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg
                       border border-black/[0.08] hover:border-black/[0.2] transition-all"
          >
            Clear highlight
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rings.map((ring, i) => (
          <RingCard
            key={ring.ring_id}
            ring={ring}
            index={i}
            isHighlighted={highlightedRingId === ring.ring_id}
            onClick={(id) => onRingClick(highlightedRingId === id ? null : id)}
            aiSummary={ringSummaryMap[ring.ring_id] ?? null}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] text-faint text-center">
        Click a ring card to highlight its nodes in the graph visualization
      </p>
    </motion.div>
  );
}

/* â”€â”€â”€ Main export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function ResultsDashboard() {
  const { status, result, investigatorMode, highlightedRingId, setHighlightedRingId } = useAnalysis();

  const handleRingClick = useCallback((ringId) => {
    setHighlightedRingId(ringId);
    if (ringId) {
      setTimeout(() => {
        document.getElementById("graph")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [setHighlightedRingId]);

  if (status !== "done" || !result) return null;

  return (
    <section id="results" className="bg-[#F7F8FA] border-t border-black/[0.06]"
             style={{ overflowX: "hidden" }}>
      <div className="container-wide py-20 md:py-28">

        {/* Section header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="section-label mb-2">Intelligence Report</p>
          <h2 className="section-title">
            {result.summary.suspicious_accounts_flagged} account
            {result.summary.suspicious_accounts_flagged !== 1 ? "s" : ""} flagged.
          </h2>
          <p className="text-muted text-[1rem] mt-3 max-w-xl leading-relaxed">
            Pattern analysis complete across {result.summary.total_accounts_analyzed.toLocaleString()} accounts.{" "}
            {result.summary.fraud_rings_detected > 0
              ? `${result.summary.fraud_rings_detected} fraud ring${result.summary.fraud_rings_detected !== 1 ? "s" : ""} identified.`
              : "No fraud rings detected."}
          </p>

          {/* AI Status badge */}
          {result.ai_status && (
            <div className="mt-4 inline-flex items-center gap-2">
              {result.ai_status === "active" ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1
                                 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AI Explanations Active &mdash; Claude 3.5 Sonnet via OpenRouter
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1
                                 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  AI Unavailable &mdash; rule-based explanations shown
                </span>
              )}
            </div>
          )}
          {/* Integrity Seal */}
          <IntegritySeal hash={result.integrity_hash} sealedAt={result.sealed_at} />
        </motion.div>

        {/* 1. Executive Summary Bar */}
        <SummaryBar result={result} />

        {/* 2. Detection Accuracy Panel */}
        <DetectionAccuracyPanel result={result} />

        {/* 3. Accounts Table */}
        <AccountsTable
          result={result}
          investigatorMode={investigatorMode}
          onRingClick={handleRingClick}
          highlightedRingId={highlightedRingId}
        />

        {/* 3. Fraud Rings */}
        <FraudRingsSection
          result={result}
          highlightedRingId={highlightedRingId}
          onRingClick={handleRingClick}
        />

      </div>
    </section>
  );
}
