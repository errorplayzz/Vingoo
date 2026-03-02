import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

const NAV_COLS = [
  {
    heading: "Product",
    links: [
      { label: "How It Works",        href: "#how-it-works" },
      { label: "Upload & Analyse",    href: "#upload" },
      { label: "Graph Intelligence",  href: "#graph" },
      { label: "System Capabilities", href: "#capabilities" },
    ],
  },
  {
    heading: "Detection",
    links: [
      { label: "Cycle Detection",      href: "#graph" },
      { label: "Smurfing Analysis",    href: "#graph" },
      { label: "Shell Chain Tracing",  href: "#graph" },
      { label: "Velocity Monitoring",  href: "#graph" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "API Reference",        href: "#" },
      { label: "CSV Format Guide",     href: "#upload" },
      { label: "Pattern Explainer",    href: "#how-it-works" },
      { label: "Research v1.0",        href: "#" },
    ],
  },
];

const STACK = ["FastAPI", "React 19", "NetworkX", "D3.js", "Neon DB", "Framer Motion"];

function TeamTag({ name, color, href = "#" }) {
  return (
    <motion.a
      href={href}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold tracking-wide no-underline transition-all"
      style={{
        background: `${color}0d`,
        borderColor: `${color}30`,
        color: color,
      }}
      whileHover={{
        scale: 1.04,
        background: `${color}18`,
        borderColor: `${color}55`,
        boxShadow: `0 4px 16px ${color}25`,
        y: -1,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }}/>
      {name}
    </motion.a>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t"
      style={{
        background: "linear-gradient(180deg, #F8FAFF 0%, #ffffff 100%)",
        borderColor: "rgba(148,163,184,0.18)",
      }}>

      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          "linear-gradient(rgba(99,102,241,0.035) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(99,102,241,0.035) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}/>

      {/* Glow orb top-left */}
      <div className="absolute top-0 left-0 w-[360px] h-[240px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)" }}/>

      {/* ── Main grid ──────────────────────────────────────────────── */}
      <div className="container-wide relative pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_repeat(3,1fr)] gap-10 mb-12">

          {/* Brand column */}
          <div>
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600 shadow-sm"
                style={{ boxShadow: "0 2px 12px rgba(29,78,216,0.35)" }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <circle cx="3"  cy="7"  r="1.6" fill="white" />
                  <circle cx="7"  cy="3"  r="1.6" fill="white" />
                  <circle cx="11" cy="7"  r="1.6" fill="white" />
                  <circle cx="7"  cy="11" r="1.6" fill="white" />
                  <line x1="3" y1="7" x2="7"  y2="3"  stroke="white" strokeWidth="1" strokeOpacity="0.6"/>
                  <line x1="7" y1="3" x2="11" y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.6"/>
                  <line x1="11" y1="7" x2="7" y2="11" stroke="white" strokeWidth="1" strokeOpacity="0.6"/>
                  <line x1="7" y1="11" x2="3" y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.6"/>
                </svg>
              </div>
              <span className="text-[15px] font-black tracking-tight" style={{ color: "#0F172A" }}>Vingoo</span>
            </div>

            <p className="text-[13px] leading-relaxed mb-5 max-w-[220px]" style={{ color: "#64748B" }}>
              Financial crime intelligence platform — network-based fraud detection for investigators.
            </p>

            {/* Status chip */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-5"
              style={{ background: "rgba(16,185,129,0.07)", borderColor: "rgba(16,185,129,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-emerald-600">
                v1.0.0 · Research Build
              </span>
            </div>

            {/* Stack badges */}
            <div className="flex flex-wrap gap-1.5">
              {STACK.map((s) => (
                <span key={s}
                  className="text-[9.5px] font-semibold px-2 py-0.5 rounded-md border"
                  style={{
                    background: "rgba(241,245,249,0.9)",
                    borderColor: "rgba(148,163,184,0.2)",
                    color: "#64748B",
                  }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {NAV_COLS.map((col) => (
            <div key={col.heading}>
              <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-4"
                style={{ color: "#94A3B8" }}>
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}
                      className="text-[13px] font-medium transition-colors duration-150 hover:text-blue-600"
                      style={{ color: "#475569", textDecoration: "none" }}
                      onClick={(e) => {
                        const el = document.querySelector(l.href);
                        if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); }
                      }}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full mb-6"
          style={{ background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.25), transparent)" }}/>

        {/* ── Bottom bar ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Copyright */}
          <p className="text-[11.5px]" style={{ color: "#94A3B8" }}>
            &copy; {year} Vingoo &nbsp;&middot;&nbsp; Financial Crime Intelligence &nbsp;&middot;&nbsp; All rights reserved
          </p>

          {/* Team credits */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[11px]" style={{ color: "#94A3B8" }}>Built by</span>
            <TeamTag name="Coderist" color="#3B82F6" />
            <span className="text-[10px]" style={{ color: "#CBD5E1" }}>&amp;</span>
            <TeamTag name="Errorist" color="#8B5CF6" />
          </div>
        </div>
      </div>
    </footer>
  );
}
