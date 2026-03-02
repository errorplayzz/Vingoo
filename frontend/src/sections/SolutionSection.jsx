/**
 * SolutionSection.jsx — premium single-viewport redesign
 * Left col: headline + meta + CTA  |  Right col: vertical timeline cards
 */
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const STEPS = [
  {
    step: "01",
    title: "Upload Transaction Data",
    body: "Drop a CSV with sender, receiver, amount and timestamp. VINGOO ingests it instantly and constructs a directed graph — no reformatting required.",
    badge: "CSV Upload",
    metric: "< 3s ingest",
    color: "#3B82F6",
    colorLight: "rgba(59,130,246,0.1)",
    colorBorder: "rgba(59,130,246,0.2)",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 22 22">
        <path d="M11 15V5M7 9l4-4 4 4" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 17v1.5A1.5 1.5 0 004.5 20h13a1.5 1.5 0 001.5-1.5V17" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    step: "02",
    title: "Graph Intelligence Engine",
    body: "Four detectors run in parallel — cycle detection, smurfing analysis, shell chain mapping, high-velocity scoring. NetworkX surfaces what spreadsheets cannot.",
    badge: "4 Detectors",
    metric: "Parallel analysis",
    color: "#8B5CF6",
    colorLight: "rgba(139,92,246,0.1)",
    colorBorder: "rgba(139,92,246,0.2)",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 22 22">
        <circle cx="5" cy="11" r="2.5" stroke="#8B5CF6" strokeWidth="1.5"/>
        <circle cx="17" cy="5" r="2.5" stroke="#8B5CF6" strokeWidth="1.5"/>
        <circle cx="17" cy="17" r="2.5" stroke="#8B5CF6" strokeWidth="1.5"/>
        <circle cx="11" cy="11" r="2.5" stroke="#8B5CF6" strokeWidth="1.5"/>
        <path d="M7.5 11h1M13.5 11h1M14.8 6.8l-2 2.5M14.8 15.2l-2-2.5" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    step: "03",
    title: "Role Classification & Evidence Seal",
    body: "Every flagged account gets a role: CONTROLLER, MULE, or POSSIBLE_VICTIM. The full report is sealed with a SHA-256 integrity hash — tamper-evident and court-ready.",
    badge: "Tamper-Evident",
    metric: "SHA-256 sealed",
    color: "#10B981",
    colorLight: "rgba(16,185,129,0.1)",
    colorBorder: "rgba(16,185,129,0.2)",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 22 22">
        <path d="M11 3l2 4h4.5L14 9.5l1.5 4.5L11 11.5 7.5 14 9 9.5 5.5 7H10L11 3z" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 17l2 2 4-4" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const EASE = [0.22, 1, 0.36, 1];

export default function SolutionSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.06 });

  return (
    <section
      id="solution"
      ref={ref}
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #F8FAFF 0%, #F3F6FF 35%, #ffffff 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}/>
      {/* Glow top-right */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)" }}/>
      {/* Glow bottom-left */}
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)" }}/>
      {/* Top edge line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.2), rgba(59,130,246,0.2), transparent)" }}/>

      <div className="container-wide relative w-full py-16">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-12 xl:gap-20 items-center">

          {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, ease: EASE }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border"
              style={{ background: "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-indigo-500">How It Works</span>
            </div>

            {/* Headline */}
            <h2 className="font-black leading-[1.05] tracking-tight mb-4"
              style={{ fontSize: "clamp(1.9rem, 3.2vw, 2.8rem)", color: "#0F172A" }}>
              Three steps from<br />raw data to
              <span className="block" style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>actionable intelligence.</span>
            </h2>

            <p className="text-[0.92rem] leading-relaxed mb-8 max-w-[400px]" style={{ color: "#64748B" }}>
              Upload a CSV, let the graph engine run, get a sealed intelligence report — all in under a minute.
            </p>

            {/* Step nav dots */}
            <div className="flex flex-col gap-3 mb-8">
              {STEPS.map((s, i) => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border"
                    style={{ background: s.colorLight, borderColor: s.colorBorder, color: s.color }}>
                    {i + 1}
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: "#475569" }}>{s.title}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <div className="h-px w-8" style={{ background: "rgba(99,102,241,0.3)" }}/>
              <span className="text-[11px] font-semibold" style={{ color: "#6366F1", letterSpacing: "0.04em" }}>
                Upload your data to see it live ↓
              </span>
            </div>
          </motion.div>

          {/* ══ RIGHT COLUMN — Vertical Timeline ═════════════════════ */}
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[19px] top-10 bottom-10 w-px hidden xl:block"
              style={{ background: "linear-gradient(180deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3), rgba(16,185,129,0.3))" }}/>

            <div className="flex flex-col gap-4">
              {STEPS.map((s, i) => (
                <motion.div key={s.step}
                  className="group relative flex gap-4"
                  initial={{ opacity: 0, x: 24 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.12, ease: EASE }}
                >
                  {/* Timeline dot */}
                  <div className="relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 border-2"
                    style={{ background: s.colorLight, borderColor: s.color, boxShadow: `0 0 0 4px ${s.colorLight}` }}>
                    {s.icon}
                  </div>

                  {/* Card */}
                  <motion.div
                    className="flex-1 rounded-xl border p-4 cursor-default overflow-hidden relative"
                    style={{
                      background: "#ffffff",
                      borderColor: "rgba(148,163,184,0.2)",
                      boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                    }}
                    whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
                  >
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
                      style={{ background: `linear-gradient(90deg, ${s.color}, transparent)` }}/>

                    {/* Hover glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                      style={{ background: `radial-gradient(ellipse at 10% 50%, ${s.colorLight} 0%, transparent 70%)` }}/>

                    <div className="relative">
                      {/* Top row */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold tracking-[0.15em]"
                          style={{ color: s.color }}>STEP {s.step}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                          style={{ background: s.colorLight, borderColor: s.colorBorder, color: s.color }}>
                          {s.metric}
                        </span>
                      </div>

                      <h3 className="text-[13.5px] font-bold mb-1.5 leading-snug" style={{ color: "#0F172A" }}>
                        {s.title}
                      </h3>
                      <p className="text-[12px] leading-relaxed" style={{ color: "#64748B" }}>
                        {s.body}
                      </p>

                      {/* Badge */}
                      <div className="mt-3 inline-flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }}/>
                        <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: s.color }}>
                          {s.badge}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Bottom edge line */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.15), rgba(59,130,246,0.15), transparent)" }}/>
    </section>
  );
}
