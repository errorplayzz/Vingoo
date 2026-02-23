/**
 * pages/InvestigationPage.jsx
 *
 * Dedicated investigation workspace for a single analysis.
 *
 * Route: /investigation/:analysisId
 *
 * Lifecycle
 * ─────────
 * 1. Read `analysisId` from URL params.
 * 2. If AnalysisContext already holds this analysis (hot navigation from the
 *    landing page after a fresh upload), skip the network call entirely —
 *    the context is already populated and all sections render instantly.
 * 3. Otherwise (page reload, bookmark, shared link), fetch the analysis
 *    detail from `GET /admin/analysis/:id` via React Query.
 * 4. Transform the admin detail payload into an AnalysisResponse-shaped
 *    object and call `restoreResult(explained)` on the context so
 *    ResultsDashboard, GraphViz, and StoryMode all render without changes.
 * 5. Show a loading skeleton while the network call is in-flight and a
 *    friendly error card if the analysis is not found or the fetch fails.
 *
 * Benefits
 * ────────
 * ✔ Permanent URL — analysts can bookmark /investigation/abc123
 * ✔ Reload-safe   — content rehydrates from the DB on every page load
 * ✔ Back-button   — browser history works correctly
 * ✔ Shareable     — copy the URL to send to a colleague
 * ✔ Zero rewrites — all existing section components are reused as-is
 */

import { lazy, Suspense, memo, useEffect, useMemo } from 'react';
import { useParams, useNavigate }                   from 'react-router-dom';
import { motion }                                   from 'framer-motion';
import { useAnalysisState, useAnalysisActions }     from '../context/AnalysisContext';
import { useAdminAnalysisDetail }                   from '../hooks/useAdminData';
import { generateExplanations }                     from '../utils/explainer';
import Navbar                                       from '../components/Navbar';
import Footer                                       from '../sections/Footer';

// ── Lazy sections ────────────────────────────────────────────────────────────
// Reuse the exact same lazy chunks as App.jsx — no extra network round-trips
// for users who visit this page after having already been on the landing page.
const ResultsDashboard = lazy(() => import('../sections/ResultsDashboard'));
const GraphViz         = lazy(() => import('../sections/GraphViz'));
const StoryMode        = lazy(() => import('../sections/StoryMode'));

const EASE = [0.22, 1, 0.36, 1];

// ── Section fallback ─────────────────────────────────────────────────────────
const SectionFallback = memo(() => (
  <div className="w-full py-20 flex items-center justify-center" aria-hidden>
    <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
  </div>
));

// ── Full-page loading state ───────────────────────────────────────────────────
function LoadingWorkspace({ analysisId }) {
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <Navbar />
      <div className="container-wide pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="max-w-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <p className="text-[11px] font-semibold text-accent uppercase tracking-widest">
              Loading Investigation
            </p>
          </div>
          <h1 className="text-[1.75rem] font-black text-ink tracking-tight mb-2">
            Restoring workspace…
          </h1>
          <p className="text-muted text-[0.9375rem] leading-relaxed mb-8">
            Fetching analysis{' '}
            <span className="font-mono font-semibold text-ink">
              {analysisId.slice(0, 8)}…
            </span>{' '}
            from the intelligence database.
          </p>

          {/* Skeleton cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-white border border-black/[0.06] animate-pulse"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
              />
            ))}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorWorkspace({ analysisId, message }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white">
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
                <p className="text-[14px] font-semibold text-red-800 mb-1">
                  Investigation not found
                </p>
                <p className="text-[13px] text-red-600 font-mono mb-1">
                  {analysisId}
                </p>
                <p className="text-[13px] text-red-600 leading-relaxed">
                  {message ?? 'This analysis could not be retrieved. It may have been deleted or the ID is invalid.'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-[13px] font-semibold text-accent hover:underline flex items-center gap-1.5"
          >
            ← Return to landing page
          </button>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}

// ── Data transform ────────────────────────────────────────────────────────────
/**
 * Convert the admin detail payload (GET /admin/analysis/:id) into an
 * object that matches the AnalysisResponse shape expected by all existing
 * section components.
 *
 * Field mapping
 * ─────────────
 * detail.accounts[]  → suspicious_accounts[] (with synthetic defaults for
 *                      score-derived fields that weren't stored in the DB)
 * detail.rings[]     → fraud_rings[]         (member_accounts already matches)
 * detail.*           → summary.*             (renamed + defaults for opt fields)
 */
function adminDetailToAnalysis(detail) {
  const suspicious_accounts = (detail.accounts ?? []).map((acc) => ({
    account_id:             acc.account_id,
    suspicion_score:        acc.suspicion_score ?? 0,
    confidence_score:       0,
    risk_tier:              (acc.suspicion_score ?? 0) >= 70 ? 'HIGH'
                          : (acc.suspicion_score ?? 0) >= 40 ? 'MEDIUM'
                          : 'LOW',
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
    pattern_type:             r.pattern_type ?? 'unknown',
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
      total_accounts_analyzed:    detail.total_accounts     ?? 0,
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

// ── Workspace ─────────────────────────────────────────────────────────────────
function InvestigationWorkspace({ analysisId }) {
  return (
    <div className="bg-white font-sans">
      <Navbar />

      {/* Workspace header bar */}
      <div className="bg-[#0A1226] border-b border-white/[0.08]">
        <div className="container-wide h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">
              Investigation
            </p>
            <span className="text-white/20">/</span>
            <p className="text-[11px] font-mono font-semibold text-white/80">
              {analysisId.slice(0, 8)}…
            </p>
          </div>
          <p className="text-[10px] text-white/30 hidden sm:block">
            Bookmark this URL to return to this investigation
          </p>
        </div>
      </div>

      <main>
        {/* ResultsDashboard reads from AnalysisContext — already populated */}
        <Suspense fallback={<SectionFallback />}>
          <ResultsDashboard />
        </Suspense>

        {/* StoryMode is a narrative section, independent of analysis data */}
        <Suspense fallback={<SectionFallback />}>
          <StoryMode />
        </Suspense>

        {/* GraphViz reads from AnalysisContext — already populated */}
        <Suspense fallback={<SectionFallback />}>
          <GraphViz />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────
export default function InvestigationPage() {
  const { analysisId } = useParams();

  // Context state / actions
  const { result }        = useAnalysisState();
  const { restoreResult } = useAnalysisActions();

  // Is the correct analysis already in context?
  // e.g. the user just uploaded and was navigated here from UploadAnalysis
  const isAlreadyLoaded = result?.analysis_id === analysisId;

  // React Query fetch — only fires when not already loaded.
  // staleTime: Infinity because analysis DB rows are immutable after creation.
  const {
    data: adminDetail,
    isLoading,
    isError,
    error,
  } = useAdminAnalysisDetail(isAlreadyLoaded ? null : analysisId);

  // When the admin detail arrives, transform and restore into context so all
  // existing section components (ResultsDashboard, GraphViz) work unchanged.
  const transformedResult = useMemo(() => {
    if (!adminDetail || isAlreadyLoaded) return null;
    const raw      = adminDetailToAnalysis(adminDetail);
    const explained = generateExplanations(raw);
    return explained;
  }, [adminDetail, isAlreadyLoaded]);

  useEffect(() => {
    if (transformedResult) {
      restoreResult(transformedResult);
    }
  }, [transformedResult, restoreResult]);

  // ── Render states ──────────────────────────────────────────────────────────
  if (!analysisId) {
    return <ErrorWorkspace analysisId="unknown" message="No analysis ID in URL." />;
  }

  // Still fetching from backend
  if (!isAlreadyLoaded && isLoading) {
    return <LoadingWorkspace analysisId={analysisId} />;
  }

  // Fetch failed (404 or network error)
  if (isError) {
    const msg = error?.detail ?? error?.message ?? 'Failed to retrieve analysis.';
    return <ErrorWorkspace analysisId={analysisId} message={msg} />;
  }

  // Data is either already in context or was just restored by useEffect
  return <InvestigationWorkspace analysisId={analysisId} />;
}
