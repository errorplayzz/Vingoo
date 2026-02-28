/**
 * SystemCapabilities.jsx — light theme
 * Two-column grid: IMPLEMENTED (green badge) + ROADMAP (gray badge).
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { API_BASE } from "../api/client";

const EASE = [0.22, 1, 0.36, 1];

function CapBadge({ status }) {
  const isLive = status === "IMPLEMENTED";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.10em] uppercase px-2 py-1 rounded-full flex-shrink-0 border ${isLive ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLive ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`} />
      {isLive ? "Live" : "Roadmap"}
    </span>
  );
}

function ModuleCard({ module, index }) {
  const isLive = module.status === "IMPLEMENTED";
  return (
    <motion.div
      className="flex items-start justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: EASE }}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold mb-0.5 truncate ${isLive ? "text-ink" : "text-slate-400"}`}>{module.name}</p>
        {module.description && (
          <p className="text-[11px] text-muted leading-snug line-clamp-2">{module.description}</p>
        )}
      </div>
      <CapBadge status={module.status} />
    </motion.div>
  );
}

export default function SystemCapabilities() {
  const [caps, setCaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    fetch(`${API_BASE}/system-capabilities`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setCaps(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inView]);

  const fallbackImplemented = [
    { name: "Graph-Based Network Analysis",   status: "IMPLEMENTED", description: "NetworkX directed-graph construction from raw transaction CSV" },
    { name: "Cycle Detection",                status: "IMPLEMENTED", description: "DFS-based closed-loop identification across account networks" },
    { name: "Smurfing Detection",             status: "IMPLEMENTED", description: "Fan-in pattern recognition, sub-threshold aggregation detection" },
    { name: "Shell Chain Detection",          status: "IMPLEMENTED", description: "Pass-through node chains with minimal activity identification" },
    { name: "High-Velocity Detection",        status: "IMPLEMENTED", description: "Burst-transaction temporal anomaly scoring" },
    { name: "ML Anomaly Scoring",             status: "IMPLEMENTED", description: "IsolationForest composite risk scoring per account" },
    { name: "Financial Role Classification",  status: "IMPLEMENTED", description: "CONTROLLER / MULE / VICTIM role probability assignment" },
    { name: "Evidence Integrity Seal",        status: "IMPLEMENTED", description: "SHA-256 tamper-evident seal, verifiable at /verify/{id}" },
  ];
  const fallbackRoadmap = [
    { name: "Blockchain Anchoring",           status: "ROADMAP", description: "On-chain notarisation for irrefutable evidence provenance" },
    { name: "Real-Time Stream Ingestion",     status: "ROADMAP", description: "Kafka-based live transaction monitoring pipeline" },
    { name: "Cross-Institution Graph Fusion", status: "ROADMAP", description: "Multi-bank graph federation with privacy-preserving joins" },
    { name: "Automated SAR Drafting",         status: "ROADMAP", description: "Regulatory Suspicious Activity Report generation from AI" },
    { name: "Investigator Collaboration Hub", status: "ROADMAP", description: "Multi-analyst real-time case annotation and assignment" },
  ];

  const implemented = caps?.capabilities?.filter(c => c.status === "IMPLEMENTED") ?? fallbackImplemented;
  const roadmap     = caps?.capabilities?.filter(c => c.status === "ROADMAP")     ?? fallbackRoadmap;

  return (
    <section id="capabilities" className="py-24 bg-white border-t border-slate-100" ref={ref}>
      <div className="container-wide">
        <motion.div className="mb-14" initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, ease: EASE }}>
          <p className="section-label mb-3">System Architecture</p>
          <h2 className="section-title max-w-lg">Built. Not promised.</h2>
          <p className="mt-4 text-muted text-[1rem] leading-relaxed max-w-md">Every module below is running in production. Roadmap items are on the public timeline.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10 xl:gap-16">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-emerald-200" />
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-emerald-600">{implemented.length} Implemented</span>
              <div className="h-px flex-1 bg-emerald-200" />
            </div>
            <div className="space-y-2.5">
              {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[58px] rounded-xl bg-slate-100 animate-pulse" />) : implemented.map((m, i) => <ModuleCard key={m.name} module={m} index={i} />)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">{roadmap.length} On Roadmap</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="space-y-2.5">
              {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[58px] rounded-xl bg-slate-100 animate-pulse" />) : roadmap.map((m, i) => <ModuleCard key={m.name} module={m} index={i} />)}
            </div>
          </div>
        </div>

        {caps && (
          <motion.p className="mt-10 text-[11px] font-mono text-muted flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.7 }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live data from GET /system-capabilities · {new Date(caps.generated_at ?? Date.now()).toUTCString()}
          </motion.p>
        )}
      </div>
    </section>
  );
}
