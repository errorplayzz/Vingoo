/**
 * SystemNarration.jsx
 *
 * A top-center fixed overlay that displays short system narration messages
 * during demo mode.  Each stage has its own message.  Messages fade in/out
 * automatically and never block interaction.
 *
 * Placement: fixed, top-20px, centered, z-index 9000.
 * Visibility: only renders when isDemoMode === true.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useDemoFlow, DEMO_STAGE } from "./useDemoFlow";

// ── Stage → message mapping ───────────────────────────────────────────────
const STAGE_MESSAGES = {
  [DEMO_STAGE.DATA_INGESTED]:      "Ingesting transaction dataset...",
  [DEMO_STAGE.GRAPH_BUILT]:        "Constructing financial transaction network...",
  [DEMO_STAGE.PATTERNS_DETECTED]:  "Detecting coordinated fraud patterns...",
  [DEMO_STAGE.ROLES_IDENTIFIED]:   "Classifying account roles — Controller · Mule · Victim",
  [DEMO_STAGE.INTELLIGENCE_READY]: "Investigation intelligence ready.",
};

// ── Motion variants ───────────────────────────────────────────────────────
const variants = {
  initial: { opacity: 0, y: -12, scale: 0.97 },
  animate: { opacity: 1, y: 0,   scale: 1,    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8,  scale: 0.98, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

// ── Component ─────────────────────────────────────────────────────────────
export default function SystemNarration() {
  const { currentDemoStep, isDemoMode, isActive } = useDemoFlow();

  if (!isDemoMode) return null;

  const message = STAGE_MESSAGES[currentDemoStep] ?? null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9000] pointer-events-none"
    >
      <AnimatePresence mode="wait">
        {isActive && message && (
          <motion.div
            key={currentDemoStep}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="
              flex items-center gap-2.5
              px-5 py-2.5
              rounded-full
              border border-blue-400/30
              bg-[rgba(8,16,36,0.88)]
              backdrop-blur-md
              shadow-[0_0_28px_rgba(59,130,246,0.18)]
            "
          >
            {/* Pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>

            {/* Message */}
            <span
              className="
                text-[11px] font-mono tracking-widest uppercase
                text-blue-200/90
                whitespace-nowrap
              "
            >
              SYS &nbsp;▸&nbsp; {message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
