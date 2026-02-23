/**
 * intelligence/EventNotification.jsx
 *
 * Small floating event notifications that surface during the investigation.
 * Each phase transition shows a distinct notification for 3.5 s, then dismisses.
 *
 * Design rules
 * ────────────
 * • Fixed to bottom-right: never covers working content
 * • No queuing — only the most recent event shown (override previous)
 * • Professional, minimal: no emoji on INVESTIGATION_READY; small text
 * • Safe to mount permanently — renders null in IDLE phase
 *
 * Usage (once per page, recommended in InvestigationPage + UploadAnalysis):
 *   <EventNotification phase={phase} />
 */

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence }   from 'framer-motion';
import { PHASE }                     from './useInvestigationPhase';

const PHASE_EVENTS = {
  [PHASE.DATA_INGESTION]:     {
    dot: 'bg-blue-500',
    label: 'Data ingestion active',
    cls: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  [PHASE.ANALYSIS_RUNNING]:   {
    dot: 'bg-slate-500',
    label: 'Graph analysis running',
    cls: 'text-slate-700 bg-slate-50 border-slate-200',
  },
  [PHASE.PATTERN_DISCOVERY]:  {
    dot: 'bg-amber-500 animate-pulse',
    label: 'Pattern detected',
    cls: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  [PHASE.THREAT_IDENTIFIED]:  {
    dot: 'bg-red-500 animate-pulse',
    label: 'Threat identified',
    cls: 'text-red-700 bg-red-50 border-red-200',
  },
  [PHASE.NETWORK_REVEALED]:   {
    dot: 'bg-violet-500',
    label: 'Network graph revealed',
    cls: 'text-violet-700 bg-violet-50 border-violet-200',
  },
  [PHASE.INVESTIGATION_READY]:{
    dot: 'bg-green-500',
    label: 'Analyst control enabled',
    cls: 'text-green-700 bg-green-50 border-green-200',
  },
};

const EASE = [0.22, 1, 0.36, 1];

const EventNotification = memo(function EventNotification({ phase }) {
  const [visible,      setVisible]      = useState(false);
  const [displayPhase, setDisplayPhase] = useState(null);

  useEffect(() => {
    if (!phase || phase === PHASE.IDLE) {
      setVisible(false);
      return;
    }

    setDisplayPhase(phase);
    setVisible(true);

    const t = setTimeout(() => setVisible(false), 3_500);
    return () => clearTimeout(t);
  }, [phase]);

  const ev = PHASE_EVENTS[displayPhase];
  if (!ev) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={displayPhase}
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${ev.cls}`}
          style={{
            boxShadow:       '0 4px 24px rgba(0,0,0,0.10)',
            backdropFilter:  'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit   ={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {/* Dot indicator */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.dot}`} />

          {/* Label */}
          <span className="text-[12px] font-semibold tracking-wide">{ev.label}</span>

          {/* Dismiss button */}
          <button
            onClick={() => setVisible(false)}
            className="ml-1 opacity-50 hover:opacity-100 transition-opacity text-[11px]"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default EventNotification;
