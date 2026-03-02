import { motion } from "framer-motion";
import { useCallback } from "react";

const EASE = [0.22, 1, 0.36, 1];

export default function FinalCTA() {

  const handleClick = useCallback((e) => {
    e.preventDefault();
    const el = document.getElementById("upload");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <section
      id="cta"
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #F5F8FF 0%, #F0F5FF 40%, #ffffff 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          "linear-gradient(rgba(99,102,241,0.055) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(99,102,241,0.055) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}/>

      {/* Glow orbs */}
      <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(59,130,246,0.09) 0%, transparent 60%)" }}/>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)" }}/>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)" }}/>

      {/* Top edge line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.25), rgba(99,102,241,0.25), transparent)" }}/>

      {/* Animated concentric rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: `${200 + i * 180}px`,
              height: `${200 + i * 180}px`,
              borderColor: `rgba(59,130,246,${0.06 - i * 0.015})`,
            }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
        ))}
      </div>

      <div className="container-wide relative w-full py-0 flex flex-col items-center text-center z-10">

        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8 border"
          style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)" }}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-blue-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 2.2 }}
          />
          <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-blue-500">
            Investigation Ready
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="font-black tracking-tight mb-5"
          style={{
            fontSize: "clamp(2.8rem, 6.5vw, 5rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.035em",
            color: "#0F172A",
          }}
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
        >
          Run a Live
          <br />
          <span style={{
            background: "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Investigation.
          </span>
        </motion.h2>

        {/* Subtext */}
        <motion.p
          className="text-[1.05rem] max-w-[420px] mb-10 leading-relaxed"
          style={{ color: "#64748B" }}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.22, ease: EASE }}
        >
          Drop a CSV. The engine maps the network, scores every account, and seals the evidence.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.34, ease: EASE }}
        >
          <motion.a
            href="#upload"
            onClick={handleClick}
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl text-[15px] font-bold relative overflow-hidden text-white"
            style={{
              background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
              boxShadow: "0 6px 36px rgba(29,78,216,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
            whileHover={{
              scale: 1.03,
              y: -2,
              boxShadow: "0 14px 52px rgba(29,78,216,0.6), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            <span className="relative z-10">Run a Live Investigation</span>
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

        {/* Feature chips row */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3 mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          {[
            { icon: "⚡", label: "<11s analysis" },
            { icon: "🎯", label: "97.2% accuracy" },
            { icon: "🔗", label: "4 pattern engines" },
            { icon: "🔒", label: "SHA-256 verified" },
          ].map((f) => (
            <div key={f.label}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border"
              style={{
                background: "rgba(255,255,255,0.75)",
                borderColor: "rgba(148,163,184,0.2)",
                boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                backdropFilter: "blur(8px)",
              }}>
              <span className="text-[13px]">{f.icon}</span>
              <span className="text-[11px] font-semibold" style={{ color: "#475569" }}>{f.label}</span>
            </div>
          ))}
        </motion.div>

      </div>

      {/* Bottom edge line */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.15), rgba(99,102,241,0.15), transparent)" }}/>
    </section>
  );
}
