/**
 * sections/InvestigatorDashboard.jsx
 * Full investigator / admin panel — rendered only when investigatorMode is ON.
 *
 * Tabs:
 *  1. Analyses  — DB-persisted analyses; drill into accounts + rings
 *  2. Reports   — victim reports; approve / reject → reward entry
 *  3. Reviews   — second-chance requests; approve / reject
 */
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "../context/AnalysisContext";
import { useToast } from "../context/ToastContext";

const EASE = [0.4, 0, 0.2, 1];

/* ── Small primitives ─────────────────────────────────────────────────────── */

function Skeleton({ className = "" }) {
  return <div className={`rounded-lg bg-slate-100 animate-pulse ${className}`} aria-hidden />;
}

function Badge({ status }) {
  const map = {
    received: "bg-blue-50 text-blue-700 border-blue-200",
    pending:  "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50   text-red-700   border-red-200",
  };
  return (
    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      <p className="text-[12px] text-faint max-w-xs leading-relaxed">{sub}</p>
    </div>
  );
}

function ActionBtn({ label, variant, onClick, loading }) {
  const cls = variant === "approve"
    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${cls}`}
    >
      {loading ? "…" : label}
    </button>
  );
}

function RefreshBtn({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg border border-black/[0.08] hover:border-black/[0.18] transition-all disabled:opacity-40"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={loading ? "animate-spin" : ""}>
        <path d="M11 6A5 5 0 111 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M11 2v4H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {loading ? "Loading…" : "Refresh"}
    </button>
  );
}

/* ── Tab 1: Analyses ──────────────────────────────────────────────────────── */

function AnalysesTab() {
  const { adminAnalyses, adminSelectedAnalysis, setAdminSelectedAnalysis,
          adminLoading, adminError, fetchAdminData, fetchAdminAnalysisDetail } = useAnalysis();

  const handleRowClick = useCallback((id) => {
    if (adminSelectedAnalysis?.id === id) {
      setAdminSelectedAnalysis(null);
    } else {
      fetchAdminAnalysisDetail(id);
    }
  }, [adminSelectedAnalysis, setAdminSelectedAnalysis, fetchAdminAnalysisDetail]);

  const handleExport = useCallback((analysis) => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${analysis.id?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (adminLoading && !adminAnalyses.length) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="p-6 text-center">
        <p className="text-[13px] text-red-600">{adminError}</p>
        <button onClick={fetchAdminData} className="mt-3 text-[12px] text-accent hover:underline">Retry</button>
      </div>
    );
  }

  if (!adminAnalyses.length) {
    return (
      <EmptyState
        icon="🔍"
        title="No analyses yet"
        sub="Upload a CSV via the Detection Engine to start generating analysis records."
      />
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-50 border-b border-black/[0.05]">
              <th className="text-left px-4 py-3 font-semibold text-faint uppercase tracking-wider">ID</th>
              <th className="text-left px-4 py-3 font-semibold text-faint uppercase tracking-wider">Date</th>
              <th className="text-right px-4 py-3 font-semibold text-faint uppercase tracking-wider">Accounts</th>
              <th className="text-right px-4 py-3 font-semibold text-faint uppercase tracking-wider">Flagged</th>
              <th className="text-right px-4 py-3 font-semibold text-faint uppercase tracking-wider">Rings</th>
              <th className="text-right px-4 py-3 font-semibold text-faint uppercase tracking-wider">Time</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {adminAnalyses.map((a, i) => {
              const isSelected = adminSelectedAnalysis?.id === a.id;
              return (
                <motion.tr
                  key={a.id}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? "bg-accent/[0.04] border-l-2 border-l-accent" : ""}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03, ease: EASE }}
                  onClick={() => handleRowClick(a.id)}
                >
                  <td className="px-4 py-3 font-mono text-ink">{a.id?.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{a.total_accounts}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold tabular-nums ${a.suspicious_flagged > 0 ? "text-red-600" : "text-green-600"}`}>
                      {a.suspicious_flagged}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{a.rings_detected}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{a.processing_time}s</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(adminSelectedAnalysis?.id === a.id ? adminSelectedAnalysis : a); }}
                      className="text-[10px] font-semibold text-muted hover:text-ink px-2 py-1 rounded border border-black/[0.08] hover:border-black/[0.18] transition-all"
                      title="Download JSON"
                    >
                      ↓ JSON
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drill-down detail panel */}
      <AnimatePresence>
        {adminSelectedAnalysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden border-t border-black/[0.06]"
          >
            <div className="p-5 bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-ink uppercase tracking-widest">
                  Analysis Detail — {adminSelectedAnalysis.id?.slice(0, 8)}…
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport(adminSelectedAnalysis)}
                    className="text-[10px] font-semibold text-muted hover:text-ink px-2.5 py-1 rounded border border-black/[0.08] transition-all"
                  >↓ Export JSON</button>
                  <button
                    onClick={() => setAdminSelectedAnalysis(null)}
                    className="text-[10px] font-semibold text-faint hover:text-ink px-2.5 py-1 rounded border border-black/[0.08] transition-all"
                  >✕ Close</button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Accounts */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-faint uppercase tracking-wider mb-3">
                    Suspicious Accounts ({adminSelectedAnalysis.accounts?.length ?? 0})
                  </p>
                  {(adminSelectedAnalysis.accounts ?? []).length === 0 ? (
                    <p className="text-[11px] text-faint italic">No suspicious accounts recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {adminSelectedAnalysis.accounts.slice(0, 10).map((acc) => (
                        <div key={acc.account_id}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-black/[0.05]">
                          <span className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-[10px] font-black text-red-600 flex-shrink-0">
                            {Math.round(acc.suspicion_score)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-mono font-semibold text-ink truncate">{acc.account_id}</p>
                            <p className="text-[10px] text-faint truncate">
                              {(acc.detected_patterns ?? []).join(" · ") || "—"}
                            </p>
                          </div>
                          {acc.ring_id && (
                            <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-accent/[0.08] text-accent border border-accent/20 flex-shrink-0">
                              {acc.ring_id}
                            </span>
                          )}
                        </div>
                      ))}
                      {adminSelectedAnalysis.accounts.length > 10 && (
                        <p className="text-[10px] text-faint text-center py-1">
                          +{adminSelectedAnalysis.accounts.length - 10} more — download JSON for full list
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Rings */}
                <div className="lg:w-64 flex-shrink-0">
                  <p className="text-[10px] font-semibold text-faint uppercase tracking-wider mb-3">
                    Fraud Rings ({adminSelectedAnalysis.rings?.length ?? 0})
                  </p>
                  {(adminSelectedAnalysis.rings ?? []).length === 0 ? (
                    <p className="text-[11px] text-faint italic">No rings in this analysis.</p>
                  ) : (
                    <div className="space-y-2">
                      {adminSelectedAnalysis.rings.map((ring) => (
                        <div key={ring.ring_id}
                          className="p-3 rounded-lg bg-white border border-black/[0.05]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono font-bold text-ink">{ring.ring_id}</span>
                            <span className="text-[10px] font-bold text-red-600">
                              {ring.risk_score?.toFixed(0)} risk
                            </span>
                          </div>
                          <p className="text-[10px] text-faint capitalize mb-1.5">
                            {(ring.pattern_type ?? "").replace(/_/g, " ")}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(ring.member_accounts ?? []).slice(0, 4).map((m) => (
                              <span key={m} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-muted">
                                {m}
                              </span>
                            ))}
                            {(ring.member_accounts ?? []).length > 4 && (
                              <span className="text-[9px] px-1.5 py-0.5 text-faint">
                                +{ring.member_accounts.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Tab 2: Reports ───────────────────────────────────────────────────────── */

function ReportsTab() {
  const { adminReports, adminLoading, adminError, fetchAdminData,
          adminApproveReport, adminRejectReport } = useAnalysis();
  const toast = useToast();
  const [busy, setBusy] = useState({});

  const handle = useCallback(async (reportId, action) => {
    setBusy((b) => ({ ...b, [reportId]: action }));
    try {
      if (action === "approve") {
        await adminApproveReport(reportId);
        toast.success(`Report ${reportId} approved — reward entry created.`, "Approved");
      } else {
        await adminRejectReport(reportId);
        toast.info(`Report ${reportId} rejected.`, "Rejected");
      }
    } catch (err) {
      toast.error(err.detail ?? err.message ?? "Action failed.", "Error");
    } finally {
      setBusy((b) => ({ ...b, [reportId]: null }));
    }
  }, [adminApproveReport, adminRejectReport, toast]);

  if (adminLoading && !adminReports.length) {
    return <div className="space-y-3 p-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  }
  if (adminError) {
    return <div className="p-6 text-center"><p className="text-[13px] text-red-600">{adminError}</p></div>;
  }
  if (!adminReports.length) {
    return <EmptyState icon="📋" title="No reports submitted" sub="Victim fraud reports submitted via the Citizen Protection section will appear here." />;
  }

  return (
    <div className="divide-y divide-black/[0.04]">
      {adminReports.map((r, i) => (
        <motion.div
          key={r.id}
          className="px-5 py-4 hover:bg-slate-50 transition-colors"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.03, ease: EASE }}
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[12px] font-mono font-bold text-ink">{r.report_id}</span>
                <Badge status={r.status} />
                {r.status === "approved" && (
                  <span className="text-[10px] text-green-600 font-semibold">🏆 Reward created</span>
                )}
              </div>
              <p className="text-[12px] text-ink mb-0.5">
                Suspect: <span className="font-mono font-semibold">{r.suspect_account_id}</span>
              </p>
              <p className="text-[11px] text-muted mb-0.5">{r.incident_description}</p>
              <p className="text-[10px] text-faint">
                By {r.reporter_name || "Anonymous"}
                {r.reporter_contact ? ` · ${r.reporter_contact}` : ""}
                {" · " + new Date(r.submitted_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
            {r.status === "received" && (
              <div className="flex gap-2 flex-shrink-0 mt-0.5">
                <ActionBtn
                  label="Approve"
                  variant="approve"
                  loading={busy[r.report_id] === "approve"}
                  onClick={() => handle(r.report_id, "approve")}
                />
                <ActionBtn
                  label="Reject"
                  variant="reject"
                  loading={busy[r.report_id] === "reject"}
                  onClick={() => handle(r.report_id, "reject")}
                />
              </div>
            )}
            {r.reviewed_at && (
              <p className="text-[10px] text-faint flex-shrink-0 mt-1">
                Reviewed {new Date(r.reviewed_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Tab 3: Reviews ───────────────────────────────────────────────────────── */

function ReviewsTab() {
  const { adminReviews, adminLoading, adminError,
          adminApproveReview, adminRejectReview } = useAnalysis();
  const toast = useToast();
  const [busy, setBusy] = useState({});

  const handle = useCallback(async (reviewId, action) => {
    setBusy((b) => ({ ...b, [reviewId]: action }));
    try {
      if (action === "approve") {
        await adminApproveReview(reviewId);
        toast.success(`Review ${reviewId} approved — account dispute resolved.`, "Approved");
      } else {
        await adminRejectReview(reviewId);
        toast.info(`Review ${reviewId} rejected.`, "Rejected");
      }
    } catch (err) {
      toast.error(err.detail ?? err.message ?? "Action failed.", "Error");
    } finally {
      setBusy((b) => ({ ...b, [reviewId]: null }));
    }
  }, [adminApproveReview, adminRejectReview, toast]);

  if (adminLoading && !adminReviews.length) {
    return <div className="space-y-3 p-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  }
  if (adminError) {
    return <div className="p-6 text-center"><p className="text-[13px] text-red-600">{adminError}</p></div>;
  }
  if (!adminReviews.length) {
    return <EmptyState icon="⚖️" title="No review requests" sub="Second-chance dispute requests submitted via the Citizen Protection section will appear here." />;
  }

  return (
    <div className="divide-y divide-black/[0.04]">
      {adminReviews.map((r, i) => (
        <motion.div
          key={r.id}
          className="px-5 py-4 hover:bg-slate-50 transition-colors"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.03, ease: EASE }}
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[12px] font-mono font-bold text-ink">{r.review_id}</span>
                <Badge status={r.status} />
              </div>
              <p className="text-[12px] text-ink mb-0.5">
                Account: <span className="font-mono font-semibold">{r.account_id}</span>
              </p>
              <p className="text-[11px] text-muted mb-0.5">{r.reason}</p>
              {r.supporting_evidence && (
                <p className="text-[10px] text-faint mb-0.5">Evidence: {r.supporting_evidence}</p>
              )}
              <p className="text-[10px] text-faint">
                By {r.requester_name || "Unknown"}
                {r.requester_contact ? ` · ${r.requester_contact}` : ""}
                {r.review_deadline ? ` · Deadline: ${r.review_deadline}` : ""}
              </p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2 flex-shrink-0 mt-0.5">
                <ActionBtn
                  label="Approve"
                  variant="approve"
                  loading={busy[r.review_id] === "approve"}
                  onClick={() => handle(r.review_id, "approve")}
                />
                <ActionBtn
                  label="Reject"
                  variant="reject"
                  loading={busy[r.review_id] === "reject"}
                  onClick={() => handle(r.review_id, "reject")}
                />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────────────────── */

const TABS = [
  { id: "analyses", label: "Analyses",        badge: (ctx) => ctx.adminAnalyses.length },
  { id: "reports",  label: "Victim Reports",   badge: (ctx) => ctx.adminReports.filter((r) => r.status === "received").length },
  { id: "reviews",  label: "Second-Chance",    badge: (ctx) => ctx.adminReviews.filter((r) => r.status === "pending").length  },
];

export default function InvestigatorDashboard() {
  const ctx = useAnalysis();
  const { investigatorMode, fetchAdminData, adminLoading,
          adminAnalyses, adminReports, adminReviews } = ctx;
  const [tab, setTab] = useState("analyses");

  // Fetch data whenever investigator mode is activated
  useEffect(() => {
    if (investigatorMode) {
      fetchAdminData();
    }
  }, [investigatorMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!investigatorMode) return null;

  return (
    <AnimatePresence>
      <motion.section
        id="investigator"
        className="bg-[#F0F2F8] border-t border-black/[0.06]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ overflowX: "hidden" }}
      >
        <div className="container-wide py-20 md:py-24">

          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <p className="text-[11px] font-semibold text-accent uppercase tracking-widest">
                  Investigator Mode Active
                </p>
              </div>
              <h2 className="text-[1.75rem] font-black text-ink tracking-tight leading-tight">
                Admin Dashboard
              </h2>
              <p className="text-muted text-[0.9375rem] mt-2 max-w-md leading-relaxed">
                View all persisted analyses, manage victim reports and second-chance dispute reviews.
              </p>
            </div>
            <RefreshBtn onClick={fetchAdminData} loading={adminLoading} />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 mb-8">
            {[
              { label: "Total Analyses",  value: adminAnalyses.length, icon: "🔍" },
              { label: "Open Reports",    value: adminReports.filter((r) => r.status === "received").length, icon: "📋" },
              { label: "Pending Reviews", value: adminReviews.filter((r) => r.status === "pending").length,  icon: "⚖️" },
              { label: "Approved Reports",value: adminReports.filter((r) => r.status === "approved").length, icon: "✅" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="flex-1 min-w-[120px] flex flex-col gap-1 p-5 rounded-2xl border border-black/[0.06] bg-white"
                style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
              >
                <span className="text-xl mb-1">{s.icon}</span>
                <span className="text-3xl font-black text-ink tracking-tight tabular-nums">{s.value}</span>
                <span className="text-[11px] text-faint font-medium">{s.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Tab panel */}
          <motion.div
            className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden"
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
          >
            {/* Tabs */}
            <div className="flex border-b border-black/[0.06] overflow-x-auto">
              {TABS.map((t) => {
                const count = t.badge(ctx);
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative flex items-center gap-2 px-5 py-4 text-[12px] font-semibold whitespace-nowrap transition-colors duration-150 ${
                      tab === t.id
                        ? "text-ink border-b-2 border-accent bg-accent/[0.02]"
                        : "text-muted hover:text-ink hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                    {count > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        tab === t.id ? "bg-accent/10 text-accent" : "bg-slate-100 text-faint"
                      }`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab body */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                {tab === "analyses" && <AnalysesTab />}
                {tab === "reports"  && <ReportsTab />}
                {tab === "reviews"  && <ReviewsTab />}
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>
      </motion.section>
    </AnimatePresence>
  );
}
