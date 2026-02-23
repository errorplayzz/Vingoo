import { useRef, useState, memo } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";

const EASE = [0.4, 0, 0.2, 1];

/*  Animated transaction counter  */
function CounterDisplay({ scrollYProgress, start, end }) {
  const [count, setCount] = useState(0);
  const raw = useTransform(scrollYProgress, [start, end], [0, 9613]);
  useMotionValueEvent(raw, "change", (v) => setCount(Math.round(v)));
  return (
    <span className="tabular-nums">
      {count.toLocaleString()}
    </span>
  );
}

/*  Animated SVG cycle diagram  */
function CycleDiagram({ scrollYProgress, start, end }) {
  const opacity = useTransform(scrollYProgress, [start, start + 0.06, end - 0.04, end], [0, 1, 1, 0]);

  // Pre-compute all 4 edge dash offsets at top level (no hooks in map)
  const edgeDash0 = useTransform(scrollYProgress, [start + 0.00, start + 0.10], [300, 0]);
  const edgeDash1 = useTransform(scrollYProgress, [start + 0.04, start + 0.14], [300, 0]);
  const edgeDash2 = useTransform(scrollYProgress, [start + 0.08, start + 0.18], [300, 0]);
  const edgeDash3 = useTransform(scrollYProgress, [start + 0.12, start + 0.22], [300, 0]);
  const edgeDashes = [edgeDash0, edgeDash1, edgeDash2, edgeDash3];

  const nodes = [
    { cx: 80,  cy: 60,  label: "ACC_A", delay: 0    },
    { cx: 200, cy: 60,  label: "ACC_B", delay: 0.08 },
    { cx: 240, cy: 140, label: "ACC_C", delay: 0.16 },
    { cx: 40,  cy: 140, label: "ACC_D", delay: 0.24 },
  ];

  return (
    <motion.div className="w-full max-w-sm mx-auto" style={{ opacity }}>
      {/* Score badge */}
      <motion.div
        className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-[12px] font-bold text-ink">Risk Score: 94 / 100</span>
      </motion.div>

      <svg viewBox="0 0 280 200" className="w-full h-40" xmlns="http://www.w3.org/2000/svg">
        {/* Cycle edges — offsets pre-computed above */}
        {[
          [80,60,200,60],[200,60,240,140],[240,140,40,140],[40,140,80,60],
        ].map(([x1,y1,x2,y2],i) => (
          <motion.line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#1D4ED8" strokeWidth="2" strokeOpacity="0.8"
            strokeDasharray="300"
            style={{ strokeDashoffset: edgeDashes[i] }} />
        ))}

        {/* Arrow heads */}
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#1D4ED8" fillOpacity="0.7" />
          </marker>
        </defs>

        {/* Nodes */}
        {nodes.map(({ cx, cy, label }) => (
          <g key={label}>
            <circle cx={cx} cy={cy} r={18} fill="white" stroke="#1D4ED8" strokeWidth="1.5" strokeOpacity="0.3"
              style={{ filter: "drop-shadow(0 2px 6px rgba(29,78,216,0.12))" }} />
            <circle cx={cx} cy={cy} r={7} fill="#1D4ED8" />
            <text x={cx} y={cy + 30} textAnchor="middle" fontSize="8.5" fill="#64748B" fontFamily="monospace">
              {label}
            </text>
          </g>
        ))}

        {/* Amount labels */}
        <text x="140" y="52" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,800</text>
        <text x="232" y="104" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,700</text>
        <text x="140" y="155" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,600</text>
        <text x="48" y="104" textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="monospace">$14,500</text>
      </svg>

      {/* Metadata chips */}
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {["4 accounts", "6 transfers", "168-hour window", "Closed loop"].map((t) => (
          <span key={t} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white border border-black/[0.08] text-muted"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            {t}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/*  Beat panel  */
const BeatPanel = memo(function BeatPanel({ beat, index, total, scrollYProgress }) {
  const start = index / total;
  const mid   = (index + 0.5) / total;
  const end   = (index + 1) / total;

  const opacity = useTransform(
    scrollYProgress,
    [start, start + 0.07, mid, end - 0.05, end],
    [0, 1, 1, 1, 0],
  );
  const y = useTransform(
    scrollYProgress,
    [start, start + 0.1, mid, end],
    [20, 0, 0, -20],
  );

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ opacity, y }}
    >
      {/* Phase badge */}
      <motion.div
        className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black/[0.08] bg-white/80 backdrop-blur-sm"
        style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
      >
        <span className="text-[10px] font-bold text-accent tracking-widest uppercase">
          {beat.phase}
        </span>
      </motion.div>

      {/* Headline */}
      <h2
        className="font-black text-ink mb-5 max-w-2xl"
        style={{
          fontSize: "clamp(2.2rem, 6vw, 5rem)",
          lineHeight: "1.0",
          letterSpacing: "-0.03em",
        }}
      >
        {beat.headline}
      </h2>

      {/* Sub */}
      <p className="text-muted text-lg md:text-xl max-w-xl leading-relaxed mb-4">
        {beat.sub}
      </p>

      {/* Counter for beat 0 */}
      {index === 0 && (
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className="font-black text-ink tabular-nums"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", letterSpacing: "-0.04em" }}
          >
            <CounterDisplay
              scrollYProgress={scrollYProgress}
              start={start + 0.05}
              end={mid - 0.05}
            />
          </span>
          <span className="text-muted text-xl font-semibold">transactions</span>
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
        <p className="text-faint text-sm max-w-sm leading-relaxed mt-3">
          {beat.detail}
        </p>
      )}

      {/* Step dots */}
      <div className="flex gap-2 mt-8">
        {Array.from({ length: total }).map((_, j) => (
          <div key={j} className="rounded-full transition-all duration-300"
            style={{
              width: j === index ? 20 : 5,
              height: 5,
              background: j === index ? "#0A0A0B" : "rgba(0,0,0,0.15)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
});

/*  Beat data  */
const BEATS = [
  {
    phase: "01 / Upload",
    headline: "A file arrives.",
    sub: "Raw transaction data. Flat rows. No visible structure.",
    detail: "The engine receives sender, receiver, amount, and timestamp.",
  },
  {
    phase: "02 / Map",
    headline: "The graph takes shape.",
    sub: "Every transfer becomes a directed edge. 847 unique nodes surface.",
    detail: "Cyclic structures emerge where none were visible in the table.",
  },
  {
    phase: "03 / Detect",
    headline: "Cycle detected.",
    sub: "A closed money loop. Funds routing through four accounts.",
    detail: null,
  },
  {
    phase: "04 / Score",
    headline: "Suspicion scored.",
    sub: "Composite risk: 94 of 100. Seven signals aligned in a pattern.",
    detail: "Centrality  velocity  flow imbalance  pattern participation.",
  },
  {
    phase: "05 / Export",
    headline: "Intelligence ready.",
    sub: "Case-ready JSON structured for law enforcement review.",
    detail: "Full audit trail  source data traceable  timestamp verified.",
  },
];

/*  StoryMode  */
export default function StoryMode() {
  const containerRef = useRef(null);
  const n = BEATS.length;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <section
      ref={containerRef}
      className="relative border-t border-black/[0.06]"
      style={{ height: `${(n + 0.6) * 100}vh`, background: "#F7F8FA" }}
    >
      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            backgroundImage: "radial-gradient(circle, #CBD5E1 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Radial vignette so edges fade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, #F7F8FA 100%)",
          }}
        />

        {/* Beat panels */}
        <div className="relative z-10 w-full container-wide" style={{ height: "100vh" }}>
          {BEATS.map((beat, i) => (
            <BeatPanel
              key={beat.phase}
              beat={beat}
              index={i}
              total={n}
              scrollYProgress={scrollYProgress}
            />
          ))}
        </div>

        {/* Scroll progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-accent/30 origin-left"
          style={{ scaleX: scrollYProgress, width: "100%" }}
        />
      </div>
    </section>
  );
}
