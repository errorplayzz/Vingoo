import { useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

/*  Animation preset 
   One philosophy site-wide: fade + upward translate, ease-out.
    */
const EASE = [0.4, 0, 0.2, 1];

/*  STEP 1 VISUAL — Premium Upload Card  */
function UploadCard() {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="w-full max-w-[440px] bg-white rounded-2xl border border-black/[0.07] overflow-hidden"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05)" }}
    >
      {/* Toolbar chrome */}
      <div className="flex items-center gap-2 px-5 py-3.5 bg-slate-50 border-b border-black/[0.06]">
        <div className="flex gap-1.5">
          {["bg-red-300", "bg-yellow-300", "bg-green-300"].map((c, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
          ))}
        </div>
        <span className="ml-3 text-[12px] font-mono text-muted tracking-wide">
          transactions.csv
        </span>
      </div>

      {/* Drop zone */}
      <div className="p-6">
        <motion.div
          className="relative rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer select-none"
          animate={{
            borderColor: dragging ? "rgba(29,78,216,0.55)" : "rgba(0,0,0,0.10)",
            backgroundColor: dragging ? "rgba(29,78,216,0.03)" : "rgba(248,250,252,0.6)",
            scale: dragging ? 1.01 : 1,
          }}
          transition={{ duration: 0.2, ease: EASE }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); }}
          whileHover={{
            borderColor: "rgba(29,78,216,0.35)",
            backgroundColor: "rgba(29,78,216,0.015)",
          }}
        >
          <motion.div
            className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center"
            animate={{ y: dragging ? -3 : 0, scale: dragging ? 1.05 : 1 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-accent">
              <path d="M11 14V4M7 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 16v1.5A1.5 1.5 0 004.5 19h13a1.5 1.5 0 001.5-1.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </motion.div>

          <div className="text-center">
            <p className="text-sm font-semibold text-ink">
              {dragging ? "Release to upload" : "Drop your CSV here"}
            </p>
            <p className="text-xs text-faint mt-1">
              sender_id  receiver_id  amount  timestamp
            </p>
          </div>

          {dragging && (
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-accent pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ boxShadow: "0 0 0 4px rgba(29,78,216,0.08)" }}
            />
          )}
        </motion.div>

        {/* Field preview */}
        <div className="mt-5 space-y-2">
          {[
            { col: "sender_id",   ex: "ACC_A441" },
            { col: "receiver_id", ex: "ACC_B112" },
            { col: "amount",      ex: "14,800.00" },
            { col: "timestamp",   ex: "2024-01-12T09:41Z" },
          ].map((f, i) => (
            <motion.div
              key={f.col}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-black/[0.05]"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 + 0.3, duration: 0.45, ease: EASE }}
            >
              <span className="text-[11px] font-mono font-semibold text-ink">{f.col}</span>
              <span className="text-[11px] font-mono text-faint">{f.ex}</span>
            </motion.div>
          ))}
        </div>

        {/* Status row */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-muted font-medium">9,613 rows detected</span>
          </div>
          <span className="text-[11px] font-medium text-accent bg-accent/8 px-2.5 py-1 rounded-full">
            Ready to analyze
          </span>
        </div>
      </div>
    </div>
  );
}

/*  STEP 2 VISUAL — Graph topology  */
function GraphVisual() {
  return (
    <div
      className="w-full max-w-[440px] bg-white rounded-2xl border border-black/[0.07] p-6"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05)" }}
    >
      <p className="text-[11px] font-semibold text-faint uppercase tracking-widest mb-4">
        Graph topology  live view
      </p>
      <svg viewBox="0 0 320 200" className="w-full h-44" xmlns="http://www.w3.org/2000/svg">
        {[
          [40,100,120,40],[120,40,200,100],[200,100,160,160],
          [160,160,80,160],[80,160,40,100],
          [120,40,160,100],[40,100,160,100],[200,100,160,100],
          [280,80,200,100],[60,50,120,40],
        ].map(([x1,y1,x2,y2],i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#CBD5E1" strokeWidth="1.2"
            className="svg-edge" style={{ animationDelay:`${i*0.12}s` }} />
        ))}
        {[[40,100,120,40],[120,40,200,100],[200,100,80,160],[80,160,40,100]].map(([x1,y1,x2,y2],i) => (
          <line key={"h"+i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#1D4ED8" strokeWidth="2" strokeOpacity="0.8"
            className="svg-edge" style={{ animationDelay:`${i*0.18+0.8}s` }} />
        ))}
        {[[160,100],[280,80],[60,50],[160,160]].map(([cx,cy],i) => (
          <circle key={"n"+i} cx={cx} cy={cy} r={4} fill="#CBD5E1" />
        ))}
        {[[40,100,"A"],[120,40,"B"],[200,100,"C"],[80,160,"D"]].map(([cx,cy,l]) => (
          <g key={l}>
            <circle cx={cx} cy={cy} r={7} fill="#1D4ED8"
              className="node-pulse" style={{ animationDelay:`${["A","B","C","D"].indexOf(l)*0.15+1.2}s` }} />
            <text x={cx} y={cy+20} textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="monospace">
              ACC_{l}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-2 mt-2">
        {["Cycle  4 nodes","168h window"," 14,800 USD"].map((t) => (
          <span key={t} className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-accent/20 text-accent bg-accent/[0.05]">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/*  STEP 3 VISUAL — Scored output  */
function ScoredVisual() {
  const rows = [
    { id: "ACC-441", score: 94, flag: "Cycle + Shell" },
    { id: "ACC-112", score: 81, flag: "Smurfing" },
    { id: "ACC-837", score: 67, flag: "High velocity" },
    { id: "ACC-229", score: 42, flag: "Fan-in cluster" },
  ];
  return (
    <div
      className="w-full max-w-[440px] bg-white rounded-2xl border border-black/[0.07] overflow-hidden"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05)" }}
    >
      <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-widest">Suspicion scores</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-muted font-medium">Export ready</span>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {rows.map((r, i) => (
          <motion.div key={r.id} className="flex items-center gap-3"
            initial={{ opacity:0, x:-12 }} whileInView={{ opacity:1, x:0 }}
            viewport={{ once:true }}
            transition={{ delay:i*0.12+0.2, duration:0.5, ease:EASE }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-ink/[0.04] border border-black/[0.06]">
              <span className="text-[11px] font-black text-ink">{r.score}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-[12px] font-semibold font-mono text-ink">{r.id}</span>
                <span className="text-[10px] text-faint flex-shrink-0">{r.flag}</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                <motion.div className="h-full rounded-full bg-accent"
                  initial={{ width:0 }} whileInView={{ width:`${r.score}%` }}
                  viewport={{ once:true }}
                  transition={{ delay:i*0.12+0.4, duration:0.7, ease:EASE }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="px-5 py-3.5 bg-slate-50 border-t border-black/[0.06] flex items-center justify-between">
        <span className="text-[11px] text-muted font-mono">fraud_intelligence_report.json</span>
        <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Download </span>
      </div>
    </div>
  );
}

/*  Step data  */
const STEPS = [
  {
    num: "01", label: "Upload",
    headline: "Drop your transaction data.",
    body: "Feed a CSV with sender, receiver, amount, and timestamp. The engine validates schema, resolves duplicates, and constructs the directed transaction graph in under two seconds.",
    visual: <UploadCard />,
  },
  {
    num: "02", label: "Analyze",
    headline: "Graph reveals what tables hide.",
    body: "Every transaction becomes a directed edge. Cycles, fan-in clusters, layered shell chains — all surface through graph topology that flat relational data structurally cannot see.",
    visual: <GraphVisual />,
  },
  {
    num: "03", label: "Intelligence",
    headline: "Precision-scored. Export-ready.",
    body: "Each entity receives a composite suspicion score from seven weighted signals: cycle depth, velocity, centrality, flow imbalance, layering index, time clustering, and pattern co-occurrence.",
    visual: <ScoredVisual />,
  },
];

/*  StepRow  */
function StepRow({ step }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.15 });
  return (
    <div ref={ref} className="flex flex-col lg:flex-row items-start lg:items-center gap-12 xl:gap-20">
      {/* Copy */}
      <motion.div className="flex-1 max-w-xl"
        initial={{ opacity:0, y:16 }} animate={inView ? { opacity:1, y:0 } : {}}
        transition={{ duration:0.6, ease:EASE }}>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[11px] font-bold text-accent tracking-widest uppercase">{step.num}</span>
          <div className="h-px w-8 bg-black/10" />
          <span className="text-[11px] font-medium text-faint uppercase tracking-widest">{step.label}</span>
        </div>
        <h3 className="font-black text-ink mb-5 leading-[1.05] tracking-tight"
          style={{ fontSize:"clamp(2rem,4.5vw,3.25rem)", letterSpacing:"-0.025em" }}>
          {step.headline}
        </h3>
        <p className="text-muted leading-relaxed max-w-lg" style={{ fontSize:"1.0625rem" }}>
          {step.body}
        </p>
      </motion.div>

      {/* Visual */}
      <motion.div className="flex-1 w-full lg:w-auto lg:flex-none"
        initial={{ opacity:0, y:16 }} animate={inView ? { opacity:1, y:0 } : {}}
        transition={{ duration:0.6, delay:0.15, ease:EASE }}>
        {step.visual}
      </motion.div>
    </div>
  );
}

/*  HowItWorks  */
export default function HowItWorks() {
  const [headerRef, headerInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  return (
    <section id="how" className="bg-white border-t border-black/[0.06]" style={{ overflowX:"hidden" }}>
      <div className="container-wide py-28 md:py-32">

        {/* Section header */}
        <motion.div ref={headerRef} className="mb-20 md:mb-24 max-w-2xl"
          initial={{ opacity:0, y:16 }} animate={headerInView ? { opacity:1, y:0 } : {}}
          transition={{ duration:0.6, ease:EASE }}>
          <p className="section-label mb-3">How It Works</p>
          <h2 className="section-title">
            Three steps from raw data<br />to fraud intelligence.
          </h2>
          <p className="mt-5 text-muted text-lg leading-relaxed">
            From a single CSV to a court-ready intelligence report —
            the entire pipeline runs in under eleven seconds.
          </p>
        </motion.div>

        {/* Steps */}
        {STEPS.map((step, i) => (
          <div key={step.num}>
            <StepRow step={step} />
            {i < STEPS.length - 1 && (
              <div className="my-20 md:my-24 flex items-center gap-6">
                <div className="flex-1 h-px bg-black/[0.06]" />
                <div className="w-1 h-1 rounded-full bg-black/15 flex-shrink-0" />
                <div className="flex-1 h-px bg-black/[0.06]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
