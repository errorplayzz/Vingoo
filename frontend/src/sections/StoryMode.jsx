import { useRef, useState, memo } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";

const EASE = [0.4, 0, 0.2, 1];

/* -- Animated transaction counter ------------------------------------------ */
function CounterDisplay({ scrollYProgress, start, end }) {
  const [count, setCount] = useState(0);
  const raw = useTransform(scrollYProgress, [start, end], [0, 9613]);
  useMotionValueEvent(raw, "change", (v) => setCount(Math.round(v)));
  return <span className="tabular-nums">{count.toLocaleString()}</span>;
}

/* -- Animated SVG cycle diagram -------------------------------------------- */
function CycleDiagram({ scrollYProgress, start, end }) {
  const opacity = useTransform(scrollYProgress, [start, start + 0.06, end - 0.04, end], [0, 1, 1, 0]);

  const edgeDash0 = useTransform(scrollYProgress, [start + 0.00, start + 0.10], [300, 0]);
  const edgeDash1 = useTransform(scrollYProgress, [start + 0.04, start + 0.14], [300, 0]);
  const edgeDash2 = useTransform(scrollYProgress, [start + 0.08, start + 0.18], [300, 0]);
  const edgeDash3 = useTransform(scrollYProgress, [start + 0.12, start + 0.22], [300, 0]);
  const edgeDashes = [edgeDash0, edgeDash1, edgeDash2, edgeDash3];

  const nodes = [
    { cx: 80,  cy: 60,  label: "ACC_A" },
    { cx: 200, cy: 60,  label: "ACC_B" },
    { cx: 240, cy: 140, label: "ACC_C" },
    { cx: 40,  cy: 140, label: "ACC_D" },
  ];

  return (
    <motion.div className="w-full max-w-sm mx-auto" style={{ opacity }}>
      {/* Score badge */}
      <motion.div
        className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border"
        style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-[12px] font-bold" style={{ color: "#DC2626" }}>Risk Score: 94 / 100</span>
      </motion.div>

      <svg viewBox="0 0 280 200" className="w-full h-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#3B82F6" fillOpacity="0.8" />
          </marker>
        </defs>
        {[[80,60,200,60],[200,60,240,140],[240,140,40,140],[40,140,80,60]].map(([x1,y1,x2,y2],i) => (
          <motion.line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#3B82F6" strokeWidth="2" strokeOpacity="0.7"
            strokeDasharray="300"
            style={{ strokeDashoffset: edgeDashes[i] }} />
        ))}
        {nodes.map(({ cx, cy, label }) => (
          <g key={label}>
            <circle cx={cx} cy={cy} r={18} fill="white" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.4"
              style={{ filter: "drop-shadow(0 2px 8px rgba(59,130,246,0.15))" }} />
            <circle cx={cx} cy={cy} r={7} fill="#3B82F6" />
            <text x={cx} y={cy + 30} textAnchor="middle" fontSize="8.5" fill="#64748B" fontFamily="monospace">{label}</text>
          </g>
        ))}
        <text x="140" y="52"  textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,800</text>
        <text x="232" y="104" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,700</text>
        <text x="140" y="155" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,600</text>
        <text x="48"  y="104" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,500</text>
      </svg>

      {/* Metadata chips */}
      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {["4 accounts", "6 transfers", "168-hour window", "Closed loop"].map((t) => (
          <span key={t} className="text-[10px] font-semibold px-2.5 py-1 rounded-full border"
            style={{ background: "rgba(59,130,246,0.07)", borderColor: "rgba(59,130,246,0.18)", color: "#3B82F6" }}>
            {t}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* -- Beat panel ------------------------------------------------------------- */
const BeatPanel = memo(function BeatPanel({ beat, index, total, scrollYProgress }) {
  const start = index / total;
  const mid   = (index + 0.5) / total;
  const end   = (index + 1) / total;

  const opacity = useTransform(scrollYProgress, [start, start + 0.07, mid, end - 0.05, end], [0, 1, 1, 1, 0]);
  const y       = useTransform(scrollYProgress, [start, start + 0.1, mid, end], [20, 0, 0, -20]);

  const ACCENT_COLORS = ["#3B82F6","#6366F1","#EF4444","#8B5CF6","#10B981","#F59E0B"];
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ opacity, y }}
    >
      {/* Phase badge */}
      <motion.div
        className="mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border"
        style={{ background: `${accentColor}10`, borderColor: `${accentColor}30`, backdropFilter: "blur(12px)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }}/>
        <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: accentColor }}>
          {beat.phase}
        </span>
      </motion.div>

      {/* Headline */}
      <h2 className="font-black mb-4 max-w-2xl"
        style={{
          fontSize: "clamp(2.2rem, 5.5vw, 4.2rem)",
          lineHeight: "1.05",
          letterSpacing: "-0.03em",
          color: "#0F172A",
        }}
      >
        {beat.headline}
      </h2>

      {/* Sub */}
      <p className="text-lg md:text-xl max-w-xl leading-relaxed mb-4" style={{ color: "#64748B" }}>
        {beat.sub}
      </p>

      {/* Counter for beat 0 */}
      {index === 0 && (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-black tabular-nums"
            style={{ fontSize: "clamp(2.5rem, 6vw, 3.8rem)", letterSpacing: "-0.04em", color: "#0F172A" }}>
            <CounterDisplay scrollYProgress={scrollYProgress} start={start + 0.05} end={mid - 0.05} />
          </span>
          <span className="text-xl font-semibold" style={{ color: "#94A3B8" }}>transactions</span>
        </div>
      )}

      {/* Cycle diagram for beat 2 */}
      {index === 2 && (
        <div className="mt-6 w-full max-w-sm">
          <CycleDiagram scrollYProgress={scrollYProgress} start={start + 0.05} end={end - 0.05} />
        </div>
      )}

      {/* Detail */}
      {beat.detail && (
        <p className="text-sm max-w-sm leading-relaxed mt-3 font-mono" style={{ color: "#94A3B8" }}>
          {beat.detail}
        </p>
      )}

      {/* Step dots */}
      <div className="flex gap-2 mt-8">
        {Array.from({ length: total }).map((_, j) => (
          <div key={j} className="rounded-full transition-all duration-300"
            style={{
              width:      j === index ? 20 : 5,
              height:     5,
              background: j === index ? accentColor : "rgba(148,163,184,0.3)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
});

/* -- Beat data -------------------------------------------------------------- */
const BEATS = [
  { chapter: "01", phase: "01 / INGEST",   headline: "Data received.",            sub: "9,613 raw transaction records. Flat CSV. No structure visible yet.",                                     detail: "Sender \u00b7 Receiver \u00b7 Amount \u00b7 Timestamp. The engine takes over." },
  { chapter: "02", phase: "02 / MAP",       headline: "The network emerges.",      sub: "Every transfer becomes a directed edge. 847 unique nodes surface from the noise.",                       detail: "Graph constructed. Topology exposes what tables hide." },
  { chapter: "03", phase: "03 / DETECT",    headline: "Pattern: Cycle detected.",  sub: "A closed money loop. Funds cycling through four coordinated accounts.",                                   detail: null },
  { chapter: "04", phase: "04 / CLASSIFY",  headline: "Roles assigned.",           sub: "Controller. Mule. Possible Victim. Each account classified by financial behaviour.",                     detail: "Flow imbalance \u00b7 graph centrality \u00b7 pattern participation \u2192 role probability." },
  { chapter: "05", phase: "05 / EXPLAIN",   headline: "AI explains.",              sub: "Coordinated layering scheme. High confidence. Investigator-ready narrative generated.",                  detail: "LLM translates graph signals into court-ready intelligence language." },
  { chapter: "06", phase: "06 / SEAL",      headline: "Evidence sealed.",          sub: "SHA-256 integrity seal applied. Tamper-evident. Every detail locked at analysis time.",                  detail: "sha256:a3f4d1e7b2c09f8a\u2026 \u2014 Verifiable at /verify/{id}" },
];

/* -- Chapter Timeline ------------------------------------------------------- */
const ChapterTimeline = memo(function ChapterTimeline({ chapters, activeIndex }) {
  return (
    <div className="absolute left-5 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col items-center gap-0" aria-hidden>
      {chapters.map((beat, i) => {
        const isActive = i === activeIndex;
        const isPast   = i < activeIndex;
        return (
          <div key={beat.chapter} className="flex flex-col items-center">
            {i > 0 && (
              <motion.div className="w-px" style={{ height: 28 }}
                animate={{ background: isPast || isActive ? "rgba(59,130,246,0.45)" : "rgba(148,163,184,0.25)" }}
                transition={{ duration: 0.4 }}
              />
            )}
            <motion.div className="relative flex flex-col items-center"
              animate={isActive ? { scale: 1.12 } : { scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {isActive && (
                <motion.div className="absolute inset-0 rounded-full border border-blue-400/40"
                  initial={{ scale: 1, opacity: 0 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                  style={{ margin: -4 }}
                />
              )}
              <motion.div className="w-2.5 h-2.5 rounded-full border-2"
                animate={{
                  backgroundColor: isActive ? "#3B82F6" : isPast ? "rgba(59,130,246,0.45)" : "transparent",
                  borderColor:     isActive ? "#3B82F6" : isPast ? "rgba(59,130,246,0.45)" : "rgba(148,163,184,0.4)",
                }}
                transition={{ duration: 0.35 }}
              />
              <motion.span className="absolute left-5 top-0 text-[10px] font-bold font-mono whitespace-nowrap"
                animate={{ opacity: isActive ? 1 : 0, color: "#3B82F6", x: isActive ? 0 : -4 }}
                transition={{ duration: 0.25 }}
              >
                {beat.chapter}
              </motion.span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
});

/* -- StoryMode -------------------------------------------------------------- */
export default function StoryMode() {
  const containerRef = useRef(null);
  const n = BEATS.length;
  const [activeBeat, setActiveBeat] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(v * n)));
    setActiveBeat(idx);
  });

  return (
    <section
      ref={containerRef}
      data-focus-target="patterns"
      className="relative"
      style={{
        height: `${(n + 0.6) * 100}vh`,
        background: "linear-gradient(180deg, #F5F8FF 0%, #F0F4FF 50%, #ffffff 100%)",
        borderTop: "1px solid rgba(148,163,184,0.15)",
      }}
    >
      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}/>

        {/* Soft radial centre highlight */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(255,255,255,0.9) 30%, transparent 100%)" }}
        />

        {/* Top / bottom edge lines */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.18), transparent)" }}/>
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.12), transparent)" }}/>

        {/* Left-side chapter timeline */}
        <ChapterTimeline chapters={BEATS} activeIndex={activeBeat} />

        {/* Beat panels */}
        <div className="relative z-10 w-full container-wide" style={{ height: "100vh" }}>
          {BEATS.map((beat, i) => (
            <BeatPanel key={beat.phase} beat={beat} index={i} total={n} scrollYProgress={scrollYProgress} />
          ))}
        </div>

        {/* Scroll progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] origin-left"
          style={{ scaleX: scrollYProgress, width: "100%", background: "linear-gradient(90deg, #3B82F6, #6366F1)" }}
        />
      </div>
    </section>
  );
}
