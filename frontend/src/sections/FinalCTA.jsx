import { motion } from "framer-motion";
import {
  INVESTIGATION_STATE,
  isStateAtLeast,
  useInvestigationState,
} from "../context/InvestigationContext";

const EASE = [0.22, 1, 0.36, 1];

export default function FinalCTA() {
  const { investigationState } = useInvestigationState();
  const canRunInvestigation = isStateAtLeast(investigationState, INVESTIGATION_STATE.INTELLIGENCE_READY);

  return (
    <section
      id="cta"
      className="relative overflow-hidden bg-slate-50 border-t border-slate-200"
    >

      <div className="container-wide py-32 flex flex-col items-center text-center relative z-10">

        {/* Top tag */}
        <motion.div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-10 bg-blue-50 border border-blue-200"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-blue-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 2.2 }}
          />
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-blue-600">
            Investigation Ready
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="font-black tracking-tight mb-6 text-ink"
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
          }}
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
        >
          Run a Live
          <br />
          <span className="text-blue-600">Investigation.</span>
        </motion.h2>

        {/* Sub */}
        <motion.p
          className="text-[1.05rem] max-w-sm mb-10 leading-relaxed text-muted"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.22, ease: EASE }}
        >
          Drop a CSV. The engine maps the network, scores every account, and seals the evidence.
        </motion.p>

        {/* CTA button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.34, ease: EASE }}
        >
          <motion.a
            href="#upload"
            aria-disabled={!canRunInvestigation}
            onClick={(e) => {
              if (!canRunInvestigation) e.preventDefault();
            }}
            className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-[15px] font-bold relative overflow-hidden transition-all duration-300 ${
              canRunInvestigation
                ? "text-white"
                : "text-slate-500 cursor-not-allowed"
            }`}
            style={{
              background: canRunInvestigation
                ? "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)"
                : "#E2E8F0",
              boxShadow: canRunInvestigation
                ? "0 6px 36px rgba(29,78,216,0.50), inset 0 1px 0 rgba(255,255,255,0.18)"
                : "none",
            }}
            whileHover={canRunInvestigation ? {
              scale: 1.03,
              y: -2,
              boxShadow: "0 14px 52px rgba(29,78,216,0.65), inset 0 1px 0 rgba(255,255,255,0.22)",
            } : {}}
            whileTap={canRunInvestigation ? { scale: 0.98 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            <span className="relative z-10">Run a Live Investigation</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="relative z-10">
              <path d="M3.5 8h9M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Shimmer */}
            {canRunInvestigation && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPositionX: ["200%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
              />
            )}
          </motion.a>
        </motion.div>

        {/* Stat strip */}
        <motion.p
          className="mt-10 text-[12px] font-mono text-muted tracking-wide"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          &lt;11s analysis &nbsp;·&nbsp; 97.2% accuracy &nbsp;·&nbsp; 4 pattern engines &nbsp;·&nbsp; SHA-256 verified
        </motion.p>

      </div>
    </section>
  );
}
