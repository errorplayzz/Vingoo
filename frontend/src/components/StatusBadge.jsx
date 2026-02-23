/**
 * components/StatusBadge.jsx
 * Shows live API health: pings /health on mount and every 45 s.
 */
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "../context/AnalysisContext";

const CONFIG = {
  healthy:  { color: "#22C55E", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  label: "API connected",  dot: true  },
  degraded: { color: "#EF4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.22)",  label: "API degraded",   dot: false },
  unknown:  { color: "#94A3B8", bg: "rgba(148,163,184,0.10)",border: "rgba(148,163,184,0.20)",label: "Checking…",      dot: false },
};

export default function StatusBadge() {
  const { apiHealth, pingHealth } = useAnalysis();

  useEffect(() => {
    pingHealth();
    const id = setInterval(pingHealth, 45_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = CONFIG[apiHealth] ?? CONFIG.unknown;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={apiHealth}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold select-none"
        style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25 }}
        title={`Backend status: ${apiHealth}`}
      >
        {cfg.dot ? (
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: cfg.color }}
          />
        ) : (
          <span
            className="w-1.5 h-1.5 rounded-full opacity-60"
            style={{ background: cfg.color }}
          />
        )}
        {cfg.label}
      </motion.div>
    </AnimatePresence>
  );
}
