/**
 * sections/ResultsDashboard.jsx
 * Structured Results View:
 *  1. Executive Summary Bar — 5 KPI cards
 *  2. Suspicious Accounts Table — account_id | suspicion_score | detected_patterns | ring_id
 *     â€£ Default sort: suspicion_score desc
 *     â€£ Pattern filter pills
 *     â€£ Investigator mode: ring filter, all sorting
 *  3. Detected Fraud Rings — expandable cards, click â†’ highlight in graph
 */
import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "../context/AnalysisContext";
import { useToast } from "../context/ToastContext";
import {
  INVESTIGATION_STATE,
  isStateAtLeast,
  useInvestigationState,
} from "../context/InvestigationContext";
import { submitSecondChance, submitDefense, submitReviewDecision } from "../api/client";

const E = [0.4, 0, 0.2, 1];
const EASE = E; // alias for compatibility

/* --- tiny helpers --- */
function fmt(n) { return Number(n).toLocaleString(); }
function fmtAmt(n) {
  if (!n || n === 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Number(Math.round(n)).toLocaleString()}`;
}

const PATTERN_META = {
  cycle_length_3:     { label: "Cycle \u00d73",      color: "bg-rose-50 text-rose-700 border-rose-200" },
  cycle_length_4:     { label: "Cycle \u00d74",      color: "bg-rose-50 text-rose-700 border-rose-200" },
  cycle_length_5:     { label: "Cycle \u00d75",      color: "bg-rose-50 text-rose-700 border-rose-200" },
  fan_in:             { label: "Fan-In",          color: "bg-amber-50 text-amber-700 border-amber-200" },
  shell_chain:        { label: "Shell Chain",     color: "bg-purple-50 text-purple-700 border-purple-200" },
  high_velocity:      { label: "High Velocity",  color: "bg-orange-50 text-orange-700 border-orange-200" },
  amount_convergence: { label: "Amt. Conv.",      color: "bg-sky-50 text-sky-700 border-sky-200" },
  degree_anomaly:     { label: "Degree Anom.",    color: "bg-teal-50 text-teal-700 border-teal-200" },
};
function patternMeta(p) {
  return PATTERN_META[p] ?? { label: p, color: "bg-slate-100 text-slate-600 border-slate-200" };
}

/* --- MiniProgressBar --- */
function MiniBar({ pct, color = "#6366F1", delay = 0 }) {
  return (
    <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={{ width: "0%" }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.85, delay, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

/* â”€â”€â”€ Primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SortIcon({ active, dir }) {
  return (
    <span className={`ml-0.5 text-[9px] ${active ? "text-indigo-600" : "text-slate-300"}`}>
      {active ? (dir === "desc" ? "â†“" : "â†‘") : "â†•"}
    </span>
  );
}

function ScorePill({ score }) {
  const n = Math.round(Math.max(0, Math.min(100, score)));
  const [bg, fg, bar] =
    n >= 70 ? ["bg-red-50",    "text-red-700",    "bg-red-500"]    :
    n >= 40 ? ["bg-amber-50/60",  "text-amber-700",  "bg-amber-500"]  :
              ["bg-emerald-50","text-emerald-700", "bg-emerald-500"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border
                     ${bg} ${fg}
                     ${n >= 70 ? "border-red-200" : n >= 40 ? "border-amber-200" : "border-emerald-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bar}`} />
      <span className="tabular-nums">{n}</span>
    </span>
  );
}

function RoleBadge({ role }) {
  if (!role || role === "UNCLASSIFIED") return null;
  const MAP = {
    CONTROLLER:      { label: "Controller",      cls: "bg-red-50 text-red-700 border-red-200" },
    MULE:            { label: "Mule",            cls: "bg-orange-50 text-orange-700 border-orange-200" },
    POSSIBLE_VICTIM: { label: "Possible Victim", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const { label, cls } = MAP[role] ?? { label: role, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

/* --- Atom: PatternChip --- */
function PatternChip({ p }) {
  const { label, color } = patternMeta(p);
  return (
    <span className={`inline-block text-[9.5px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
}

/* ─── Integrity Seal Badge ────────────────────────────────────────────────── */
/* --- Atom: IntegritySeal --- */
function IntegritySeal({ hash, sealedAt }) {
  if (!hash) return null;
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-emerald-50 border border-emerald-200 text-emerald-700">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
        <path d="M6 1L2 3v3c0 2.5 1.7 4.7 4 5.4C8.3 10.7 10 8.5 10 6V3L6 1z"
              stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-[10px] font-mono font-semibold">SHA-256 &middot; {hash.slice(0, 16)}&hellip;</span>
      {sealedAt && (
        <span className="text-[9px] text-emerald-500 hidden sm:inline">
          &middot; sealed {sealedAt.slice(0, 19).replace('T', ' ')} UTC
        </span>
      )}
    </div>
  );
}

/* --- Atom: RingTag --- */
function RingTag({ ringId }) {
  if (!ringId) return <span className="text-[11px] text-slate-300">&mdash;</span>;
  return (
    <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md
                     bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
      {ringId}
    </span>
  );
}

/* --- PatternTag kept as alias for PatternChip for backwards compat --- */
function PatternTag({ label }) {
  if (!label) return null;
  return <PatternChip p={label} />;
}

const KPI_CFG = [
  { icon: "\uD83D\uDCCA", bgAccent: "bg-slate-50/70",     border: "border-slate-200",  accent: "text-slate-800" },
  { icon: "\u26A0",     bgAccent: "bg-red-50/60",   border: "border-red-100",    accent: "text-red-700"   },
  { icon: "\u2B21",     bgAccent: "bg-violet-50/60",border: "border-violet-100", accent: "text-violet-700" },
  { icon: "\uD83D\uDCB0", bgAccent: "bg-emerald-50/60", border: "border-emerald-100", accent: "text-emerald-700" },
  { icon: "\uD83D\uDD25", bgAccent: "bg-red-50/60",    border: "border-red-100",    accent: "text-red-700"    },
];

function SummaryBar({ result }) {
  const s = result.summary;
  const items = [
    { label: "Total Transactions",  value: fmt(s.total_transactions || 0) },
    { label: "Accounts Flagged",    value: fmt(s.suspicious_accounts_flagged) },
    { label: "Fraud Rings",         value: s.fraud_rings_detected },
    { label: "Amount at Risk",      value: fmtAmt(s.total_suspicious_amount || 0) },
    { label: "High Risk Accounts",  value: fmt(s.high_risk_accounts || 0) },
  ];

  return (
    <div className="mb-8">
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: E }}
      >
        {items.map((item, i) => {
          const cfg = KPI_CFG[i];
          return (
            <motion.div
              key={item.label}
              className={`relative flex flex-col justify-between gap-2 p-4 rounded-2xl border
                          ${cfg.border} ${cfg.bgAccent} overflow-hidden`}
              style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07, ease: E }}
            >
              <div className="absolute -top-4 -left-4 w-14 h-14 rounded-full opacity-[0.06]
                              bg-current pointer-events-none" />
              <span className="text-base leading-none">{cfg.icon}</span>
              <div>
                <div className={`text-[1.75rem] font-black tabular-nums leading-none ${cfg.accent}`}>
                  {item.value}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1.5 leading-tight">
                  {item.label}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Metadata strip */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 px-1 items-center">
        <span className="text-[11px] text-slate-400">
          <span className="font-semibold text-slate-600">{s.processing_time_seconds}s</span> analysis time
        </span>
        {(s.detection_coverage ?? 0) > 0 && (
          <span className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-600">{(s.detection_coverage * 100).toFixed(0)}%</span> detection coverage
          </span>
        )}
        {(s.graph_density ?? 0) > 0 && (
          <span className="text-[11px] text-slate-400">
            graph density{" "}<span className="font-semibold text-slate-600">{(s.graph_density * 100).toFixed(2)}%</span>
          </span>
        )}
        {s.ml_active && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
            ML Anomaly Layer Active
          </span>
        )}
        {s.total_accounts_analyzed > 0 && (
          <span className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-600">
              {((s.suspicious_accounts_flagged / s.total_accounts_analyzed) * 100).toFixed(1)}%
            </span>{" "}flagged rate
          </span>
        )}
      </div>
    </div>
  );
}
/* ─── Detection Accuracy Panel ──────────────────────────────────────────────── */

/* --- AccuracyBar kept as internal alias for MiniBar --- */
function AccuracyBar({ pct, color = "bg-indigo-600" }) {
  const hex = color === "bg-indigo-600" ? "#6366F1"
            : color === "bg-red-500" ? "#EF4444"
            : color === "bg-amber-500" ? "#F59E0B"
            : color === "bg-purple-500" ? "#8B5CF6"
            : color === "bg-orange-500" ? "#F97316"
            : "#6366F1";
  return <MiniBar pct={pct} color={hex} />;
}

function DetectionAccuracyPanel({ result }) {
  const accounts = result.suspicious_accounts ?? [];
  const total    = result.summary.total_accounts_analyzed || 1;
  const flagged  = result.summary.suspicious_accounts_flagged;

  const patternCounts = useMemo(() => {
    const map = {};
    accounts.forEach((a) => (a.detected_patterns ?? []).forEach((p) => { map[p] = (map[p] || 0) + 1; }));
    return map;
  }, [accounts]);

  const detectors = [
    { patterns: ["cycle_length_3","cycle_length_4","cycle_length_5"],
      label: "Circular Routing", sub: "3\u20135 node closed loops", color: "#EF4444", dot: "bg-red-500" },
    { patterns: ["fan_in"],
      label: "Smurfing / Fan-In", sub: "\u226510 unique senders in 72 h", color: "#F59E0B", dot: "bg-amber-500" },
    { patterns: ["shell_chain"],
      label: "Shell Chain Layering", sub: "\u22653-hop low-activity relay", color: "#8B5CF6", dot: "bg-violet-500" },
    { patterns: ["high_velocity"],
      label: "High-Velocity Burst", sub: "\u226520 transactions in 24 h", color: "#F97316", dot: "bg-orange-500" },
  ].map((d) => ({
    ...d,
    count: d.patterns.reduce((s, p) => s + (patternCounts[p] || 0), 0),
  }));

  const rate = ((flagged / total) * 100).toFixed(2);
  const high = accounts.filter((a) => a.suspicion_score >= 70).length;
  const med  = accounts.filter((a) => a.suspicion_score >= 40 && a.suspicion_score < 70).length;
  const low  = accounts.filter((a) => a.suspicion_score  < 40).length;

  return (
    <motion.div
      className="mb-8 rounded-2xl border border-slate-200 bg-white overflow-hidden"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: E }}
    >
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
                      px-6 py-5 border-b border-slate-100">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.12em] mb-1.5">
            Detection Accuracy
          </p>
          <h3 className="text-[17px] font-bold text-slate-900 leading-tight">Pattern Coverage Report</h3>
          <p className="text-[12px] text-slate-400 mt-1">
            Across {fmt(total)} accounts &middot; {flagged} suspicious flagged
          </p>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-indigo-600 text-white
                        self-start sm:self-auto flex-shrink-0"
             style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
          <span className="text-[2rem] font-black tabular-nums leading-none">{rate}%</span>
          <span className="text-[10px] font-semibold opacity-80 leading-snug">detection<br />rate</span>
        </div>
      </div>

      {/* Detector rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 px-6 py-5">
        {detectors.map((d, idx) => {
          const pct = flagged > 0 ? Math.round((d.count / flagged) * 100) : 0;
          return (
            <div key={d.label}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.dot}`} />
                  <span className="text-[12.5px] font-semibold text-slate-700">{d.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[13px] font-bold text-slate-900 tabular-nums">{d.count}</span>
                  <span className="text-[10px] text-slate-400">({pct}%)</span>
                </div>
              </div>
              <MiniBar pct={pct} color={d.color} delay={idx * 0.08} />
              <p className="text-[10px] text-slate-400 mt-1.5">{d.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Overall detection bar */}
      <div className="px-6 pb-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
            Overall Detection Rate
          </span>
          <span className="text-[12px] font-bold text-indigo-700 tabular-nums">
            {flagged} / {fmt(total)}
          </span>
        </div>
        <MiniBar pct={parseFloat(rate)} color="#6366F1" delay={0.35} />
      </div>

      {/* Risk distribution */}
      <div className="px-6 pb-6 pt-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-3">
          Risk Score Distribution
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "High Risk",     sub: "score \u2265 70",       count: high,   ring: "ring-red-200",    bg: "bg-red-50",      num: "text-red-700"   },
            { label: "Medium Risk",   sub: "score 40\u201369",      count: med,    ring: "ring-amber-200",  bg: "bg-amber-50/60",    num: "text-amber-700" },
            { label: "Low Risk",      sub: "score < 40",            count: low,    ring: "ring-slate-200",  bg: "bg-slate-50/70",    num: "text-slate-700" },
            { label: "Total Flagged", sub: `of ${fmt(total)}`,      count: flagged,ring: "ring-indigo-200", bg: "bg-indigo-50/60",num: "text-indigo-700"},
          ].map((t) => (
            <div key={t.label}
                 className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl
                             ${t.bg} ring-1 ${t.ring} text-center`}>
              <span className={`text-[1.75rem] font-black tabular-nums leading-none ${t.num}`}>{t.count}</span>
              <span className="text-[11px] font-semibold text-slate-600 mt-1">{t.label}</span>
              <span className="text-[9.5px] text-slate-400 mt-0.5">{t.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* --- Role Intelligence Panel --- */

function RoleIntelligencePanel({ result }) {
  const accounts = result.suspicious_accounts ?? [];
  if (accounts.length === 0) return null;

  const counts = useMemo(() => {
    const c = { CONTROLLER: 0, MULE: 0, POSSIBLE_VICTIM: 0, UNCLASSIFIED: 0 };
    accounts.forEach((a) => { c[a.financial_role] = (c[a.financial_role] ?? 0) + 1; });
    return c;
  }, [accounts]);

  const total = accounts.length || 1;

  const tiers = [
    { key: "CONTROLLER",      label: "Controllers",      sub: "Orchestrators / aggregators",  color: "#EF4444", bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    ring: "ring-red-200"    },
    { key: "MULE",            label: "Money Mules",      sub: "Transit / relay nodes",         color: "#F97316", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", ring: "ring-orange-200" },
    { key: "POSSIBLE_VICTIM", label: "Possible Victims", sub: "Victim-pattern behavior",       color: "#3B82F6", bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   ring: "ring-blue-200"   },
    { key: "UNCLASSIFIED",    label: "Unclassified",     sub: "Insufficient signals",          color: "#94A3B8", bg: "bg-slate-50",  border: "border-slate-200",  text: "text-slate-500",  ring: "ring-slate-200"  },
  ];

  const segments = tiers.map((t) => ({ ...t, pct: (counts[t.key] / total) * 100 }));

  return (
    <motion.div
      className="mb-8 rounded-2xl border border-slate-200 bg-white overflow-hidden"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: E }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-slate-100">
        <div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.12em] mb-1.5">
            Financial Role Intelligence
          </p>
          <h3 className="text-[17px] font-bold text-slate-900 leading-tight">Account Role Classification</h3>
          <p className="text-[12px] text-slate-400 mt-1">
            Victims hold money &middot; Mules move money &middot; Controllers orchestrate
          </p>
        </div>
        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700
                         border border-indigo-200 self-start sm:self-auto flex-shrink-0">
          {accounts.length} accounts classified
        </span>
      </div>

      {/* Distribution bar */}
      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">Role Distribution</p>
        <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-slate-100">
          {segments.filter((s) => s.pct > 0).map((s, i) => (
            <motion.div
              key={s.key}
              style={{ background: s.color }}
              title={`${s.label}: ${counts[s.key]} (${s.pct.toFixed(1)}%)`}
              initial={{ width: 0 }}
              animate={{ width: `${s.pct}%` }}
              transition={{ duration: 0.9, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
          {tiers.map((t) => (
            <div key={t.key} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: t.color }} />
              <span className="text-slate-500 font-medium">{t.label}</span>
              <span className="font-bold text-slate-800 tabular-nums">{counts[t.key]}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{((counts[t.key] / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
        {tiers.map((t, idx) => {
          const count = counts[t.key];
          const pct   = ((count / total) * 100).toFixed(1);
          return (
            <div key={t.key} className={`flex flex-col gap-2 p-4 rounded-xl ${t.bg} ring-1 ${t.ring}`}>
              <span className={`text-[1.6rem] font-black tabular-nums leading-none ${t.text}`}>{count}</span>
              <div>
                <div className={`text-[11px] font-bold ${t.text}`}>{t.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t.sub}</div>
              </div>
              <div className="text-[10px] text-slate-400 font-medium tabular-nums">{pct}% of flagged</div>
              <MiniBar pct={parseFloat(pct)} color={t.color} delay={idx * 0.1} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* --- DefenseStatusBadge --- */

function DefenseStatusBadge({ status }) {
  if (!status || status === "FLAGGED") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
      <span className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
      ⚠ Under Investigation
    </span>
  );
  if (status === "UNDER_REVIEW") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
      Defense Under Review
    </span>
  );
  if (status === "CLEARED") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
      <span className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
      Cleared
    </span>
  );
  if (status === "ESCALATED") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
      <span className="w-1 h-1 rounded-full bg-rose-700 flex-shrink-0" />
      Escalated
    </span>
  );
  // Legacy second-chance compat
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      Defense Under Review
    </span>
  );
  if (status === "cleared") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                     bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
      Cleared
    </span>
  );
  return null;
}

/* --- Defense Modal (Right to Defense — slide-over panel) ------------------- */

function DefenseModal({ account, analysisId, onClose, onSubmit }) {
  const [defenseText, setDefenseText] = useState("");
  const [loading, setLoading]         = useState(false);
  const [done, setDone]               = useState(null);
  const { addToast }                  = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!defenseText.trim() || defenseText.trim().length < 10) return;
    setLoading(true);
    try {
      // Try new /defense endpoint first; fall back to legacy /second-chance
      let res;
      if (analysisId) {
        try {
          res = await submitDefense(analysisId, {
            account_id: account.account_id,
            defense_text: defenseText.trim(),
          });
        } catch (_) {
          // Legacy fallback
          res = await submitSecondChance({
            account_id: account.account_id,
            requester_name: "Account Holder",
            requester_contact: "",
            reason: defenseText.trim(),
          });
        }
      } else {
        res = await submitSecondChance({
          account_id: account.account_id,
          requester_name: "Account Holder",
          requester_contact: "",
          reason: defenseText.trim(),
        });
      }
      setDone(res);
      onSubmit(account.account_id, res.status === "UNDER_REVIEW" ? "UNDER_REVIEW" : "pending");
      addToast?.({ type: "success", message: "Defense statement submitted." });
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
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Right to Defense</p>
            <p className="font-mono font-bold text-slate-900 text-[15px]">{account.account_id}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <ScorePill score={account.suspicion_score} />
              {account.ring_id && <RingTag ringId={account.ring_id} />}
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 text-slate-400 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-black/[0.05]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4 4 8-8" stroke="#4f46e5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[15px] font-bold text-slate-900 mb-1">Defense Submitted</p>
            <p className="text-[12.5px] text-slate-500 mb-4">Your statement is now under review by an investigator.</p>
            <p className="text-[11px] text-slate-400 font-mono mb-4">Status: UNDER REVIEW</p>
            <button
              onClick={onClose}
              className="mt-2 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          /* Defense form */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 py-5 gap-5 overflow-y-auto">
            {/* Philosophy banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-indigo-800 mb-0.5">AI Does Not Punish. AI Provides Fair Review.</p>
              <p className="text-[11px] text-indigo-600 leading-relaxed">
                Provide a clear explanation of your account activity. An investigator will review your statement alongside the AI findings.
              </p>
            </div>

            {(account.detected_patterns ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Flagged Patterns</p>
                <div className="flex flex-wrap gap-1">
                  {account.detected_patterns.map((p) => <PatternTag key={p} label={p} />)}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-900">
                Your Defense Statement <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-slate-400">Explain the legitimate purpose of this activity (min 10 characters).</p>
              <textarea
                required
                rows={7}
                value={defenseText}
                onChange={(e) => setDefenseText(e.target.value)}
                placeholder="e.g. These transactions were payroll payments to contractors across 3 entities I manage. The high velocity dates coincide with our quarterly settlement cycle..."
                className="w-full text-[12.5px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50
                           text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:bg-white
                           transition-colors resize-none"
              />
              <p className="text-[10px] text-slate-400 text-right">{defenseText.length} chars</p>
            </div>

            <div className="mt-auto pt-2">
              <button
                type="submit"
                disabled={loading || defenseText.trim().length < 10}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold
                           hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting…" : "Submit Defense Statement"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* --- Accounts Table ------------------------------------------------------------- */

function AccountsTable({ result, analysisId, investigatorMode, onRingClick, highlightedRingId }) {
  const [sortKey,       setSortKey]       = useState("suspicion_score");
  const [sortDir,       setSortDir]       = useState("desc");
  const [filterPattern, setFilterPattern] = useState("all");
  const [filterRing,    setFilterRing]    = useState("all");
  const [expandedId,    setExpandedId]    = useState(null);
  const [reviewStatuses, setReviewStatuses] = useState({});   // local overrides
  const [reviewModal,    setReviewModal]    = useState(null);
  const [busyDecision,   setBusyDecision]   = useState({});   // { [account_id]: 'CLEAR'|'ESCALATE' }

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
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden mb-8"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
    >
      {/* Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap gap-2.5 items-center bg-slate-50/70">
        <div className="flex items-center gap-2 flex-shrink-0 mr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-[12.5px] font-bold text-slate-800">Suspicious Accounts</span>
          <span className="text-[11px] text-slate-400 font-medium">({filtered.length} shown)</span>
        </div>

        <div className="flex gap-1.5 flex-wrap ml-0 sm:ml-auto">
          {allPatterns.slice(0, 7).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPattern(p)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors duration-150
                          ${filterPattern === p
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"}`}
            >
              {p === "all" ? "All patterns" : p}
            </button>
          ))}

          {investigatorMode && allRings.length > 1 && (
            <select
              value={filterRing}
              onChange={(e) => setFilterRing(e.target.value)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-slate-200
                         bg-white text-slate-500 hover:border-indigo-300 cursor-pointer outline-none"
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
            <tr className="border-b border-slate-100 bg-white">
              <th className="text-left pl-5 pr-2 py-3 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider w-8">#</th>
              <th className="text-left px-4 py-3 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Account ID
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                <button
                  onClick={() => toggleSort("suspicion_score")}
                  className="flex items-center gap-0.5 hover:text-slate-900 transition-colors"
                >
                  Score <SortIcon active={sortKey === "suspicion_score"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Detected Patterns
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Ring ID
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Role
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Action
              </th>
              {investigatorMode && (
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={investigatorMode ? 8 : 7}
                    className="text-center text-[13px] text-slate-400 py-10 px-5">
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
                      className={`border-b border-slate-100/80 last:border-0 cursor-pointer
                                  transition-colors duration-100
                                  ${isHighlighted ? "bg-amber-50/40" : acc.suspicion_score >= 70 ? "hover:bg-red-50/30" : "hover:bg-slate-50/80"}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i, 15) * 0.03, ease: EASE }}
                      onClick={() => setExpandedId(isExpanded ? null : acc.account_id)}
                    >
                      {/* Row # */}
                      <td className="pl-5 pr-2 py-3.5">
                        <span className="text-[11px] tabular-nums text-slate-300 font-semibold">{i + 1}</span>
                      </td>
                      {/* Account ID */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="w-4 h-4 flex-shrink-0 text-slate-400"
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5"
                                    strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </motion.div>
                          <span className="font-mono font-semibold text-slate-900 text-[11.5px]">
                            {acc.account_id}
                          </span>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3.5">
                        <ScorePill score={acc.suspicion_score} />
                      </td>

                      {/* Detected patterns — exact backend names */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(acc.detected_patterns ?? []).length > 0
                            ? acc.detected_patterns.map((p) => (
                                <PatternTag key={p} label={p} />
                              ))
                            : <span className="text-slate-400 text-[11px]">—</span>
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
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <RoleBadge role={acc.financial_role} />
                      </td>
                      {/* Defense / Review action */}
                      <td className="px-4 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                        {(() => {
                          // Effective status: local override wins, else from account data
                          const effectiveStatus =
                            reviewStatuses[acc.account_id] ||
                            acc.review_status ||
                            "FLAGGED";

                          if (effectiveStatus === "UNDER_REVIEW" ||
                              effectiveStatus === "CLEARED" ||
                              effectiveStatus === "ESCALATED" ||
                              effectiveStatus === "pending" ||
                              effectiveStatus === "cleared") {
                            return <DefenseStatusBadge status={effectiveStatus} />;
                          }
                          // FLAGGED — show badge + Submit Defense button
                          return (
                            <div className="flex flex-col gap-1.5">
                              <DefenseStatusBadge status="FLAGGED" />
                              <button
                                onClick={() => setReviewModal(acc)}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50
                                           text-indigo-700 border border-indigo-200 hover:bg-indigo-100
                                           transition-colors whitespace-nowrap"
                              >
                                Submit Defense
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      {/* Investigator actions */}
                      {investigatorMode && (
                        <td className="px-4 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                          {(() => {
                            const effectiveStatus =
                              reviewStatuses[acc.account_id] ||
                              acc.review_status ||
                              "FLAGGED";
                            const isFinal = effectiveStatus === "CLEARED" || effectiveStatus === "ESCALATED";
                            if (isFinal) return <DefenseStatusBadge status={effectiveStatus} />;
                            return (
                              <div className="flex gap-1.5">
                                <button
                                  disabled={!!busyDecision[acc.account_id]}
                                  onClick={async () => {
                                    setBusyDecision((p) => ({ ...p, [acc.account_id]: "CLEAR" }));
                                    try {
                                      if (analysisId) {
                                        await submitReviewDecision(analysisId, {
                                          account_id: acc.account_id,
                                          decision: "CLEARED",
                                          notes: "Cleared by investigator",
                                        });
                                      }
                                      setReviewStatuses((prev) => ({ ...prev, [acc.account_id]: "CLEARED" }));
                                    } catch (_) {}
                                    setBusyDecision((p) => ({ ...p, [acc.account_id]: null }));
                                  }}
                                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-50
                                             text-green-700 border border-green-200 hover:bg-green-100
                                             transition-colors disabled:opacity-40"
                                >
                                  {busyDecision[acc.account_id] === "CLEAR" ? "…" : "Clear"}
                                </button>
                                <button
                                  disabled={!!busyDecision[acc.account_id]}
                                  onClick={async () => {
                                    setBusyDecision((p) => ({ ...p, [acc.account_id]: "ESCALATE" }));
                                    try {
                                      if (analysisId) {
                                        await submitReviewDecision(analysisId, {
                                          account_id: acc.account_id,
                                          decision: "ESCALATED",
                                          notes: "Escalated by investigator",
                                        });
                                      }
                                      setReviewStatuses((prev) => ({ ...prev, [acc.account_id]: "ESCALATED" }));
                                    } catch (_) {}
                                    setBusyDecision((p) => ({ ...p, [acc.account_id]: null }));
                                  }}
                                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50
                                             text-red-700 border border-red-200 hover:bg-red-100
                                             transition-colors disabled:opacity-40"
                                >
                                  {busyDecision[acc.account_id] === "ESCALATE" ? "…" : "Escalate"}
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      )}
                    </motion.tr>

                    {/* Expanded explanation row */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr key={`${acc.account_id}-exp`}>
                          <td colSpan={investigatorMode ? 8 : 7} className="p-0 border-b border-slate-100">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="mx-5 my-3 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                                {/* Explanation */}
                                <div className="p-4">
                                  {acc.explanation ? (
                                    <>
                                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                        AI Explanation
                                      </p>
                                      <p className="text-[12.5px] text-slate-600 leading-relaxed">{acc.explanation}</p>
                                    </>
                                  ) : (
                                    <p className="text-[12px] text-slate-400 italic">No explanation available.</p>
                                  )}
                                </div>

                                {/* Score breakdown */}
                                <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-3">Score Breakdown</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                      { label: "Behavioral", value: acc.behavioral_score  ?? 0, color: "#EF4444" },
                                      { label: "Graph Topo", value: acc.graph_score       ?? 0, color: "#8B5CF6" },
                                      { label: "Temporal",   value: acc.temporal_score    ?? 0, color: "#F97316" },
                                      { label: "Amount",     value: acc.amount_score      ?? 0, color: "#F59E0B" },
                                    ].map((s) => (
                                      <div key={s.label}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[10px] text-slate-500 font-medium">{s.label}</span>
                                          <span className="text-[10px] font-bold text-slate-900 tabular-nums">{s.value.toFixed(1)}</span>
                                        </div>
                                        <MiniBar pct={Math.min(s.value, 100)} color={s.color} />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Financial & meta */}
                                <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5">
                                  <span className="text-[11px] text-slate-400">
                                    Risk Tier:{" "}
                                    <span className={`font-bold ${
                                      acc.risk_tier === "CRITICAL" ? "text-red-600" :
                                      acc.risk_tier === "HIGH"     ? "text-orange-600" :
                                      acc.risk_tier === "MEDIUM"   ? "text-amber-600" : "text-slate-600"}`}>
                                      {acc.risk_tier ?? "LOW"}
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    Confidence: <span className="font-bold text-slate-800">{(acc.confidence_score ?? 0).toFixed(1)}</span>
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    Txns: <span className="font-bold text-slate-800 tabular-nums">{acc.transaction_count ?? 0}</span>
                                  </span>
                                  {(acc.total_sent ?? 0) > 0 && (
                                    <span className="text-[11px] text-slate-400">
                                      Sent: <span className="font-bold text-slate-800">{fmtAmt(acc.total_sent)}</span>
                                    </span>
                                  )}
                                  {(acc.total_received ?? 0) > 0 && (
                                    <span className="text-[11px] text-slate-400">
                                      Received: <span className="font-bold text-slate-800">{fmtAmt(acc.total_received)}</span>
                                    </span>
                                  )}
                                  {(acc.victim_probability ?? 0) > 0 && (
                                    <span className="text-[11px] text-slate-400">
                                      V:<span className="font-bold text-blue-600">{(acc.victim_probability * 100).toFixed(0)}%</span>
                                      {" "}M:<span className="font-bold text-orange-600">{(acc.mule_probability * 100).toFixed(0)}%</span>
                                      {" "}C:<span className="font-bold text-red-600">{(acc.controller_probability * 100).toFixed(0)}%</span>
                                    </span>
                                  )}
                                  {acc.investigation_priority && (
                                    <span className="text-[11px] text-slate-400">
                                      Priority:{" "}
                                      <span className={`font-bold ${
                                        acc.investigation_priority === 1 ? "text-red-600" :
                                        acc.investigation_priority === 2 ? "text-orange-600" : "text-slate-700"}` }>
                                        {acc.investigation_priority === 1 ? "Immediate" :
                                         acc.investigation_priority === 2 ? "High" :
                                         acc.investigation_priority === 3 ? "Review" : "Monitor"}
                                      </span>
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
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {filtered.length} account{filtered.length !== 1 ? "s" : ""} shown
          {filterPattern !== "all" ? ` \u00b7 pattern: "${filterPattern}"` : ""}
          {filterRing !== "all" ? ` \u00b7 ring: "${filterRing}"` : ""}
        </p>
        <p className="text-[11px] text-slate-400 hidden sm:block">
          Click row to expand · click ring ID to highlight in graph
        </p>
      </div>
    </motion.div>

    {/* Defense slide-over */}
    <AnimatePresence>
      {reviewModal && (
        <DefenseModal
          account={reviewModal}
          analysisId={analysisId}
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
                    : "border-slate-200 hover:border-slate-300"}`}
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
            <span className="text-[12px] font-mono font-bold text-slate-900 truncate">{ring.ring_id}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
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
            <span className="text-[10px] text-slate-400 tabular-nums flex-shrink-0">
              {(ring.member_accounts ?? []).length} members
            </span>
          </div>
        </div>

        <motion.div
          className="w-5 h-5 flex items-center justify-center text-slate-400 flex-shrink-0"
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
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 bg-slate-50/70">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Ring ID",        value: ring.ring_id,                                                  mono: true  },
                  { label: "Pattern",        value: ring.pattern_type?.replace(/_/g, " ") ?? "—",                 mono: false },
                  { label: "Risk Score",     value: risk.toFixed(1),                                               mono: false },
                  { label: "Members",        value: String((ring.member_accounts ?? []).length),                   mono: false },
                  { label: "Amount Cycled",  value: fmtAmt(ring.total_amount_circulated || 0),                     mono: false },
                  { label: "Cycle Count",    value: ring.cycle_count > 0 ? String(ring.cycle_count) : "—",        mono: false },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-slate-400 uppercase tracking-wider text-[9px] font-semibold mb-1">{f.label}</p>
                    <p className={`text-[12px] font-bold text-slate-900 capitalize ${f.mono ? "font-mono" : ""}`}
                       style={f.label === "Risk Score" ? { color: barColor } : undefined}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-slate-400 uppercase tracking-wider text-[9px] font-semibold mb-2">
                  Member Accounts
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(ring.member_accounts ?? []).map((id) => (
                    <span key={id}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white
                                     border border-slate-200 text-slate-900">
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Ring Summary (Layer 2) */}
              {aiSummary && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5
                               flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    AI Investigation Summary
                  </p>
                  <p className="text-[12px] text-slate-500 leading-relaxed">{aiSummary}</p>
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
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.12em] mb-1">Fraud Intelligence</p>
          <h3 className="text-[1.25rem] font-bold text-slate-900 tracking-tight">
            Detected Fraud Rings
            <span className="ml-2 text-[1rem] font-semibold text-slate-400">({rings.length})</span>
          </h3>
        </div>
        {highlightedRingId && (
          <button
            onClick={() => onRingClick(null)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg
                       border border-slate-200 hover:border-slate-400 transition-all"
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

      <p className="mt-4 text-[11px] text-slate-400 text-center">
        Click a ring card to highlight its nodes in the graph visualization
      </p>
    </motion.div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */

/* --- Data Pipeline / Validation Report panel --- */
function ValidationPanel({ result }) {
  const vr = result.validation_report;
  const md = result.ml_diagnostics;
  if (!vr && !md) return null;

  const pipeline = [
    { label: "CSV Rows Received",      value: vr?.total_rows_received      ?? "—", color: "text-slate-800" },
    { label: "Valid Rows Used",         value: vr?.valid_rows_used          ?? "—", color: "text-emerald-700" },
    { label: "Duplicates Dropped",      value: vr?.duplicate_rows_dropped   ?? 0,   color: vr?.duplicate_rows_dropped > 0 ? "text-amber-700" : "text-slate-400" },
    { label: "Self-Transfers Removed",  value: vr?.self_transfer_rows_dropped ?? 0, color: vr?.self_transfer_rows_dropped > 0 ? "text-amber-700" : "text-slate-400" },
    { label: "Bad Timestamps Dropped",  value: vr?.bad_timestamp_rows_dropped ?? 0, color: vr?.bad_timestamp_rows_dropped > 0 ? "text-red-600" : "text-slate-400" },
    { label: "Negative Amounts Dropped",value: vr?.negative_amount_rows_dropped ?? 0, color: vr?.negative_amount_rows_dropped > 0 ? "text-red-600" : "text-slate-400" },
  ];

  return (
    <motion.div
      className="mt-10"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: E }}
    >
      {/* Section divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-slate-100 via-slate-200 to-transparent" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] flex-shrink-0">
          Data Pipeline Report
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-slate-100 via-slate-200 to-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Validation Report */}
        {vr && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
               style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.12em] mb-1">
                  Ingestion Engine
                </p>
                <h4 className="text-[14px] font-bold text-slate-900">Data Validation Report</h4>
              </div>
              <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Pipeline Complete
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {pipeline.map((row) => (
                <div key={row.label}
                     className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className={`text-[1.1rem] font-black tabular-nums leading-none ${row.color}`}>
                    {typeof row.value === "number" ? fmt(row.value) : row.value}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium leading-snug">{row.label}</span>
                </div>
              ))}
            </div>
            {(vr.warnings ?? []).length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                  Validation Warnings
                </p>
                <ul className="space-y-1">
                  {vr.warnings.map((w, i) => (
                    <li key={i} className="text-[11px] text-slate-500 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ML Diagnostics */}
        {md && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
               style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-[0.12em] mb-1">
                  Anomaly Detection
                </p>
                <h4 className="text-[14px] font-bold text-slate-900">ML Layer Diagnostics</h4>
              </div>
              <span className={`text-[9.5px] font-bold px-2.5 py-1 rounded-full border ${
                md.ml_active
                  ? "bg-violet-50 text-violet-700 border-violet-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {md.ml_active ? "IsolationForest Active" : "Rule-Based Only"}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: "Avg Score Boost",  value: md.avg_score_boost != null   ? `+${Number(md.avg_score_boost).toFixed(2)}` : "—", color: "text-violet-700" },
                { label: "Model Type",       value: md.model_type ?? "IsolationForest",               color: "text-slate-700" },
                { label: "Training Latency", value: md.training_latency_ms != null ? `${md.training_latency_ms}ms` : "—", color: "text-slate-700" },
                { label: "Prediction Latency",value: md.prediction_latency_ms != null ? `${md.prediction_latency_ms}ms` : "—", color: "text-slate-700" },
              ].map((row) => (
                <div key={row.label}
                     className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className={`text-[1.1rem] font-black tabular-nums leading-none ${row.color}`}>{row.value}</span>
                  <span className="text-[10px] text-slate-400 font-medium leading-snug">{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ResultsDashboard() {
  const { status, result, investigatorMode, highlightedRingId, setHighlightedRingId } = useAnalysis();
  const { investigationState, setInvestigationState } = useInvestigationState();

  useEffect(() => {
    if (status === "done" && result) {
      setInvestigationState(INVESTIGATION_STATE.INTELLIGENCE_READY);
    }
  }, [status, result, setInvestigationState]);

  const handleRingClick = useCallback((ringId) => {
    setHighlightedRingId(ringId);
    if (ringId) {
      setTimeout(() => {
        document.getElementById("graph")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [setHighlightedRingId]);

  if (status !== "done" || !result) return null;
  if (!isStateAtLeast(investigationState, INVESTIGATION_STATE.ANALYZING)) return null;

  return (
    <motion.section
      id="results"
      className="bg-white border-t border-slate-200"
      style={{ overflowX: "hidden" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <div className="container-wide py-20">

        {/* Section header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {/* Breadcrumb row */}
          <div className="flex items-center gap-2.5 mb-5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.14em]">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M6 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Intelligence Report
            </span>
            <span className="text-slate-300 select-none">·</span>
            <span className="text-[10px] text-slate-400 font-medium tabular-nums">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="text-slate-300 select-none">·</span>
            <span className="text-[10px] text-slate-400 font-medium">
              {fmt(result.summary.total_accounts_analyzed)} accounts analyzed
            </span>
            {result.analysis_id && (
              <>
                <span className="text-slate-300 select-none">·</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium font-mono">
                  Case&nbsp;
                  <span className="text-slate-600 font-bold">#{result.analysis_id.slice(0, 8).toUpperCase()}</span>
                </span>
              </>
            )}
          </div>

          {/* Headline */}
          <h2 className="text-[2.5rem] sm:text-[3.1rem] font-black text-slate-900 leading-[1.08] tracking-tight mb-3">
            <span className="text-indigo-600">{fmt(result.summary.suspicious_accounts_flagged)}</span>{" "}
            account{result.summary.suspicious_accounts_flagged !== 1 ? "s" : ""} flagged.
          </h2>
          <p className="text-slate-500 text-[1rem] max-w-2xl leading-relaxed mb-5">
            {result.summary.fraud_rings_detected > 0
              ? `${result.summary.fraud_rings_detected} coordinated fraud ring${result.summary.fraud_rings_detected !== 1 ? "s" : ""} identified with network linkage evidence.`
              : "No coordinated fraud rings detected in this dataset."}
            {" "}All findings sealed with tamper-evident integrity hash.
          </p>

          {/* Status row: AI badge + Seal */}
          <div className="flex flex-wrap items-center gap-3">
            {result.ai_status && (
              result.ai_status === "active" ? (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-3.5 py-1.5
                                 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200
                                 shadow-[0_1px_4px_rgba(16,185,129,0.15)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  AI Active &mdash; Claude 3.5 Sonnet
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-3.5 py-1.5
                                 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  AI Unavailable &mdash; rule-based
                </span>
              )
            )}
            <IntegritySeal hash={result.integrity_hash} sealedAt={result.sealed_at} />
          </div>

          {/* Gradient rule */}
          <div className="mt-8 h-px bg-gradient-to-r from-indigo-200 via-slate-200 to-transparent rounded-full" />
        </motion.div>

        {/* 1. Executive Summary Bar */}
        <SummaryBar result={result} />

        {/* 2. Detection Accuracy Panel */}
        <DetectionAccuracyPanel result={result} />

        {/* 3. Role Intelligence */}
        <RoleIntelligencePanel result={result} />

        {/* 4. Accounts Table */}
        <AccountsTable
          result={result}
          analysisId={result.analysis_id}
          investigatorMode={investigatorMode}
          onRingClick={handleRingClick}
          highlightedRingId={highlightedRingId}
        />

        {/* 4. Fraud Rings */}
        <div className="mt-10 pt-10 border-t border-slate-100">
        <FraudRingsSection
          result={result}
          highlightedRingId={highlightedRingId}
          onRingClick={handleRingClick}
        />
        </div>

        {/* 5. Data Pipeline / Validation Report */}
        <ValidationPanel result={result} />

      </div>
    </motion.section>
  );
}
