import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../api/client";
import NetworkBackground from "../components/NetworkBackground";
import {
  INVESTIGATION_STATE,
  useInvestigationState,
} from "../context/InvestigationContext";

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

/* --- Live preview card ---------------------------------------------------- */
const PREVIEW_ROWS = [
  { id: "MERCHANT_01", score: 94, risk: "high",   pattern: "Fan-in + Velocity"  },
  { id: "ACC_00123",   score: 81, risk: "high",   pattern: "3-Node Cycle"        },
  { id: "ACC_00345",   score: 67, risk: "medium", pattern: "Shell Chain"         },
  { id: "ACC_00891",   score: 44, risk: "medium", pattern: "Fan-out Cluster"     },
];
const RISK_MAP = {
  high:   { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", bar: "#EF4444", badge: "#FEE2E2", badgeText: "#B91C1C" },
  medium: { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706", bar: "#F59E0B", badge: "#FEF3C7", badgeText: "#92400E" },
};

function LivePreviewCard() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setActive(p => (p + 1) % PREVIEW_ROWS.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(99,102,241,0.15)",
        boxShadow: "0 32px 80px rgba(59,130,246,0.14), 0 8px 24px rgba(0,0,0,0.07), 0 0 0 1px rgba(255,255,255,0.8) inset",
      }}
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Top gradient bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)" }} />

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="2" cy="6" r="1.5" fill="white"/>
              <circle cx="6" cy="2" r="1.5" fill="white"/>
              <circle cx="10" cy="6" r="1.5" fill="white"/>
              <circle cx="6" cy="10" r="1.5" fill="white"/>
              <line x1="2" y1="6" x2="6" y2="2" stroke="white" strokeWidth="0.8" opacity="0.6"/>
              <line x1="6" y1="2" x2="10" y2="6" stroke="white" strokeWidth="0.8" opacity="0.6"/>
              <line x1="10" y1="6" x2="6" y2="10" stroke="white" strokeWidth="0.8" opacity="0.6"/>
              <line x1="2" y1="6" x2="6" y2="10" stroke="white" strokeWidth="0.8" opacity="0.6"/>
            </svg>
          </div>
          <div>
            <div className="text-[12px] font-bold text-slate-800 leading-none">Detection Preview</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Live intelligence feed</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
          <span className="text-[9px] font-bold text-emerald-600 tracking-wide">LIVE</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mx-4 mb-3 rounded-xl grid grid-cols-4 gap-0 overflow-hidden border border-slate-100">
        {[["501","Accounts"],["11","Flagged"],["3","Rings"],["0.37s","Speed"]].map(([v,l], i) => (
          <div key={l} className={`py-3 text-center ${i < 3 ? "border-r border-slate-100" : ""}`}
            style={{ background: i === 1 ? "rgba(239,68,68,0.04)" : "rgba(248,250,252,1)" }}>
            <div className="text-[14px] font-black tabular-nums text-slate-800">{v}</div>
            <div className="text-[8px] font-medium mt-0.5 text-slate-400 uppercase tracking-wide">{l}</div>
          </div>
        ))}
      </div>

      {/* Account rows */}
      <div className="px-4 space-y-1.5 pb-3">
        {PREVIEW_ROWS.map((row, i) => {
          const c = RISK_MAP[row.risk];
          return (
            <motion.div
              key={row.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300"
              style={{ background: active === i ? "rgba(59,130,246,0.05)" : "transparent",
                       borderLeft: active === i ? "2px solid rgba(59,130,246,0.3)" : "2px solid transparent" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-[12px]"
                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                {row.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold font-mono text-slate-700">{row.id}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c.badge, color: c.badgeText }}>{row.risk}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ background: c.bar }}
                      initial={{ width: 0 }}
                      animate={{ width: `${row.score}%` }}
                      transition={{ delay: 0.7 + i * 0.1, duration: 0.8, ease: [0.4,0,0.2,1] }}
                    />
                  </div>
                  <span className="text-[8px] text-slate-400 flex-shrink-0">{row.pattern}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mx-4 mb-4 rounded-xl px-4 py-2.5 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(99,102,241,0.06))", border: "1px solid rgba(99,102,241,0.1)" }}>
        <div className="flex items-center gap-2">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-blue-400"
            animate={{ opacity: [1,0.4,1] }} transition={{ repeat: Infinity, duration: 2 }} />
          <span className="text-[10px] font-semibold text-blue-600">AI explanations active</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-slate-400">0.37s</span>
          <span className="text-[8px] text-emerald-500 font-bold">↑ fast</span>
        </div>
      </div>
    </motion.div>
  );
}

/* --- Right panel ---------------------------------------------------------- */
function RightPanel({ healthOk }) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Live ping bar above card */}
      <motion.div
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl self-start"
        style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.15)" }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
      >
        <motion.span className="w-1.5 h-1.5 rounded-full bg-blue-500"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.6 }} />
        <span className="text-[10px] font-semibold text-blue-600">Live engine processing 9,613 transactions</span>
      </motion.div>

      {/* Main card */}
      <LivePreviewCard />

      {/* Bottom mini stats row */}
      <motion.div
        className="grid grid-cols-3 gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0, ease: EASE }}
      >
        {[
          { icon: "🔗", label: "Graph edges", val: "24,891" },
          { icon: "🛡",  label: "Fraud rings",  val: "3 found" },
          { icon: "⚡",  label: "Latency",      val: "< 11s"  },
        ].map(({ icon, label, val }) => (
          <div key={label} className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(148,163,184,0.2)", backdropFilter: "blur(8px)" }}>
            <div className="text-base mb-0.5">{icon}</div>
            <div className="text-[12px] font-bold text-slate-700">{val}</div>
            <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* --- Stat item ------------------------------------------------------------ */
function StatItem({ raw, display, label, delay }) {
  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <span className="text-2xl font-black tracking-tight tabular-nums text-slate-800">
        {raw != null ? <Counter to={raw} suffix="+" /> : display}
      </span>
      <span className="text-[11px] font-medium mt-0.5 text-slate-400">{label}</span>
    </motion.div>
  );
}
function StatDivider() {
  return <div className="hidden sm:block w-px h-7 self-center bg-slate-200" />;
}

/* --- Hero ----------------------------------------------------------------- */
export default function Hero() {
  const [healthOk, setHealthOk] = useState(null);
  const { investigationState } = useInvestigationState();

  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => setHealthOk(r.ok)).catch(() => setHealthOk(false));
  }, []);

  const systemLabel =
    investigationState === INVESTIGATION_STATE.DATA_UPLOADED   ? "DATA RECEIVED"      :
    investigationState === INVESTIGATION_STATE.ANALYZING        ? "ANALYSIS RUNNING"   :
    investigationState === INVESTIGATION_STATE.INTELLIGENCE_READY ? "INTELLIGENCE READY" :
    "SYSTEM READY";

  return (
    <section
      id="hero"
      className="relative overflow-x-hidden pt-8 pb-20"
      style={{ background: "linear-gradient(160deg, #EEF2FF 0%, #F0F7FF 30%, #ffffff 65%)" }}
    >
      {/* Cyber network animation */}
      <NetworkBackground />

      {/* Soft vignette so edges fade to white */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 70% at 50% 0%, transparent 40%, rgba(255,255,255,0.6) 100%)" }} />

      <div className="container-wide relative py-8 md:py-12">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 xl:gap-16 w-full">

          {/* ── LEFT: copy ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 max-w-[540px]">

            {/* Badges */}
            <motion.div className="flex flex-wrap items-center gap-2 mb-7"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-blue-200 text-[11px] font-semibold text-blue-600 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Financial Crime Intelligence
              </span>
              {healthOk !== null && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold border shadow-sm ${
                  healthOk ? "bg-white border-emerald-200 text-emerald-600" : "bg-white border-red-200 text-red-600"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${healthOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                  {healthOk ? "API Online" : "API Offline"}
                </span>
              )}
            </motion.div>

            {/* Headline */}
            <motion.h1 className="hero-title mb-5"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}>
              Upload transactions.<br />
              <span style={{ background: "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Reveal hidden
              </span><br />
              networks.
            </motion.h1>

            {/* Sub copy */}
            <motion.p className="text-[1.05rem] leading-relaxed text-slate-500 max-w-[440px] mb-8"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}>
              Drop a CSV. Get a fraud network map, risk scores, and
              court-grade evidence — in under <strong className="text-slate-700 font-semibold">11 seconds</strong>.
            </motion.p>

            {/* CTAs */}
            <motion.div className="flex flex-wrap gap-3 mb-8"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE }}>
              <motion.a href="#upload"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600"
                style={{ boxShadow: "0 4px 20px rgba(59,130,246,0.4)" }}
                whileHover={{ scale: 1.03, y: -2, boxShadow: "0 8px 32px rgba(59,130,246,0.5)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}>
                Upload Transactions
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.a>
              <motion.a href="#capabilities"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors duration-200"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}>
                View Capabilities
              </motion.a>
            </motion.div>

            {/* Trust bullets */}
            <motion.ul className="flex flex-col gap-2 mb-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.38 }}>
              {[
                ["Graph Intelligence",       "Multi-hop network traversal"],
                ["Role Classification",      "Mule, hub, shell detection"],
                ["Evidence Integrity Seal",  "Court-admissible audit trail"],
              ].map(([title, sub]) => (
                <li key={title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l1.8 1.8L6.5 2" stroke="#10B981" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <div>
                    <span className="text-[12px] font-semibold text-slate-700">{title}</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">{sub}</span>
                  </div>
                </li>
              ))}
            </motion.ul>

            {/* System status */}
            <motion.div className="flex items-center gap-2 mb-8"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}>
              <motion.span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                style={{ background: investigationState === INVESTIGATION_STATE.ANALYZING ? "#F59E0B"
                  : investigationState === INVESTIGATION_STATE.INTELLIGENCE_READY ? "#10B981" : "#3B82F6" }} />
              <span className="text-[10px] font-mono font-semibold tracking-[0.15em] uppercase text-slate-400">{systemLabel}</span>
            </motion.div>

            {/* Stats */}
            <motion.div className="flex flex-wrap items-center gap-5 sm:gap-7 pt-6 border-t border-slate-200/70"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.55 }}>
              <StatItem raw={9613}  display={null}   label="Transactions / batch" delay={0.58} />
              <StatDivider />
              <StatItem raw={null}  display="4"      label="Pattern engines"      delay={0.66} />
              <StatDivider />
              <StatItem raw={null}  display="< 11s"  label="Full analysis"        delay={0.74} />
              <StatDivider />
              <StatItem raw={null}  display="97.2%"  label="Detection accuracy"   delay={0.82} />
            </motion.div>
          </div>

          {/* ── RIGHT: preview panel ────────────────────────────────── */}
          <div className="hidden lg:flex flex-col flex-shrink-0 w-[400px] xl:w-[440px] mt-2">
            <RightPanel healthOk={healthOk} />
          </div>
        </div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.2), transparent)" }} />
    </section>
  );
}
