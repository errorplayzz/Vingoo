/**
 * ProblemSection.jsx — compact single-viewport cyber-premium layout
 * Left col: headline + stats | Right col: 2×2 card grid
 */
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const PROBLEMS = [
  {
    num: "01",
    title: "Rule engines miss adaptive patterns",
    body: "Threshold rules flag obvious cases, missing novel techniques. Criminals adapt faster than manual updates.",
    accent: "#F87171",
    accentDark: "#EF4444",
    accentBg: "rgba(239,68,68,0.1)",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="8.5" stroke="#F87171" strokeWidth="1.6"/>
        <path d="M11 7.5v4M11 14v.5" stroke="#F87171" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    num: "02",
    title: "Transactions analyzed in isolation",
    body: "Money laundering hides in relationships between accounts — invisible without a graph layer.",
    accent: "#D97706",
    accentDark: "#F59E0B",
    accentBg: "rgba(245,158,11,0.1)",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
        <circle cx="5.5" cy="11" r="2.5" stroke="#D97706" strokeWidth="1.6"/>
        <circle cx="16.5" cy="11" r="2.5" stroke="#D97706" strokeWidth="1.6"/>
        <path d="M8 11h6" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
        <path d="M11 7v8" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4"/>
      </svg>
    ),
  },
  {
    num: "03",
    title: "No account role context",
    body: "A flagged number isn't enough. Is it a controller, mule, or victim? Context drives action.",
    accent: "#C084FC",
    accentDark: "#A855F7",
    accentBg: "rgba(168,85,247,0.1)",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
        <rect x="3" y="5.5" width="16" height="11" rx="2.5" stroke="#C084FC" strokeWidth="1.6"/>
        <path d="M7.5 10.5h7M7.5 13.5h4" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    num: "04",
    title: "Evidence is fragile and disputable",
    body: "Without tamper-evident provenance, AML findings struggle in regulatory and legal contexts.",
    accent: "#60A5FA",
    accentDark: "#3B82F6",
    accentBg: "rgba(59,130,246,0.1)",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
        <path d="M11 2.5l2.2 6.5H20l-5.4 3.9 2.1 6.6L11 15.5l-5.7 4 2.1-6.6L2 8.9h6.8L11 2.5z"
          stroke="#60A5FA" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const STATS = [
  { val: "$3.1T",  label: "laundered annually",  sub: "UNODC" },
  { val: "0.2%",   label: "detection rate",       sub: "of illicit flows" },
  { val: "72hrs",  label: "avg investigation",    sub: "per account" },
  { val: "94%",    label: "false positive rate",  sub: "rule-based" },
];

const EASE = [0.22, 1, 0.36, 1];

export default function ProblemSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.06 });

  return (
    <section
      id="problem"
      ref={ref}
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #F0F4FF 0%, #F5F7FF 35%, #ffffff 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* ── Dot grid ────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          "linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}/>

      {/* ── Glow orbs ───────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-[480px] h-[480px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)" }}/>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 65%)" }}/>

      {/* ── Top edge line ───────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.25), rgba(59,130,246,0.25), transparent)" }}/>

      <div className="container-wide relative w-full py-16">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-10 xl:gap-16 items-center">

          {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, ease: EASE }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border"
              style={{
                background: "rgba(239,68,68,0.1)",
                borderColor: "rgba(239,68,68,0.25)",
              }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-red-400">The Problem</span>
            </div>

            {/* Headline */}
            <h2 className="font-black leading-[1.05] tracking-tight mb-4"
              style={{ fontSize: "clamp(1.9rem, 3.2vw, 2.8rem)", color: "#0F172A" }}>
              Why Traditional<br />Fraud Detection
              <span className="block" style={{
                background: "linear-gradient(135deg, #F87171 0%, #FB923C 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>Fails.</span>
            </h2>

            <p className="text-[0.92rem] leading-relaxed mb-8 max-w-[420px]" style={{ color: "#64748B" }}>
              Current systems were built for a different era. Financial crime has evolved — detection frameworks haven't.
            </p>

            {/* ── Stats 2×2 ──────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {STATS.map(({ val, label, sub }, i) => (
                <motion.div key={label}
                  className="rounded-xl px-4 py-3 border relative overflow-hidden"
                  style={{
                    background: "#ffffff",
                    borderColor: "rgba(99,102,241,0.15)",
                    boxShadow: "0 2px 12px rgba(99,102,241,0.07)",
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.07, ease: EASE }}
                >
                  {/* accent left bar */}
                  <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                    style={{ background: "linear-gradient(180deg, #6366F1, #3B82F6)" }}/>
                  <div className="text-[1.4rem] font-black tabular-nums leading-none mb-1"
                    style={{ color: "#0F172A" }}>
                    {val}
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: "#475569" }}>{label}</div>
                  <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: "#94A3B8" }}>{sub}</div>
                </motion.div>
              ))}
            </div>

            {/* ── CTA nudge ──────────────────────────────────── */}
            <motion.div className="mt-7 flex items-center gap-3"
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.65 }}>
              <div className="h-px w-8" style={{ background: "rgba(99,102,241,0.4)" }}/>
              <span className="text-[11px] font-semibold"
                style={{ color: "#6366F1", letterSpacing: "0.04em" }}>
                Vingoo solves all four — see how ↓
              </span>
            </motion.div>
          </motion.div>

          {/* ══ RIGHT COLUMN — 2×2 Cards ═════════════════════════════ */}
          <div className="grid grid-cols-2 gap-3">
            {PROBLEMS.map((p, i) => (
              <motion.div key={p.title}
                className="group relative rounded-xl border overflow-hidden cursor-default"
                style={{
                  background: "#ffffff",
                  borderColor: "rgba(148,163,184,0.2)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.09, ease: EASE }}
                whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
                  style={{ background: `linear-gradient(90deg, ${p.accentDark}, transparent)` }}/>

                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 30% 30%, ${p.accentBg} 0%, transparent 70%)` }}/>

                {/* Corner glow border on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"
                  style={{ boxShadow: `inset 0 0 0 1px ${p.accent}30` }}/>

                <div className="relative p-4">
                  {/* Top row: icon + number */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: p.accentBg, border: `1px solid ${p.accent}30` }}>
                      {p.icon}
                    </div>
                    <span className="text-[10px] font-black tabular-nums font-mono"
                      style={{ color: p.accent, opacity: 0.55 }}>{p.num}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-[12.5px] font-bold leading-snug mb-2" style={{ color: "#0F172A" }}>
                    {p.title}
                  </h3>

                  {/* Body */}
                  <p className="text-[11.5px] leading-relaxed" style={{ color: "#64748B" }}>
                    {p.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Bottom edge line ───────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.2), rgba(59,130,246,0.2), transparent)" }}/>
    </section>
  );
}

