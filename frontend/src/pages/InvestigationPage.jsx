/**
 * pages/InvestigationPage.jsx
 * Route: /investigation/:analysisId
 */

import { lazy, Suspense, memo, useEffect, useMemo } from "react";
import { useParams, useNavigate }                   from "react-router-dom";
import { motion, AnimatePresence }                  from "framer-motion";
import { useAnalysisState, useAnalysisActions }     from "../context/AnalysisContext";
import { useAdminAnalysisDetail }                   from "../hooks/useAdminData";
import { generateExplanations }                     from "../utils/explainer";
import Navbar                                       from "../components/Navbar";
import Footer                                       from "../sections/Footer";
import { useInvestigationPhase, PHASE, isPhaseAtLeast } from "../intelligence/useInvestigationPhase";
import EventNotification                                from "../intelligence/EventNotification";

const ResultsDashboard = lazy(() => import("../sections/ResultsDashboard"));
const GraphViz         = lazy(() => import("../sections/GraphViz"));

const EASE = [0.22, 1, 0.36, 1];

const SectionFallback = memo(() => (
  <div className="w-full py-20 flex items-center justify-center" aria-hidden>
    <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin" />
  </div>
));

/* -- Loading state ---------------------------------------------------------- */
function LoadingWorkspace({ analysisId }) {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <div className="container-wide pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="max-w-xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border"
            style={{ background: "rgba(59,130,246,0.07)", borderColor: "rgba(59,130,246,0.18)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
            <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-blue-500">Loading Investigation</span>
          </div>
          <h1 className="text-[1.75rem] font-black tracking-tight mb-2" style={{ color: "#0F172A" }}>
            Restoring workspace…
          </h1>
          <p className="text-[0.9375rem] leading-relaxed mb-10" style={{ color: "#64748B" }}>
            Fetching analysis{" "}
            <span className="font-mono font-semibold" style={{ color: "#0F172A" }}>
              {analysisId.slice(0, 8)}…
            </span>{" "}
            from the intelligence database.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-50 border border-slate-200 animate-pulse" />
            ))}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}

/* -- Error state ------------------------------------------------------------- */
function ErrorWorkspace({ analysisId, message }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <div className="container-wide pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="max-w-lg"
        >
          <div className="p-6 rounded-2xl border border-red-200 bg-red-50 mb-8">
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8.25" stroke="#DC2626" strokeWidth="1.5"/>
                  <path d="M9 5.5v5M9 12.5v.5" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-red-800 mb-1">Investigation not found</p>
                <p className="text-[13px] text-red-600 font-mono mb-1">{analysisId}</p>
                <p className="text-[13px] text-red-600 leading-relaxed">
                  {message ?? "This analysis could not be retrieved. It may have been deleted or the ID is invalid."}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-[13px] font-semibold text-blue-600 hover:underline flex items-center gap-1.5"
          >
            ← Return to landing page
          </button>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}

/* -- Data transform ---------------------------------------------------------- */
function adminDetailToAnalysis(detail) {
  const suspicious_accounts = (detail.accounts ?? []).map((acc) => ({
    account_id:             acc.account_id,
    suspicion_score:        acc.suspicion_score ?? 0,
    confidence_score:       0,
    risk_tier:              (acc.suspicion_score ?? 0) >= 70 ? "HIGH"
                          : (acc.suspicion_score ?? 0) >= 40 ? "MEDIUM"
                          : "LOW",
    detected_patterns:      acc.detected_patterns ?? [],
    behavioral_score:       0,
    graph_score:            0,
    temporal_score:         0,
    amount_score:           0,
    total_sent:             0,
    total_received:         0,
    transaction_count:      0,
    ring_id:                acc.ring_id ?? null,
    investigation_priority: 3,
    explanation:            null,
  }));

  const fraud_rings = (detail.rings ?? []).map((r) => ({
    ring_id:                  r.ring_id,
    member_accounts:          r.member_accounts ?? [],
    pattern_type:             r.pattern_type ?? "unknown",
    risk_score:               r.risk_score ?? 0,
    total_amount_circulated:  0,
    cycle_count:              0,
    confidence_score:         0,
  }));

  return {
    analysis_id:       detail.id,
    suspicious_accounts,
    fraud_rings,
    summary: {
      total_accounts_analyzed:     detail.total_accounts     ?? 0,
      suspicious_accounts_flagged: detail.suspicious_flagged ?? 0,
      fraud_rings_detected:        detail.rings_detected     ?? 0,
      processing_time_seconds:     detail.processing_time    ?? 0,
      total_transactions:          0,
      high_risk_accounts:          0,
      total_suspicious_amount:     0,
      detection_coverage:          0,
      graph_density:               0,
      ml_active:                   false,
    },
    validation_report: null,
    ai_explanations:   null,
    ring_summaries:    null,
    ai_status:         null,
    ml_diagnostics:    null,
  };
}

/* -- Workspace --------------------------------------------------------------- */
function InvestigationWorkspace({ analysisId }) {
  const { phase, advancePhase } = useInvestigationPhase();

  useEffect(() => {
    if (isPhaseAtLeast(phase, PHASE.THREAT_IDENTIFIED)) {
      const t = setTimeout(() => advancePhase(PHASE.INVESTIGATION_READY), 1800);
      return () => clearTimeout(t);
    }
  }, [phase, advancePhase]);

  const showReady = isPhaseAtLeast(phase, PHASE.INVESTIGATION_READY);

  return (
    <div className="min-h-screen font-sans"
      style={{ background: "linear-gradient(180deg, #F8FAFF 0%, #ffffff 100%)" }}>
      <Navbar />

      {/* Workspace breadcrumb bar */}
      <div className="border-b" style={{ background: "rgba(255,255,255,0.9)", borderColor: "rgba(148,163,184,0.18)", backdropFilter: "blur(12px)" }}>
        <div className="container-wide h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#94A3B8" }}>
              Investigation
            </span>
            <span style={{ color: "#CBD5E1" }}>/</span>
            <span className="text-[11px] font-mono font-semibold" style={{ color: "#475569" }}>
              {analysisId.slice(0, 8)}…
            </span>
          </div>

          {/* Ready badge */}
          <AnimatePresence>
            {showReady && (
              <motion.div
                key="ready"
                className="flex items-center gap-2 px-3 py-1 rounded-full border"
                style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">
                  Investigation Ready
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[10px] hidden sm:block" style={{ color: "#CBD5E1" }}>
            Bookmark this URL to return to this investigation
          </p>
        </div>
      </div>

      <main>
        <Suspense fallback={<SectionFallback />}>
          <ResultsDashboard />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <GraphViz />
        </Suspense>
      </main>

      <Footer />
      <EventNotification phase={phase} />
    </div>
  );
}

/* -- Page component ---------------------------------------------------------- */
export default function InvestigationPage() {
  const { analysisId } = useParams();
  const { result }        = useAnalysisState();
  const { restoreResult } = useAnalysisActions();

  const isAlreadyLoaded = result?.analysis_id === analysisId;

  const { data: adminDetail, isLoading, isError, error } =
    useAdminAnalysisDetail(isAlreadyLoaded ? null : analysisId);

  const transformedResult = useMemo(() => {
    if (!adminDetail || isAlreadyLoaded) return null;
    const raw = adminDetailToAnalysis(adminDetail);
    return generateExplanations(raw);
  }, [adminDetail, isAlreadyLoaded]);

  useEffect(() => {
    if (transformedResult) restoreResult(transformedResult);
  }, [transformedResult, restoreResult]);

  if (!analysisId) return <ErrorWorkspace analysisId="unknown" message="No analysis ID in URL." />;
  if (!isAlreadyLoaded && isLoading) return <LoadingWorkspace analysisId={analysisId} />;
  if (isError) {
    const msg = error?.detail ?? error?.message ?? "Failed to retrieve analysis.";
    return <ErrorWorkspace analysisId={analysisId} message={msg} />;
  }

  return <InvestigationWorkspace analysisId={analysisId} />;
}
