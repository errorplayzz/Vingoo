/**
 * ProblemSection.jsx
 * "Why Traditional Fraud Detection Fails" — 4 pain-point cards in 2-column grid.
 */
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const PROBLEMS = [
  {
    title: "Rule engines miss adaptive patterns",
    body: "Threshold-based rules flag obvious cases and miss novel laundering techniques. Criminals adapt faster than manual rule updates.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="#EF4444" strokeWidth="1.5"/>
        <path d="M10 7v4M10 13.5v.5" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "Transactions analyzed in isolation",
    body: "Traditional tools examine individual transactions. Money laundering hides in the relationships between accounts — invisible without a graph.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <circle cx="5" cy="10" r="2.5" stroke="#F59E0B" strokeWidth="1.5"/>
        <circle cx="15" cy="10" r="2.5" stroke="#F59E0B" strokeWidth="1.5"/>
        <path d="M7.5 10h5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
      </svg>
    ),
  },
  {
    title: "No account role context",
    body: "A flagged account number is not enough. Investigators need to know if an account is a controller, mule, or victim to act effectively.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <rect x="3" y="5" width="14" height="10" rx="2" stroke="#8B5CF6" strokeWidth="1.5"/>
        <path d="M7 10h6M7 13h3" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "Evidence is fragile and disputable",
    body: "Analysis outputs lack tamper-evident provenance. Without a verifiable integrity seal, findings struggle in regulatory and legal contexts.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
        <path d="M10 2l2 6h6l-5 3.5 2 6L10 14l-5 3.5 2-6L2 8h6l2-6z" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const EASE = [0.22, 1, 0.36, 1];

export default function ProblemSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="problem" className="py-24 bg-slate-50 border-t border-slate-200">
      <div className="container-wide" ref={ref}>
        {/* Header */}
        <motion.div
          className="mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="section-label mb-3">The Problem</p>
          <h2 className="section-title max-w-xl">
            Why Traditional Fraud Detection Fails
          </h2>
          <p className="mt-4 text-muted text-[1rem] leading-relaxed max-w-lg">
            Current systems were built for a different era. Financial crime has evolved. Detection frameworks haven't.
          </p>
        </motion.div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={p.title}
              className="flex gap-4 p-6 bg-white rounded-2xl border border-slate-200"
              style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-200">
                {p.icon}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-ink mb-1.5">{p.title}</h3>
                <p className="text-[13px] text-muted leading-relaxed">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
