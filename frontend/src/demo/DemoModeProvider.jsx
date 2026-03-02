/**
 * DemoModeProvider.jsx
 *
 * Context that activates demo mode when ?demo=true is present in the URL,
 * or when enableDemo() is called programmatically.
 *
 * Demo mode:
 *  - Renders SystemNarration overlay (guided messages)
 *  - Enables FocusHighlight auto-sequencing
 *  - Triggers GraphViz cinematic camera animation
 *
 * Usage:
 *   Wrap the app (or a subtree) with <DemoModeProvider>.
 *   Consume with useDemoMode() from this file.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useAnalysisActions, useAnalysisState } from "../context/AnalysisContext";
import {
  INVESTIGATION_STATE,
  useInvestigationState,
} from "../context/InvestigationContext";
import { DEMO_INVESTIGATION_DATA } from "./demoInvestigationData";

// ── Context ─────────────────────────────────────────────────────────────────
const DemoModeContext = createContext({
  isDemoMode: false,
  enableDemo: () => {},
  disableDemo: () => {},
});

const DEMO_TIMELINE = [
  { state: INVESTIGATION_STATE.DATA_UPLOADED, delayMs: 900 },
  { state: INVESTIGATION_STATE.GRAPH_BUILDING, delayMs: 900 },
  { state: INVESTIGATION_STATE.ANALYZING, delayMs: 1200 },
  { state: INVESTIGATION_STATE.INTELLIGENCE_READY, delayMs: 1400 },
];

function DemoModeRuntime() {
  const { isDemoMode } = useContext(DemoModeContext);
  const { status, result } = useAnalysisState();
  const { restoreResult } = useAnalysisActions();
  const { setInvestigationState } = useInvestigationState();
  const timersRef = useRef([]);
  const hasScheduledRef = useRef(false);
  const statusRef = useRef(status);
  const resultRef = useRef(result);

  useEffect(() => {
    statusRef.current = status;
    resultRef.current = result;
  }, [status, result]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!isDemoMode || hasScheduledRef.current) return;
    hasScheduledRef.current = true;

    setInvestigationState(INVESTIGATION_STATE.IDLE);

    let cumulativeDelay = 0;
    DEMO_TIMELINE.forEach((step) => {
      cumulativeDelay += step.delayMs;
      const timer = setTimeout(() => {
        setInvestigationState(step.state);

        if (
          step.state === INVESTIGATION_STATE.ANALYZING &&
          statusRef.current !== "done" &&
          !resultRef.current
        ) {
          restoreResult(DEMO_INVESTIGATION_DATA);
        }

        if (
          step.state === INVESTIGATION_STATE.INTELLIGENCE_READY &&
          statusRef.current !== "done" &&
          !resultRef.current
        ) {
          restoreResult(DEMO_INVESTIGATION_DATA);
        }
      }, cumulativeDelay);
      timersRef.current.push(timer);
    });

    return clearTimers;
  }, [
    isDemoMode,
    setInvestigationState,
    restoreResult,
    clearTimers,
  ]);

  useEffect(() => {
    if (!isDemoMode) {
      hasScheduledRef.current = false;
      clearTimers();
    }
  }, [isDemoMode, clearTimers]);

  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function DemoModeProvider({ children }) {
  const [isDemoMode, setDemoMode] = useState(false);

  // Auto-detect ?demo=true from URL on first mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true") {
      setDemoMode(true);
    }
  }, []);

  const enableDemo  = useCallback(() => setDemoMode(true),  []);
  const disableDemo = useCallback(() => setDemoMode(false), []);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, enableDemo, disableDemo }}>
      <DemoModeRuntime />
      {children}
    </DemoModeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useDemoMode() {
  return useContext(DemoModeContext);
}
