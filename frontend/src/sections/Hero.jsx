import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../api/client";
import { useAnalysisState } from "../context/AnalysisContext";

const EASE = [0.22, 1, 0.36, 1];

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

/* --- Live preview card (light theme) ------------------------------------- */
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
      className="w-full max-w-[340px] rounded-2xl bg-white border border-slate-200 overflow-hidden"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
        <span className="text-[11px] font-semibold text-ink">Detection Preview</span>
        <div className="flex items-center gap-1.5">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
          <span className="text-[10px] font-semibold text-emerald-600">LIVE</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="px-4 py-3 grid grid-cols-4 gap-1 border-b border-slate-100 bg-slate-50">
        {[["501","Accts"],["11","Flagged"],["3","Rings"],["0.37s","Speed"]].map(([v,l]) => (
          <div key={l} className="text-center">
            <div className="text-[13px] font-black tabular-nums text-ink">{v}</div>
            <div className="text-[9px] font-medium mt-0.5 text-muted">{l}</div>
          </div>
        ))}
      </div>

      {/* Account rows */}
      <div className="px-4 py-3 space-y-2">
        {PREVIEW_ROWS.map((row, i) => (
          <motion.div
            key={row.id}
            className="flex items-center gap-3 p-2.5 rounded-xl transition-colors duration-300"
            style={{ background: active === i ? "#F8FAFC" : "transparent" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-[11px] border"
              style={{
                background: row.risk === "high" ? "#FEF2F2" : "#FFFBEB",
                borderColor: row.risk === "high" ? "#FECACA" : "#FDE68A",
                color: row.risk === "high" ? "#DC2626" : "#D97706",
              }}>
              {row.score}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-semibold font-mono text-ink truncate">{row.id}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide flex-shrink-0"
                  style={{ color: row.risk === "high" ? "#DC2626" : "#D97706" }}>{row.risk}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden bg-slate-100">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: row.risk === "high" ? "#EF4444" : "#F59E0B" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${row.score}%` }}
                  transition={{ delay: 0.8 + i * 0.12, duration: 0.7, ease: [0.4,0,0.2,1] }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="mx-4 mb-4 rounded-xl px-4 py-2.5 flex items-center justify-between bg-blue-50 border border-blue-100">
        <div className="flex items-center gap-2">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-blue-400"
            animate={{ opacity: [1,0.4,1] }} transition={{ repeat: Infinity, duration: 2 }} />
          <span className="text-[10px] font-semibold text-blue-600">AI explanations active</span>
        </div>
        <span className="text-[10px] font-mono text-muted">0.37s</span>
      </div>
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
      <span className="text-2xl md:text-[1.75rem] font-black tracking-tight tabular-nums text-ink">
        {raw != null ? <Counter to={raw} suffix="+" /> : display}
      </span>
      <span className="text-[11px] font-medium mt-1 text-muted">{label}</span>
    </motion.div>
  );
}

/* --- Divider -------------------------------------------------------------- */
function StatDivider() {
  return <div className="hidden sm:block w-px h-7 self-center bg-slate-200" />;
}

/* --- Hero ----------------------------------------------------------------- */
export default function Hero() {
  const [healthOk, setHealthOk] = useState(null);
  const { status: analysisStatus } = useAnalysisState();

  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => setHealthOk(r.ok)).catch(() => setHealthOk(false));
  }, []);

  const EASE = [0.22, 1, 0.36, 1];

  return (
    <section
      id="hero"
      className="relative bg-white pt-24 pb-0 overflow-hidden"
    >
      {/* Subtle top-right accent shape */}
      <div
        className="absolute top-0 right-0 w-[560px] h-[400px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.07) 0%, transparent 65%)",
        }}
      />

      <div className="container-wide py-20 md:py-24">
        <div className="flex flex-col lg:flex-row lg:items-center gap-16 xl:gap-20 w-full">

          {/* Left: copy */}
          <div className="flex-1 max-w-[560px]">

            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 mb-7"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Financial Crime Intelligence
              </span>
              {healthOk !== null && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                    healthOk
                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${healthOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                  {healthOk ? "API Online" : "API Offline"}
                </span>
              )}
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="hero-title mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            >
              Upload transactions.<br />
              <span className="text-blue-600">Reveal hidden</span><br />
              networks.
            </motion.h1>

            {/* Body */}
            <motion.p
              className="text-[1.05rem] leading-relaxed text-muted max-w-md mb-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            >
              Graph-based engine detects cycles, smurfing, shell chains, and high-velocity patterns. Upload a CSV — intelligence surfaces in under 11 seconds.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-3 mb-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
            >
              <motion.a
                href="#upload"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600"
                style={{ boxShadow: "0 2px 16px rgba(59,130,246,0.35)" }}
                whileHover={{ scale: 1.03, y: -1, boxShadow: "0 6px 28px rgba(59,130,246,0.45)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              >
                Upload Transactions
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.a>

              <motion.a
                href="#capabilities"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-muted bg-white border border-slate-200 hover:border-slate-300 hover:text-ink transition-colors duration-200"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              >
                View Capabilities
              </motion.a>
            </motion.div>

            {/* System status */}
            <motion.div
              className="flex items-center gap-2 mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: analysisStatus === 'uploading' || analysisStatus === 'analyzing'
                    ? '#F59E0B'
                    : analysisStatus === 'error'
                    ? '#EF4444'
                    : '#10B981',
                }}
              />
              <span className="text-[10px] font-mono font-medium tracking-[0.14em] uppercase text-muted select-none">
                {analysisStatus === 'uploading' || analysisStatus === 'analyzing'
                  ? 'Processing — engine active'
                  : analysisStatus === 'done'
                  ? 'Analysis complete'
                  : analysisStatus === 'error'
                  ? 'System alert'
                  : 'System ready · awaiting data'}
              </span>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="flex flex-wrap items-center gap-6 sm:gap-8 pt-8 border-t border-slate-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.55 }}
            >
              <StatItem raw={9613}  display={null}   label="Transactions / batch" delay={0.58} />
              <StatDivider />
              <StatItem raw={null}  display="4"      label="Pattern engines"      delay={0.66} />
              <StatDivider />
              <StatItem raw={null}  display="< 11s"  label="Full analysis"        delay={0.74} />
              <StatDivider />
              <StatItem raw={null}  display="97.2%"  label="Detection accuracy"   delay={0.82} />
            </motion.div>
          </div>

          {/* Right: preview card */}
          <div className="flex-shrink-0 hidden lg:flex justify-center xl:justify-end">
            <LivePreviewCard />
          </div>
        </div>
      </div>

      {/* Bottom border */}
      <div className="border-t border-slate-100" />
    </section>
  );
}

