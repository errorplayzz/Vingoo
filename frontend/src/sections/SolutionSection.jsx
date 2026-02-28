/**
 * SolutionSection.jsx
 * "How VINGOO Works" — 3 step cards: Upload → Graph Intelligence → Role & Evidence.
 */
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const STEPS = [
  {
    step: "01",
    title: "Upload Transaction Data",
    body: "Drop a CSV file with transaction records. VINGOO ingests sender, receiver, amount, and timestamp columns and constructs a directed graph in seconds.",
    badge: "CSV Upload",
    color: "#3B82F6",
    lightBg: "#EFF6FF",
    lightBorder: "#BFDBFE",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 22 22">
        <path d="M11 15V5M7 9l4-4 4 4" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 17v1.5A1.5 1.5 0 004.5 20h13a1.5 1.5 0 001.5-1.5V17" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    step: "02",
    title: "Graph Intelligence Engine",
    body: "Four pattern detectors run in parallel: cycle detection, smurfing analysis, shell chain mapping, and high-velocity scoring. NetworkX graph algorithms surface what spreadsheets cannot see.",
    badge: "4 Detectors",
    color: "#8B5CF6",
    lightBg: "#F5F3FF",
    lightBorder: "#DDD6FE",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 22 22">
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
    body: "Every flagged account receives a financial role: CONTROLLER, MULE, or POSSIBLE_VICTIM. The full analysis is sealed with a SHA-256 integrity hash — verifiable at any time.",
    badge: "Tamper-Evident",
    color: "#10B981",
    lightBg: "#ECFDF5",
    lightBorder: "#A7F3D0",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 22 22">
        <path d="M11 2l2 4.5h4.5L14 9.5l1.5 4.5L11 11.5 7.5 14l1.5-4.5L5.5 6.5H10L11 2z" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 17l2 2 4-4" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const EASE = [0.22, 1, 0.36, 1];

export default function SolutionSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="solution" className="py-24 bg-white border-t border-slate-100">
      <div className="container-wide" ref={ref}>
        {/* Header */}
        <motion.div
          className="mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="section-label mb-3">How It Works</p>
          <h2 className="section-title max-w-xl">
            Three steps from raw data<br />to actionable intelligence.
          </h2>
        </motion.div>

        {/* Step cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.step}
              className="relative flex flex-col p-7 bg-white rounded-2xl border border-slate-200"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.1, ease: EASE }}
            >
              {/* Step number */}
              <span
                className="text-[11px] font-mono font-bold tracking-[0.14em] mb-5"
                style={{ color: s.color }}
              >
                STEP {s.step}
              </span>

              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: s.lightBg, border: `1px solid ${s.lightBorder}` }}
              >
                {s.icon}
              </div>

              <h3 className="text-[15px] font-bold text-ink mb-3 leading-snug">{s.title}</h3>
              <p className="text-[13px] text-muted leading-relaxed flex-1">{s.body}</p>

              {/* Badge */}
              <span
                className="mt-5 self-start text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full border"
                style={{ background: s.lightBg, borderColor: s.lightBorder, color: s.color }}
              >
                {s.badge}
              </span>

              {/* Connector arrow (not on last card) */}
              {i < STEPS.length - 1 && (
                <div
                  className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center z-10 bg-white rounded-full border border-slate-200"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
