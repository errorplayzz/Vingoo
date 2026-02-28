/**
 * sections/UploadAnalysis.jsx
 * Core conversion section — uploads CSV, runs real POST /analyze,
 * renders loading states, errors, and summary on completion.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useNavigate }  from "react-router-dom";
import { useAnalysis } from "../context/AnalysisContext";
import { useToast }    from "../context/ToastContext";
import {
  INVESTIGATION_STATE,
  isStateAtLeast,
  useInvestigationState,
} from "../context/InvestigationContext";
import { useInvestigationPhase, PHASE, PHASE_LABELS } from "../intelligence/useInvestigationPhase";
import ScanSweep         from "../intelligence/ScanSweep";
import EventNotification from "../intelligence/EventNotification";

const EASE = [0.4, 0, 0.2, 1];

/* ── Skeleton block ───────────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return (
    <div
      className={`rounded-lg bg-slate-100 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/* ── Progress bar ─────────────────────────────────────────────────────────── */
function ProgressBar({ value }) {
  return (
    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-accent rounded-full"
        initial={{ width: "0%" }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.4, ease: EASE }}
      />
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({ value, label, icon, delay = 0 }) {
  return (
    <motion.div
      className="flex-1 min-w-[120px] flex flex-col gap-1 p-5 rounded-2xl border border-black/[0.06] bg-white"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <span className="text-xl mb-1">{icon}</span>
      <span className="text-3xl font-black text-ink tracking-tight">{value}</span>
      <span className="text-[12px] text-faint font-medium">{label}</span>
    </motion.div>
  );
}

/* ── Drop zone ─────────────────────────────────────────────────────────────── */
function DropZone({ onFile }) {
  const inputRef  = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      // Let parent show the toast; pass through anyway for backend validation
    }
    onFile(f);
  }, [onFile]);

  return (
    <motion.div
      className="relative rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-4 cursor-pointer select-none"
      animate={{
        borderColor: dragging ? "rgba(29,78,216,0.55)" : "rgba(0,0,0,0.10)",
        backgroundColor: dragging ? "rgba(29,78,216,0.025)" : "rgba(248,250,252,0.5)",
        scale: dragging ? 1.005 : 1,
      }}
      transition={{ duration: 0.18, ease: EASE }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      whileHover={{ borderColor: "rgba(29,78,216,0.3)", backgroundColor: "rgba(29,78,216,0.01)" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <motion.div
        className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center"
        animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.08 : 1 }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" className="text-accent">
          <path d="M13 17V5M9 9l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 19v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </motion.div>

      <div className="text-center">
        <p className="text-[15px] font-semibold text-ink">
          {dragging ? "Release to start analysis" : "Drop your transaction CSV"}
        </p>
        <p className="text-[13px] text-faint mt-1.5">
          Required columns: <span className="font-mono">sender_id · receiver_id · amount · timestamp</span>
        </p>
        <p className="text-[11px] text-faint mt-1">or click to browse</p>
      </div>

      {dragging && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-accent pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ boxShadow: "0 0 0 4px rgba(29,78,216,0.08)" }}
        />
      )}
    </motion.div>
  );
}

/* ── Loading panel ─────────────────────────────────────────────────────────── */
function LoadingPanel({ progress, fileName, phase }) {
  // Phase-driven label takes priority over progress-threshold label
  const phaseLabel = phase && phase !== PHASE.IDLE ? PHASE_LABELS[phase] : null;

  // Fallback: progress threshold stages (used when no SSE phase available)
  const stages = [
    { at: 10,  label: "Reading file" },
    { at: 30,  label: "Building transaction graph" },
    { at: 55,  label: "Running pattern detectors" },
    { at: 75,  label: "Computing suspicion scores" },
    { at: 90,  label: "Generating intelligence report" },
  ];
  const fallbackStage = [...stages].reverse().find((s) => progress >= s.at)?.label ?? "Initialising";
  const currentStage  = phaseLabel ?? fallbackStage;

  return (
    <div className="w-full">
      {/* Skeletons */}
      <div className="space-y-3 mb-8">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Analysis card with scanning sweep overlay */}
      <div className="relative p-6 rounded-2xl border border-black/[0.06] bg-white"
        style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
        <ScanSweep active />
        <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-semibold text-ink">{currentStage}…</p>
            <p className="text-[11px] text-faint mt-0.5 font-mono">{fileName}</p>
          </div>
          <span className="text-[12px] font-bold text-accent tabular-nums">{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} />

        {/* Animated bars */}
        <div className="mt-5 space-y-2.5">
          {[70, 55, 85, 40].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="flex-shrink-0 w-5 h-5 rounded-md" />
              <Skeleton className={`h-3`} style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        </div>{/* /relative z-10 */}
      </div>
    </div>
  );
}

/* ── Error panel ──────────────────────────────────────────────────────────── */
function ErrorPanel({ message, onRetry }) {
  return (
    <motion.div
      className="p-6 rounded-2xl border border-red-200 bg-red-50"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8.25" stroke="#DC2626" strokeWidth="1.5"/>
            <path d="M9 5.5v5M9 12.5v.5" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-red-800 mb-1">Analysis failed</p>
          <p className="text-[13px] text-red-600 leading-relaxed">{message}</p>
          <button
            onClick={onRetry}
            className="mt-4 text-[12px] font-semibold text-accent hover:underline"
          >
            Try another file →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Results summary panel ─────────────────────────────────────────────────── */
function ResultsSummary({ result }) {
  const s = result.summary;
  return (
    <div className="space-y-6">
      {/* Processing metadata */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-[11px] font-semibold text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Analysis complete
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-black/[0.06] text-[11px] font-medium text-muted">
          ⏱ {s.processing_time_seconds}s processing time
        </span>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <StatCard value={s.total_accounts_analyzed}    label="Accounts analysed"    icon="🔍" delay={0}    />
        <StatCard value={s.suspicious_accounts_flagged} label="Flagged suspicious"  icon="⚠️" delay={0.08} />
        <StatCard value={s.fraud_rings_detected}        label="Fraud rings detected" icon="🔗" delay={0.16} />
        <StatCard
          value={s.processing_time_seconds != null ? `${s.processing_time_seconds}s` : "—"}
          label="Processing time"
          icon="⏱️"
          delay={0.24}
        />
        <StatCard
          value={result.suspicious_accounts?.[0]?.suspicion_score?.toFixed(1) ?? "—"}
          label="Highest risk score"
          icon="🎯"
          delay={0.32}
        />
      </div>

      {/* Top flagged accounts preview */}
      {result.suspicious_accounts?.length > 0 && (
        <motion.div
          className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden"
          style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
        >
          <div className="px-5 py-4 border-b border-black/[0.05] flex items-center justify-between">
            <p className="text-[12px] font-semibold text-faint uppercase tracking-widest">
              Top suspicious accounts
            </p>
            <a href="#results" className="text-[11px] font-semibold text-accent hover:underline">
              View all →
            </a>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {result.suspicious_accounts.slice(0, 4).map((acc, i) => (
              <motion.div
                key={acc.account_id}
                className="flex items-center gap-3 px-5 py-3.5"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 + 0.35, duration: 0.4, ease: EASE }}
              >
                <div className="w-9 h-9 rounded-xl bg-ink/[0.04] border border-black/[0.06] flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-black text-ink">{Math.round(acc.suspicion_score)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-semibold font-mono text-ink truncate">{acc.account_id}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {acc.pattern_labels?.slice(0, 2).map((p) => (
                        <span key={p} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/[0.08] text-accent border border-accent/20 whitespace-nowrap">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${acc.suspicion_score}%` }}
                      transition={{ delay: i * 0.07 + 0.5, duration: 0.6, ease: EASE }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ── Main section ──────────────────────────────────────────────────────────── */
export default function UploadAnalysis() {
  const { status, progress, result, error, fileName, runAnalysis, reset } = useAnalysis();
  const { investigationState, setInvestigationState } = useInvestigationState();
  const toast     = useToast();
  const navigate  = useNavigate();
  const { phase, sseProgress } = useInvestigationPhase();
  const displayProgress = sseProgress ?? progress;
  const [headerRef, headerInView] = useInView({ triggerOnce: true, threshold: 0.2 });

  useEffect(() => {
    if (status === 'done' && result?.analysis_id) {
      setInvestigationState(INVESTIGATION_STATE.INTELLIGENCE_READY);
      navigate(`/investigation/${result.analysis_id}`);
    }
  }, [status, result?.analysis_id, navigate, setInvestigationState]);

  useEffect(() => {
    if (status === "idle" && investigationState !== INVESTIGATION_STATE.IDLE) {
      return;
    }

    if (status === "uploading" && !isStateAtLeast(investigationState, INVESTIGATION_STATE.DATA_UPLOADED)) {
      setInvestigationState(INVESTIGATION_STATE.DATA_UPLOADED);
      return;
    }

    if (status === "analyzing" && !isStateAtLeast(investigationState, INVESTIGATION_STATE.ANALYZING)) {
      setInvestigationState(INVESTIGATION_STATE.ANALYZING);
      return;
    }

    if (status === "done" && !isStateAtLeast(investigationState, INVESTIGATION_STATE.INTELLIGENCE_READY)) {
      setInvestigationState(INVESTIGATION_STATE.INTELLIGENCE_READY);
    }
  }, [status, investigationState, setInvestigationState]);

  const handleFile = useCallback(async (file) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file.", "Wrong file type");
      return;
    }
    const ok = await runAnalysis(file);
    if (ok) {
      toast.success("Analysis complete — scroll down to explore results.", "Done");
    }
  }, [runAnalysis, toast]);

  const handleReset = useCallback(() => {
    reset();
    setInvestigationState(INVESTIGATION_STATE.IDLE);
  }, [reset, setInvestigationState]);

  const isLoading = status === "uploading" || status === "analyzing";
  const isDone    = status === "done";
  const isError   = status === "error";
  const isIdle    = status === "idle";

  return (
    <section id="upload" data-focus-target="upload"
      className="bg-slate-50 border-t border-slate-200"
      style={{ overflowX: "hidden" }}>
      <div className="container-wide py-28 md:py-32">

        {/* Left-right layout */}
        <div className="flex flex-col lg:flex-row gap-16 xl:gap-24 items-start">

          {/* ── LEFT — copy ── */}
          <motion.div
            ref={headerRef}
            className="flex-1 max-w-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <p className="section-label mb-4">Detection Engine</p>
            <h2 className="section-title mb-6">
              Drop your<br />transaction data.
            </h2>
            <p className="text-muted text-[1.0625rem] leading-relaxed mb-8">
              Upload a CSV. Four pattern detectors fire instantly — cycles, smurfing,
              shell chains, and velocity — results in under 11 seconds.
            </p>

            {/* Required fields */}
            <div className="space-y-2.5">
              {[
                { col: "transaction_id", note: "Unique row identifier" },
                { col: "sender_id",      note: "Sending account" },
                { col: "receiver_id",    note: "Receiving account" },
                { col: "amount",         note: "Positive number" },
                { col: "timestamp",      note: "YYYY-MM-DD HH:MM:SS" },
              ].map((f) => (
                <div key={f.col}
                  className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-slate-50 border border-black/[0.05]">
                  <span className="text-[12px] font-mono font-semibold text-ink">{f.col}</span>
                  <span className="text-[11px] text-faint">{f.note}</span>
                </div>
              ))}
            </div>

            {isDone && (
              <button
                onClick={handleReset}
                className="mt-8 text-[13px] font-semibold text-accent hover:underline flex items-center gap-1"
              >
                ← Analyse another file
              </button>
            )}
          </motion.div>

          {/* ── RIGHT — upload / loading / result ── */}
          <motion.div
            className="flex-1 w-full min-w-0"
            initial={{ opacity: 0, y: 16 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
          >
            <AnimatePresence mode="wait">
              {isIdle && (
                <motion.div key="idle"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}>
                  <DropZone onFile={handleFile} />
                </motion.div>
              )}

              {isLoading && (
                <motion.div key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}>
                  <LoadingPanel progress={displayProgress} fileName={fileName} phase={phase} />
                </motion.div>
              )}

              {isError && (
                <motion.div key="error"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}>
                  <ErrorPanel message={error} onRetry={handleReset} />
                </motion.div>
              )}

              {isDone && result && (
                <motion.div key="done"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}>
                  <ResultsSummary result={result} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </div>

      {/* Phase notifications — show during analysis on this page */}
      {isLoading && <EventNotification phase={phase} />}
    </section>
  );
}
