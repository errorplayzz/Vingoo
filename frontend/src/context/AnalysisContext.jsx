/**
 * context/AnalysisContext.jsx – Global state for the core analysis pipeline.
 *
 * Performance changes vs. the original monolith:
 *
 *  1. Admin state REMOVED — fetchAdminData, adminAnalyses, adminReports, etc.
 *     are now served by React Query hooks in hooks/useAdminData.js.
 *     This eliminates the root cause of re-renders in InvestigatorDashboard
 *     propagating into ResultsDashboard and GraphViz.
 *
 *  2. Split context — values are split into two independent contexts so
 *     components can subscribe to only what they need:
 *
 *       useAnalysisState()   – state values (status, result, …)
 *                              re-renders when values change
 *       useAnalysisActions() – stable callbacks (runAnalysis, reset, …)
 *                              NEVER triggers extra re-renders because all
 *                              callbacks are wrapped in useCallback with
 *                              stable deps and the context value itself is
 *                              memoized with useMemo.
 *       useAnalysis()        – merges both; backward-compatible with all
 *                              existing call-sites.
 *
 *  3. explainCache uses useRef (no state change on cache write) — unchanged.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { analyze, checkHealth } from "../api/client";
import { generateExplanations } from "../utils/explainer";


/* ── Contexts ─────────────────────────────────────────────────────────────── */

const _StateContext   = createContext(null);
const _ActionsContext = createContext(null);

/* ── Consumer hooks ───────────────────────────────────────────────────────── */

/** Subscribe to state values only (status, result, progress, …). */
export function useAnalysisState() {
  const ctx = useContext(_StateContext);
  if (!ctx) throw new Error("useAnalysisState must be used inside AnalysisProvider");
  return ctx;
}

/** Subscribe to stable callbacks only — never causes extra re-renders. */
export function useAnalysisActions() {
  const ctx = useContext(_ActionsContext);
  if (!ctx) throw new Error("useAnalysisActions must be used inside AnalysisProvider");
  return ctx;
}

/**
 * Backward-compatible hook that merges state + actions into one object.
 * All existing call-sites continue to work without any changes.
 */
export function useAnalysis() {
  return { ...useAnalysisState(), ...useAnalysisActions() };
}

/* ── Provider ─────────────────────────────────────────────────────────────── */

export function AnalysisProvider({ children }) {
  // ── Core analysis state ───────────────────────────────────────────────────
  const [status,           setStatus]           = useState("idle");   // idle|uploading|analyzing|done|error
  const [progress,         setProgress]         = useState(0);        // 0–100
  const [result,           setResult]           = useState(null);     // AnalysisResponse + explanations
  const [rawResult,        setRawResult]        = useState(null);     // exact API body, unmutated
  const [error,            setError]            = useState(null);     // string | null
  const [fileName,         setFileName]         = useState(null);
  const [highlightedRingId,setHighlightedRingId]= useState(null);
  const [apiHealth,        setApiHealth]        = useState("unknown"); // unknown|healthy|degraded
  const [investigatorMode, setInvestigatorMode] = useState(false);

  // ── Ref — mutation, no re-render ──────────────────────────────────────────
  const explainCache = useRef(new Map());

  // ── Actions ───────────────────────────────────────────────────────────────

  const pingHealth = useCallback(async () => {
    try {
      await checkHealth();
      setApiHealth("healthy");
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 15_000));
        await checkHealth();
        setApiHealth("healthy");
      } catch {
        setApiHealth("degraded");
      }
    }
  }, []);

  const runAnalysis = useCallback(async (file) => {
    if (!file) return false;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setStatus("uploading");
    setProgress(10);

    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 88));
    }, 400);

    try {
      setStatus("analyzing");
      setProgress(20);

      const data = await analyze(file);

      clearInterval(tick);
      setProgress(95);
      setRawResult(data);

      let explained;
      if (explainCache.current.has(file.name)) {
        explained = explainCache.current.get(file.name);
      } else {
        explained = generateExplanations(data);

        if (
          data.ai_status === "active" &&
          Array.isArray(data.ai_explanations) &&
          data.ai_explanations.length > 0
        ) {
          const aiMap = Object.fromEntries(
            data.ai_explanations.map((e) => [e.account_id, e.explanation]),
          );
          explained = {
            ...explained,
            suspicious_accounts: explained.suspicious_accounts.map((acc) =>
              aiMap[acc.account_id]
                ? { ...acc, explanation: aiMap[acc.account_id], ai_source: "openrouter" }
                : acc,
            ),
          };
        }

        explainCache.current.set(file.name, explained);
      }

      setResult(explained);
      setProgress(100);
      setStatus("done");
      return true;
    } catch (err) {
      clearInterval(tick);
      setProgress(0);
      setStatus("error");

      if (err.name === "AbortError") {
        setError("Request timed out. The backend took too long to respond.");
      } else if (err.status === 422) {
        setError(`Invalid CSV: ${err.detail}`);
      } else if (err.status === 400) {
        setError(`Bad request: ${err.detail}`);
      } else if (!navigator.onLine) {
        setError("No internet connection. Check your network and try again.");
      } else {
        setError(err.detail ?? err.message ?? "An unexpected error occurred.");
      }
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setRawResult(null);
    setError(null);
    setFileName(null);
    setHighlightedRingId(null);
  }, []);

  // ── Memoised context values ───────────────────────────────────────────────
  // Actions reference is stable → consumers calling useAnalysisActions() never
  // re-render when state values change.
  const actionsValue = useMemo(
    () => ({ pingHealth, runAnalysis, reset, setHighlightedRingId, setInvestigatorMode }),
    [pingHealth, runAnalysis, reset],
  );

  const stateValue = useMemo(
    () => ({
      status, progress, result, rawResult, error, fileName,
      highlightedRingId, apiHealth, investigatorMode,
    }),
    [status, progress, result, rawResult, error, fileName, highlightedRingId, apiHealth, investigatorMode],
  );

  return (
    <_ActionsContext.Provider value={actionsValue}>
      <_StateContext.Provider value={stateValue}>
        {children}
      </_StateContext.Provider>
    </_ActionsContext.Provider>
  );
}


