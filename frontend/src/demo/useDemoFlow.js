/**
 * useDemoFlow.js
 *
 * A linear state machine that drives the guided demo experience.
 *
 * Stages (in order):
 *   IDLE → DATA_INGESTED → GRAPH_BUILT → PATTERNS_DETECTED
 *     → ROLES_IDENTIFIED → INTELLIGENCE_READY
 *
 * Integration:
 *   - Call autoAdvance(stage) after each stage completes to trigger
 *     the next step after a preset delay.
 *   - The hook hooks into useAnalysisState to auto-start from
 *     DATA_INGESTED when analysis status changes to "analyzing".
 *   - isDemoMode-gated: all behaviour is no-op when demo mode is off.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAnalysisState } from "../context/AnalysisContext";
import { useDemoMode } from "./DemoModeProvider";

// ── Stage constants ──────────────────────────────────────────────────────────
export const DEMO_STAGE = Object.freeze({
  IDLE:               "IDLE",
  DATA_INGESTED:      "DATA_INGESTED",
  GRAPH_BUILT:        "GRAPH_BUILT",
  PATTERNS_DETECTED:  "PATTERNS_DETECTED",
  ROLES_IDENTIFIED:   "ROLES_IDENTIFIED",
  INTELLIGENCE_READY: "INTELLIGENCE_READY",
});

const STAGE_ORDER = [
  DEMO_STAGE.IDLE,
  DEMO_STAGE.DATA_INGESTED,
  DEMO_STAGE.GRAPH_BUILT,
  DEMO_STAGE.PATTERNS_DETECTED,
  DEMO_STAGE.ROLES_IDENTIFIED,
  DEMO_STAGE.INTELLIGENCE_READY,
];

// Delay (ms) to wait before auto-advancing FROM each stage
const STAGE_DELAY_MS = {
  [DEMO_STAGE.DATA_INGESTED]:      1_400,
  [DEMO_STAGE.GRAPH_BUILT]:        2_000,
  [DEMO_STAGE.PATTERNS_DETECTED]:  2_200,
  [DEMO_STAGE.ROLES_IDENTIFIED]:   2_000,
  [DEMO_STAGE.INTELLIGENCE_READY]: 0,     // terminal — no auto-advance
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useDemoFlow() {
  const { isDemoMode } = useDemoMode();
  const { status: analysisStatus, result } = useAnalysisState();

  const [currentDemoStep, setCurrentDemoStep] = useState(DEMO_STAGE.IDLE);
  const timerRef = useRef(null);

  // ── Advance to next stage ─────────────────────────────────────────────────
  const nextStep = useCallback(() => {
    setCurrentDemoStep((prev) => {
      const idx = STAGE_ORDER.indexOf(prev);
      if (idx < STAGE_ORDER.length - 1) return STAGE_ORDER[idx + 1];
      return prev;
    });
  }, []);

  // ── Auto-advance after a delay ────────────────────────────────────────────
  const autoAdvance = useCallback(
    (fromStage) => {
      if (!isDemoMode) return;
      const delay = STAGE_DELAY_MS[fromStage] ?? 2_000;
      if (delay <= 0) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(nextStep, delay);
    },
    [isDemoMode, nextStep],
  );

  // ── Reset demo to IDLE ────────────────────────────────────────────────────
  const resetDemo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentDemoStep(DEMO_STAGE.IDLE);
  }, []);

  // ── React to real analysis pipeline events ────────────────────────────────
  // When the real analysis starts uploading, kick off the demo flow from stage 1.
  useEffect(() => {
    if (!isDemoMode) return;

    if (analysisStatus === "uploading" || analysisStatus === "analyzing") {
      if (currentDemoStep === DEMO_STAGE.IDLE) {
        setCurrentDemoStep(DEMO_STAGE.DATA_INGESTED);
        autoAdvance(DEMO_STAGE.DATA_INGESTED);
      }
    }

    if (analysisStatus === "done" && result) {
      // Jump to terminal stage when result lands
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrentDemoStep(DEMO_STAGE.INTELLIGENCE_READY);
    }

    if (analysisStatus === "idle") {
      resetDemo();
    }
  }, [analysisStatus, result, isDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance through intermediate stages
  useEffect(() => {
    if (!isDemoMode) return;
    if (
      currentDemoStep !== DEMO_STAGE.IDLE &&
      currentDemoStep !== DEMO_STAGE.INTELLIGENCE_READY &&
      currentDemoStep !== DEMO_STAGE.DATA_INGESTED // DATA_INGESTED is triggered manually above
    ) {
      autoAdvance(currentDemoStep);
    }
  }, [currentDemoStep, isDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    currentDemoStep,
    nextStep,
    autoAdvance,
    resetDemo,
    isDemoMode,
    isActive: isDemoMode && currentDemoStep !== DEMO_STAGE.IDLE,
  };
}
