/**
 * IngestOverlay.jsx
 * Cinematic 3-phase transition shown between CSV upload completion
 * and navigating to the investigation page.
 * Sequence: INGESTING DATA → BUILDING TRANSACTION GRAPH → RUNNING DETECTION ENGINES
 * Total duration: ~1.8 s, then calls onComplete().
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PHASES = [
  { id: 0, label: "INGESTING DATA",              sub: "Parsing transaction records" },
  { id: 1, label: "BUILDING TRANSACTION GRAPH",  sub: "Mapping account relationships" },
  { id: 2, label: "RUNNING DETECTION ENGINES",   sub: "Cycle · Smurfing · Shell · Velocity" },
];

const PHASE_DURATION = 560;  // ms per phase
const FADE_OUT_DELAY = PHASES.length * PHASE_DURATION + 120;

export default function IngestOverlay({ onComplete }) {
  const [phase, setPhase]       = useState(0);
  const [leaving, setLeaving]   = useState(false);

  useEffect(() => {
    // Advance phase labels
    const timers = PHASES.slice(1).map((_, i) =>
      setTimeout(() => setPhase(i + 1), (i + 1) * PHASE_DURATION)
    );

    // Start fade-out
    const leaveTimer = setTimeout(() => setLeaving(true), FADE_OUT_DELAY);

    // Signal parent after overlay fully exits
    const doneTimer = setTimeout(() => onComplete?.(), FADE_OUT_DELAY + 420);

    return () => [...timers, leaveTimer, doneTimer].forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.round(((phase + 1) / PHASES.length) * 100);

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          key="ingest-overlay"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "rgba(4, 8, 18, 0.97)", backdropFilter: "blur(12px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Scanline shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(29,78,216,0.025) 2px, rgba(29,78,216,0.025) 4px)",
            }}
          />

          {/* Central content */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">

            {/* Spinning ring */}
            <div className="relative w-16 h-16 mb-8">
              <motion.svg
                className="absolute inset-0"
                viewBox="0 0 64 64"
                animate={{ rotate: 360 }}
                transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
              >
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="rgba(29,78,216,0.25)"
                  strokeWidth="2"
                />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="rgba(59,130,246,0.80)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="40 136"
                />
              </motion.svg>
              {/* Inner dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  className="w-2.5 h-2.5 rounded-full bg-blue-400"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0.5, 0.9] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                />
              </div>
            </div>

            {/* Phase label */}
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                className="text-[11px] font-mono font-bold tracking-[0.24em] uppercase mb-2"
                style={{ color: "rgba(147,197,253,0.90)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {PHASES[phase].label}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.p
                key={`sub-${phase}`}
                className="text-[12px] font-mono mb-8"
                style={{ color: "rgba(255,255,255,0.28)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {PHASES[phase].sub}
              </motion.p>
            </AnimatePresence>

            {/* Progress bar */}
            <div
              className="w-48 h-[2px] rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #1D4ED8, #3B82F6)" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            {/* Phase dots */}
            <div className="flex items-center gap-2 mt-4">
              {PHASES.map((p) => (
                <motion.span
                  key={p.id}
                  className="rounded-full"
                  animate={{
                    width:   p.id <= phase ? "18px" : "6px",
                    height:  "6px",
                    background: p.id <= phase
                      ? "rgba(59,130,246,0.90)"
                      : "rgba(255,255,255,0.15)",
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
