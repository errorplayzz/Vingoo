import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

export default function FinalCTA() {
  return (
    <section
      id="cta"
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #070D1C 0%, #060B18 50%, #04080F 100%)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Centre glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 40%, rgba(29,78,216,0.14) 0%, transparent 68%)",
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="container-wide py-32 flex flex-col items-center text-center relative z-10">

        {/* Top tag */}
        <motion.div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-10"
          style={{ background: "rgba(29,78,216,0.12)", border: "1px solid rgba(59,130,246,0.20)" }}
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
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "rgba(147,197,253,0.80)" }}>
            Investigation Ready
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="font-black tracking-tight mb-6"
          style={{
            fontSize: "clamp(2.6rem, 7vw, 5.5rem)",
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            color: "rgba(255,255,255,0.94)",
          }}
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
        >
          Start your
          <br />
          <span
            style={{
              background: "linear-gradient(95deg, #60A5FA 0%, #818CF8 60%, #A78BFA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            investigation.
          </span>
        </motion.h2>

        {/* Sub */}
        <motion.p
          className="text-[1.1rem] max-w-md mb-12 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.38)" }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.22, ease: EASE }}
        >
          Drop a transaction CSV. The engine maps the network, detects patterns, and seals intelligence — in under 11 seconds.
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
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-[15px] font-bold text-white relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
              boxShadow: "0 6px 36px rgba(29,78,216,0.50), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
            whileHover={{
              scale: 1.06,
              y: -3,
              boxShadow: "0 14px 52px rgba(29,78,216,0.65), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            <span className="relative z-10">Upload Transactions</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="relative z-10">
              <path d="M3.5 8h9M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPositionX: ["200%", "-100%"] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
            />
          </motion.a>
        </motion.div>

        {/* Stat strip */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-16"
          style={{ borderTop: "1px solid rgba(255,255,255,0.055)", paddingTop: "2rem" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          {[
            ["< 11s", "Full analysis"],
            ["97.2%", "Detection accuracy"],
            ["4", "Pattern engines"],
            ["SHA-256", "Evidence sealed"],
          ].map(([val, label]) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-2xl font-black tabular-nums tracking-tight" style={{ color: "rgba(255,255,255,0.88)" }}>{val}</span>
              <span className="text-[11px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</span>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
