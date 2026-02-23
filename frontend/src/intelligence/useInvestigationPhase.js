/**
 * intelligence/useInvestigationPhase.js
 *
 * Phase engine for the investigation story experience.
 *
 * Phases (ordered)
 * ────────────────
 *   IDLE               No active analysis — public / demo mode
 *   DATA_INGESTION     File received, transaction graph being assembled
 *   ANALYSIS_RUNNING   Pattern detectors actively scanning
 *   PATTERN_DISCOVERY  First signal found — threat taking shape
 *   THREAT_IDENTIFIED  Analysis complete — targets confirmed
 *   NETWORK_REVEALED   Graph animation triggered by scroll
 *   INVESTIGATION_READY Full analyst control enabled
 *
 * Data sources (layered)
 * ──────────────────────
 *  1. AnalysisContext.status — coarse phase transitions (idle → done)
 *  2. EventSource(/stream/analysis) — fine-grained during 'uploading'/'analyzing'
 *     • Provides real backend progress % (replaces fake interval display)
 *     • Only opened while status is active; closed on completion/error
 *
 * Rules
 * ─────
 *  • Phase only advances — never retreats (except full reset to IDLE)
 *  • Progressive disclosure: NETWORK_REVEALED and INVESTIGATION_READY are
 *    triggered externally by scroll / animation events, not by data alone.
 *    Use the returned `advancePhase(phase)` for these transitions.
 *  • Multiple consumers can call this hook independently — the SSE connection
 *    is opened per-call.  Intended to be used once per major page component.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAnalysisState } from '../context/AnalysisContext';
import { API_BASE }         from '../api/client';

// ── Phase enum ─────────────────────────────────────────────────────────────
export const PHASE = Object.freeze({
  IDLE:               'IDLE',
  DATA_INGESTION:     'DATA_INGESTION',
  ANALYSIS_RUNNING:   'ANALYSIS_RUNNING',
  PATTERN_DISCOVERY:  'PATTERN_DISCOVERY',
  THREAT_IDENTIFIED:  'THREAT_IDENTIFIED',
  NETWORK_REVEALED:   'NETWORK_REVEALED',
  INVESTIGATION_READY:'INVESTIGATION_READY',
});

const PHASE_ORDER = [
  PHASE.IDLE,
  PHASE.DATA_INGESTION,
  PHASE.ANALYSIS_RUNNING,
  PHASE.PATTERN_DISCOVERY,
  PHASE.THREAT_IDENTIFIED,
  PHASE.NETWORK_REVEALED,
  PHASE.INVESTIGATION_READY,
];

export function phaseIndex(phase)              { return PHASE_ORDER.indexOf(phase); }
export function isPhaseAtLeast(cur, min)       { return phaseIndex(cur) >= phaseIndex(min); }

// Human-readable labels for each phase (used in LoadingPanel and banners)
export const PHASE_LABELS = {
  [PHASE.IDLE]:               'Awaiting data',
  [PHASE.DATA_INGESTION]:     'Ingesting transaction data…',
  [PHASE.ANALYSIS_RUNNING]:   'Building transaction graph…',
  [PHASE.PATTERN_DISCOVERY]:  'Pattern detected — investigating…',
  [PHASE.THREAT_IDENTIFIED]:  'Threat confirmed — preparing report…',
  [PHASE.NETWORK_REVEALED]:   'Network graph revealed',
  [PHASE.INVESTIGATION_READY]:'Intelligence ready',
};

// ── Hook ───────────────────────────────────────────────────────────────────
export function useInvestigationPhase() {
  const { status } = useAnalysisState();

  const [phase,       setPhase]       = useState(PHASE.IDLE);
  const [sseProgress, setSseProgress] = useState(null); // null = use context progress

  // Lock prevents phase from retreating mid-stream
  const phaseLockRef = useRef(PHASE.IDLE);
  const esRef        = useRef(null);

  // ── Advance guard ──────────────────────────────────────────────────────
  const advancePhase = useCallback((next) => {
    if (next === PHASE.IDLE) {
      phaseLockRef.current = PHASE.IDLE;
      setPhase(PHASE.IDLE);
      setSseProgress(null);
      return;
    }
    if (phaseIndex(next) > phaseIndex(phaseLockRef.current)) {
      phaseLockRef.current = next;
      setPhase(next);
    }
  }, []);

  // ── Coarse phase from AnalysisContext.status ───────────────────────────
  useEffect(() => {
    switch (status) {
      case 'idle':      advancePhase(PHASE.IDLE);             break;
      case 'uploading': advancePhase(PHASE.DATA_INGESTION);   break;
      case 'analyzing': advancePhase(PHASE.ANALYSIS_RUNNING); break;
      case 'done':      advancePhase(PHASE.THREAT_IDENTIFIED);break;
      case 'error':
        // Reset to IDLE on error so next upload starts fresh
        phaseLockRef.current = PHASE.IDLE;
        setPhase(PHASE.IDLE);
        setSseProgress(null);
        break;
      default: break;
    }
  }, [status, advancePhase]);

  // ── Fine-grained SSE phase during active analysis ──────────────────────
  useEffect(() => {
    const isActive = status === 'uploading' || status === 'analyzing';

    if (!isActive) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    // Don't double-open
    if (esRef.current) return;

    const es = new EventSource(`${API_BASE}/stream/analysis`);
    esRef.current = es;

    // ── Named event listeners (FastAPI SSE uses event: <type>) ────────────

    /** File received, graph being built */
    es.addEventListener('analysis_started', (e) => {
      try {
        const d = JSON.parse(e.data);
        advancePhase(PHASE.DATA_INGESTION);
        if (d?.progress != null) setSseProgress(d.progress);
      } catch { /* ignore */ }
    });

    /** Intermediate progress tick */
    es.addEventListener('analysis_progress', (e) => {
      try {
        const d = JSON.parse(e.data);
        advancePhase(PHASE.ANALYSIS_RUNNING);
        if (d?.progress != null) setSseProgress(d.progress);
      } catch { /* ignore */ }
    });

    /** A single pattern / ring found */
    es.addEventListener('pattern_detected', (e) => {
      try {
        const d = JSON.parse(e.data);
        advancePhase(PHASE.PATTERN_DISCOVERY);
        if (d?.progress != null) setSseProgress(d.progress);
      } catch { /* ignore */ }
    });

    es.addEventListener('ring_detected', (e) => {
      try {
        const d = JSON.parse(e.data);
        advancePhase(PHASE.PATTERN_DISCOVERY);
        if (d?.progress != null) setSseProgress(d.progress);
      } catch { /* ignore */ }
    });

    /** Analysis fully complete */
    es.addEventListener('analysis_complete', () => {
      advancePhase(PHASE.THREAT_IDENTIFIED);
      setSseProgress(100);
    });

    /** Fallback: generic message with type field in payload */
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d?.progress != null) setSseProgress(d.progress);
        // type-based routing (some backends send type in payload body)
        if (d?.type === 'analysis_started')   advancePhase(PHASE.DATA_INGESTION);
        if (d?.type === 'analysis_progress')  advancePhase(PHASE.ANALYSIS_RUNNING);
        if (d?.type === 'pattern_detected')   advancePhase(PHASE.PATTERN_DISCOVERY);
        if (d?.type === 'ring_detected')      advancePhase(PHASE.PATTERN_DISCOVERY);
        if (d?.type === 'analysis_complete')  advancePhase(PHASE.THREAT_IDENTIFIED);
      } catch { /* non-JSON heartbeats */ }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [status, advancePhase]);

  return {
    phase,
    sseProgress,   // real backend progress %, null if not yet received
    advancePhase,  // call with NETWORK_REVEALED or INVESTIGATION_READY for manual triggers
  };
}
