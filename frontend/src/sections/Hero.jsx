import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { API_BASE } from "../api/client";

/* --- Graph data ----------------------------------------------------------- */
const NODES_HERO = [
  { id: 0,  x: 0.08, y: 0.18, ring: false },
  { id: 1,  x: 0.22, y: 0.09, ring: true  },
  { id: 2,  x: 0.38, y: 0.14, ring: true  },
  { id: 3,  x: 0.55, y: 0.10, ring: false },
  { id: 4,  x: 0.70, y: 0.20, ring: false },
  { id: 5,  x: 0.85, y: 0.14, ring: false },
  { id: 6,  x: 0.92, y: 0.33, ring: false },
  { id: 7,  x: 0.78, y: 0.48, ring: false },
  { id: 8,  x: 0.88, y: 0.64, ring: false },
  { id: 9,  x: 0.72, y: 0.76, ring: false },
  { id: 10, x: 0.56, y: 0.86, ring: false },
  { id: 11, x: 0.40, y: 0.88, ring: false },
  { id: 12, x: 0.24, y: 0.78, ring: false },
  { id: 13, x: 0.10, y: 0.68, ring: false },
  { id: 14, x: 0.05, y: 0.50, ring: false },
  { id: 15, x: 0.18, y: 0.38, ring: true  },
  { id: 16, x: 0.34, y: 0.52, ring: true  },
  { id: 17, x: 0.50, y: 0.44, ring: true  },
  { id: 18, x: 0.64, y: 0.57, ring: false },
  { id: 19, x: 0.46, y: 0.67, ring: false },
];
const EDGES_HERO = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],
  [9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],
  [16,17],[17,18],[18,19],[19,11],[15,2],[17,3],[16,13],
  [18,9],[4,7],[1,15],[2,16],
];
const RING_SET = new Set([1, 2, 15, 16, 17]);

/* --- Animated counter ----------------------------------------------------- */
function Counter({ to, suffix = "", duration = 2.2 }) {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, to, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* --- Network background --------------------------------------------------- */
function NetworkBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {EDGES_HERO.map(([a, b], i) => {
          const na = NODES_HERO[a], nb = NODES_HERO[b];
          const active = RING_SET.has(a) && RING_SET.has(b);
          return (
            <line
              key={i}
              x1={`${na.x * 100}%`} y1={`${na.y * 100}%`}
              x2={`${nb.x * 100}%`} y2={`${nb.y * 100}%`}
              stroke={active ? "#3B82F6" : "rgba(255,255,255,0.055)"}
              strokeWidth={active ? 1.4 : 0.7}
              className={active ? "hero-edge-ring" : "hero-edge"}
              style={{ animationDelay: `${i * 0.07}s` }}
            />
          );
        })}
        {NODES_HERO.map((n, i) => (
          <g key={n.id}>
            {n.ring && (
              <circle
                cx={`${n.x * 100}%`} cy={`${n.y * 100}%`}
                r="14" fill="none"
                stroke="#3B82F6" strokeWidth="0.6"
                className="hero-ring-pulse"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            )}
            <circle
              cx={`${n.x * 100}%`} cy={`${n.y * 100}%`}
              r={n.ring ? 4.5 : 2.5}
              fill={n.ring ? "#60A5FA" : "rgba(255,255,255,0.15)"}
              className="hero-node"
              style={{
                animationDelay: `${i * 0.1}s`,
                filter: n.ring ? "drop-shadow(0 0 7px rgba(59,130,246,0.9))" : "none",
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* --- Floating signal chips ------------------------------------------------ */
const CHIPS = [
  { label: "Cycle Detected",      dot: "#ef4444", x: "68%", y: "19%", delay: 1.0 },
  { label: "Smurfing Pattern",    dot: "#f59e0b", x: "4%",  y: "36%", delay: 1.4 },
  { label: "Shell Chain  4 hops",dot: "#8b5cf6", x: "55%", y: "79%", delay: 1.8 },
  { label: "High Velocity",       dot: "#f97316", x: "87%", y: "52%", delay: 2.1 },
];

function FloatingChip({ label, dot, x, y, delay }) {
  return (
    <motion.div
      className="absolute hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-full pointer-events-none"
      style={{
        left: x, top: y,
        background: "rgba(10,18,38,0.78)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      initial={{ opacity: 0, scale: 0.75, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
      transition={{
        opacity: { delay, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
        scale:   { delay, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
        y:       { delay: delay + 0.5, duration: 3.8, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
      <span className="text-[11px] font-semibold text-white/85 whitespace-nowrap">{label}</span>
    </motion.div>
  );
}

/* --- Live preview card ---------------------------------------------------- */
const PREVIEW_ROWS = [
  { id: "MERCHANT_01", score: 94, tag: "fan-in + velocity", risk: "high"   },
  { id: "ACC_00123",   score: 81, tag: "3-node cycle",       risk: "high"   },
  { id: "ACC_00345",   score: 67, tag: "shell chain",        risk: "medium" },
  { id: "ACC_00891",   score: 44, tag: "fan-out cluster",    risk: "medium" },
];

function LivePreviewCard() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % PREVIEW_ROWS.length), 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      className="relative w-full max-w-[340px] rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10,18,38,0.85)",
        backdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 40px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
      initial={{ opacity: 0, x: 44, y: 24 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.9, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Window chrome */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            {["#ff5f57","#ffbd2e","#28c840"].map((c,i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.65 }} />
            ))}
          </div>
          <span className="text-[10px] font-mono ml-1" style={{ color: "rgba(255,255,255,0.28)" }}>detection_engine — live</span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
          <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="px-5 py-3.5 grid grid-cols-4 gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {[["501","Accounts"],["11","Flagged"],["3","Rings"],["0.37s","Speed"]].map(([v,l]) => (
          <div key={l} className="text-center">
            <div className="text-[14px] font-black tabular-nums" style={{ color: "rgba(255,255,255,0.90)" }}>{v}</div>
            <div className="text-[9px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Account rows */}
      <div className="px-4 py-3 space-y-2">
        {PREVIEW_ROWS.map((row, i) => (
          <motion.div
            key={row.id}
            className="flex items-center gap-3 p-2.5 rounded-xl"
            style={{ background: active === i ? "rgba(255,255,255,0.055)" : "transparent" }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-[11px]"
              style={{
                background: row.risk === "high" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                color: row.risk === "high" ? "#f87171" : "#fbbf24",
              }}>
              {row.score}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-semibold font-mono truncate" style={{ color: "rgba(255,255,255,0.75)" }}>{row.id}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide flex-shrink-0"
                  style={{ color: row.risk === "high" ? "#f87171" : "#fbbf24" }}>{row.risk}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: row.risk === "high" ? "linear-gradient(90deg,#ef4444,#f87171)" : "linear-gradient(90deg,#f59e0b,#fbbf24)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${row.score}%` }}
                  transition={{ delay: 1.4 + i * 0.15, duration: 0.9, ease: [0.4,0,0.2,1] }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI status footer */}
      <div className="mx-4 mb-4 rounded-xl px-4 py-2.5 flex items-center justify-between"
        style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.22)" }}>
        <div className="flex items-center gap-2">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-blue-400"
            animate={{ opacity: [1,0.4,1] }} transition={{ repeat: Infinity, duration: 2 }} />
          <span className="text-[10px] font-semibold text-blue-400">AI explanations active</span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>0.3737s</span>
      </div>

      {/* Card glow */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-56 h-28 pointer-events-none rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(59,130,246,0.16) 0%, transparent 70%)" }} />
    </motion.div>
  );
}

/* --- Stat item ------------------------------------------------------------ */
function StatItem({ raw, display, label, delay }) {
  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="text-2xl md:text-[1.75rem] font-black tracking-tight tabular-nums" style={{ color: "rgba(255,255,255,0.95)" }}>
        {raw != null ? <Counter to={raw} suffix="+" /> : display}
      </span>
      <span className="text-[11px] font-medium mt-1" style={{ color: "rgba(255,255,255,0.32)" }}>{label}</span>
    </motion.div>
  );
}

/* --- Divider -------------------------------------------------------------- */
function StatDivider() {
  return <div className="hidden sm:block w-px h-8 self-center" style={{ background: "rgba(255,255,255,0.08)" }} />;
}

/* --- Hero ----------------------------------------------------------------- */
export default function Hero() {
  const heroRef = useRef(null);
  const [healthOk, setHealthOk] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => setHealthOk(r.ok)).catch(() => setHealthOk(false));
  }, []);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const smoothX = useSpring(mouseX, { stiffness: 55, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 55, damping: 20 });

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const textY   = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  const orb1X = useTransform(smoothX, [0, 1], [-28, 28]);
  const orb1Y = useTransform(smoothY, [0, 1], [-18, 18]);
  const orb2X = useTransform(smoothX, [0, 1], [18, -18]);
  const orb2Y = useTransform(smoothY, [0, 1], [12, -12]);

  const handleMouseMove = (e) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseX.set((e.clientX - r.left) / r.width);
    mouseY.set((e.clientY - r.top) / r.height);
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative min-h-[100svh] flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(145deg, #060B18 0%, #0B1628 40%, #0E1A35 68%, #06101F 100%)" }}
      onMouseMove={handleMouseMove}
    >
      {/* Glow orbs */}
      <motion.div className="absolute pointer-events-none rounded-full"
        style={{ width: 650, height: 650, top: "-18%", left: "-8%", x: orb1X, y: orb1Y,
          background: "radial-gradient(circle, rgba(29,78,216,0.20) 0%, transparent 65%)" }} />
      <motion.div className="absolute pointer-events-none rounded-full"
        style={{ width: 550, height: 550, bottom: "-12%", right: "-4%", x: orb2X, y: orb2Y,
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)" }} />
      <div className="absolute pointer-events-none rounded-full"
        style={{ width: 380, height: 380, top: "32%", left: "42%",
          background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)" }} />

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* Network */}
      <NetworkBg />

      {/* Top / bottom fade */}
      <div className="absolute top-0 inset-x-0 h-28 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(6,11,24,0.55), transparent)" }} />
      <div className="absolute bottom-0 inset-x-0 h-40 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #060B18)" }} />

      {/* Chips */}
      {CHIPS.map((c) => <FloatingChip key={c.label} {...c} />)}

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col justify-center flex-1 container-wide py-28 md:py-0"
        style={{ y: textY, opacity }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-14 xl:gap-20 w-full">

          {/* Left: copy */}
          <div className="flex-1 max-w-[580px]">
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 mb-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full"
                style={{ background: "rgba(29,78,216,0.14)", border: "1px solid rgba(59,130,246,0.28)", backdropFilter: "blur(12px)" }}>
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-blue-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2 }}
                />
                <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "rgba(147,197,253,0.90)" }}>
                  Financial Crime Intelligence
                </span>
              </div>
            </motion.div>

            {/* Health indicator */}
            {healthOk !== null && (
              <motion.div
                className="inline-flex items-center gap-2 mt-3 mb-2 px-3 py-1.5 rounded-full"
                style={{
                  background: healthOk ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
                  border: `1px solid ${healthOk ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.22)"}`,
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${healthOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
                />
                <span className="text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: healthOk ? "rgba(52,211,153,0.85)" : "rgba(248,113,113,0.85)" }}>
                  {healthOk ? "API Operational" : "API Unreachable"}
                </span>
              </motion.div>
            )}

            {/* Headline */}
            <motion.h1
              className="hero-title-dark mb-7"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              Upload transactions.
              <br />Reveal hidden
              <br /><span className="hero-gradient-text">crime networks.</span>
            </motion.h1>

            {/* Body */}
            <motion.p
              className="text-[1.05rem] md:text-[1.1rem] leading-relaxed max-w-lg mb-10"
              style={{ color: "rgba(255,255,255,0.46)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              Graph-based detection engine. Upload a CSV — cycles, smurfing, and shell chains surface in real time.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-3 mb-14"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.40, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.a
                href="#upload"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold text-white relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)",
                  boxShadow: "0 4px 24px rgba(29,78,216,0.48), inset 0 1px 0 rgba(255,255,255,0.16)",
                }}
                whileHover={{ scale: 1.04, y: -2, boxShadow: "0 10px 40px rgba(29,78,216,0.62), inset 0 1px 0 rgba(255,255,255,0.20)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              >
                <span className="relative z-10">Try Detection</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="relative z-10">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="absolute inset-0 hero-btn-shimmer pointer-events-none" />
              </motion.a>

              <motion.a
                href="#capabilities"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.11)",
                  backdropFilter: "blur(12px)",
                  color: "rgba(255,255,255,0.65)",
                }}
                whileHover={{
                  scale: 1.04, y: -2,
                  background: "rgba(255,255,255,0.095)",
                  borderColor: "rgba(255,255,255,0.20)",
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              >
                View Capabilities
              </motion.a>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="flex flex-wrap items-center gap-6 sm:gap-8"
              style={{ borderTop: "1px solid rgba(255,255,255,0.065)", paddingTop: "2rem" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.7 }}
            >
              <StatItem raw={9613}  display={null}   label="Transactions / batch" delay={0.72} />
              <StatDivider />
              <StatItem raw={null}  display="4"      label="Pattern engines"      delay={0.82} />
              <StatDivider />
              <StatItem raw={null}  display="< 11s"  label="Full analysis"        delay={0.92} />
              <StatDivider />
              <StatItem raw={null}  display="97.2%"  label="Detection accuracy"   delay={1.02} />
            </motion.div>
          </div>

          {/* Right: preview card */}
          <div className="flex-shrink-0 hidden lg:flex justify-end">
            <LivePreviewCard />
          </div>
        </div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        className="absolute bottom-9 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        style={{ opacity }}
      >
        <span className="text-[9px] tracking-[0.22em] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.20)" }}>Scroll</span>
        <div className="w-px h-8 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.10)" }}>
          <motion.div
            className="absolute top-0 left-0 w-full h-3 rounded-full"
            style={{ background: "linear-gradient(to bottom, #60A5FA, transparent)" }}
            animate={{ y: ["-100%", "400%"] }}
            transition={{ repeat: Infinity, duration: 1.9, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}