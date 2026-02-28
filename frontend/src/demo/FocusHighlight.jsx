/**
 * FocusHighlight.jsx
 *
 * Auto-focuses judge attention on key UI areas in sequence during demo mode.
 *
 * How it works:
 *   1. Each demo stage maps to a DOM element identified by data-focus-target="<key>"
 *   2. The component uses getBoundingClientRect to position a pulsing highlight ring
 *      over that element, with a light overlay that dims the rest of the viewport.
 *   3. Advances automatically as the demo stage changes.
 *
 * To register a focus target, add data-focus-target="<key>" to any DOM element:
 *   <section data-focus-target="upload">...</section>
 *   <div data-focus-target="graph">...</div>
 *   <div data-focus-target="risk-score">...</div>
 *   <div data-focus-target="roles">...</div>
 *
 * Renders nothing when isDemoMode === false.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDemoFlow, DEMO_STAGE } from "./useDemoFlow";

// ── Stage → focus-target key mapping ────────────────────────────────────────
const STAGE_TARGET = {
  [DEMO_STAGE.DATA_INGESTED]:      "upload",
  [DEMO_STAGE.GRAPH_BUILT]:        "graph",
  [DEMO_STAGE.PATTERNS_DETECTED]:  "patterns",
  [DEMO_STAGE.ROLES_IDENTIFIED]:   "roles",
  [DEMO_STAGE.INTELLIGENCE_READY]: null,   // no highlight — full picture
};

// Padding around the highlighted element (px)
const PAD = 12;

// ── Component ────────────────────────────────────────────────────────────────
export default function FocusHighlight() {
  const { currentDemoStep, isDemoMode, isActive } = useDemoFlow();
  const [rect, setRect] = useState(null);       // DOMRect of highlighted element
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);

  const measureTarget = useCallback((targetKey) => {
    if (!targetKey) {
      setRect(null);
      setVisible(false);
      return;
    }
    const el = document.querySelector(`[data-focus-target="${targetKey}"]`);
    if (!el) {
      setRect(null);
      setVisible(false);
      return;
    }
    // Scroll element into view smoothly
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Measure after scroll settles (~500ms)
    rafRef.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect({
        top:    r.top    - PAD,
        left:   r.left   - PAD,
        width:  r.width  + PAD * 2,
        height: r.height + PAD * 2,
      });
      setVisible(true);
    }, 520);
  }, []);

  useEffect(() => {
    if (!isDemoMode || !isActive) {
      setVisible(false);
      return;
    }
    const targetKey = STAGE_TARGET[currentDemoStep] ?? null;
    measureTarget(targetKey);
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [currentDemoStep, isDemoMode, isActive, measureTarget]);

  if (!isDemoMode) return null;

  return (
    <AnimatePresence>
      {visible && rect && (
        <>
          {/* Dim overlay (pointer-events off so UI stays interactive) */}
          <motion.div
            key="focus-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[8990] pointer-events-none"
            style={{ background: "rgba(4, 9, 20, 0.35)" }}
          />

          {/* Highlight ring */}
          <motion.div
            key={`focus-ring-${currentDemoStep}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[8999] pointer-events-none rounded-xl"
            style={{
              top:    rect.top,
              left:   rect.left,
              width:  rect.width,
              height: rect.height,
              border: "1.5px solid rgba(96, 165, 250, 0.70)",
              boxShadow: [
                "0 0 0 3px rgba(59,130,246,0.10)",
                "0 0 28px 4px rgba(59,130,246,0.18)",
              ].join(", "),
            }}
          >
            {/* Corner accents */}
            {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map(
              (pos, i) => (
                <span
                  key={i}
                  className={`absolute ${pos} w-3 h-3 border-blue-400`}
                  style={{
                    borderTopWidth:    i < 2 ? 2 : 0,
                    borderBottomWidth: i >= 2 ? 2 : 0,
                    borderLeftWidth:   i % 2 === 0 ? 2 : 0,
                    borderRightWidth:  i % 2 === 1 ? 2 : 0,
                    borderColor: "rgba(96,165,250,0.90)",
                    borderStyle: "solid",
                  }}
                />
              ),
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
