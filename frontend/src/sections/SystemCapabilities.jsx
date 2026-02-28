import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { API_BASE } from "../api/client";

/* ── Capability badge ──────────────────────────────────────────────────────── */
function CapBadge({ status }) {
  const isLive = status === "IMPLEMENTED";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full flex-shrink-0"
      style={
        isLive
          ? { background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.22)" }
          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.09)" }
      }
    >
      {isLive ? (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
      )}
      {isLive ? "Live" : "Roadmap"}
    </span>
  );
}

/* ── Module card ─────────────────────────────────────────────────────────────*/
function ModuleCard({ module, index }) {
  return (
    <motion.div
      className="flex items-start justify-between gap-3 p-4 rounded-xl"
      style={{ background: "rgba(255,255,255,0.032)", border: "1px solid rgba(255,255,255,0.07)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ background: "rgba(255,255,255,0.055)", borderColor: "rgba(255,255,255,0.11)" }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold mb-0.5 truncate"
          style={{ color: module.status === "IMPLEMENTED" ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.38)" }}
        >
          {module.name}
        </p>
        {module.description && (
          <p className="text-[11px] leading-snug line-clamp-2" style={{ color: "rgba(255,255,255,0.28)" }}>
            {module.description}
          </p>
        )}
      </div>
      <CapBadge status={module.status} />
    </motion.div>
  );
}

/* ── Main section ────────────────────────────────────────────────────────────*/
export default function SystemCapabilities() {
  const [caps, setCaps] = useState(null);
  const [loading, setLoading] = useState(true);

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    fetch(`${API_BASE}/system-capabilities`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCaps(d); })
      .catch(() => { /* silently use fallback */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inView]);

  /* Fixed fallback so section never looks broken */
  const fallbackImplemented = [
    { name: "Graph-Based Network Analysis", status: "IMPLEMENTED", description: "NetworkX directed-graph construction from raw transaction CSV" },
    { name: "Cycle Detection", status: "IMPLEMENTED", description: "DFS-based closed-loop identification across account networks" },
    { name: "Smurfing Detection", status: "IMPLEMENTED", description: "Fan-in pattern recognition, sub-threshold aggregation detection" },
    { name: "Shell Chain Detection", status: "IMPLEMENTED", description: "Pass-through node chains with minimal activity identification" },
    { name: "High-Velocity Detection", status: "IMPLEMENTED", description: "Burst-transaction temporal anomaly scoring" },
    { name: "ML Anomaly Scoring", status: "IMPLEMENTED", description: "IsolationForest composite risk scoring per account" },
    { name: "Financial Role Classification", status: "IMPLEMENTED", description: "CONTROLLER / MULE / POSSIBLE_VICTIM role probability assignment" },
    { name: "Evidence Integrity Seal", status: "IMPLEMENTED", description: "SHA-256 tamper-evident analysis seal, verifiable at /verify/{id}" },
  ];
  const fallbackRoadmap = [
    { name: "Blockchain Anchoring", status: "ROADMAP", description: "On-chain notarisation for irrefutable evidence provenance" },
    { name: "Real-Time Stream Ingestion", status: "ROADMAP", description: "Kafka-based live transaction monitoring pipeline" },
    { name: "Cross-Institution Graph Fusion", status: "ROADMAP", description: "Multi-bank graph federation with privacy-preserving joins" },
    { name: "Automated SAR Drafting", status: "ROADMAP", description: "Regulatory Suspicious Activity Report generation from AI narrative" },
    { name: "Investigator Collaboration Hub", status: "ROADMAP", description: "Multi-analyst real-time case annotation and assignment" },
  ];

  const implemented = caps?.capabilities?.filter((c) => c.status === "IMPLEMENTED") ?? fallbackImplemented;
  const roadmap     = caps?.capabilities?.filter((c) => c.status === "ROADMAP")     ?? fallbackRoadmap;

  const EASE = [0.22, 1, 0.36, 1];

  return (
    <section
      id="capabilities"
      ref={ref}
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #060B18 0%, #070D1C 100%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Decorative glow */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[360px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(29,78,216,0.10) 0%, transparent 70%)" }}
      />

      <div className="container-wide py-28">
        {/* Header */}
        <motion.div
          className="mb-16 max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(29,78,216,0.12)", border: "1px solid rgba(59,130,246,0.22)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "rgba(147,197,253,0.80)" }}>
              System Architecture
            </span>
          </div>
          <h2
            className="font-black mb-4 tracking-tight"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)", lineHeight: 1.05, color: "rgba(255,255,255,0.92)" }}
          >
            Built. Not promised.
          </h2>
          <p className="text-[1rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            Every module below is running in production. Roadmap items are on the public timeline.
          </p>
        </motion.div>

        {/* Two-column grid */}
        <div className="grid md:grid-cols-2 gap-8 xl:gap-12">

          {/* Implemented */}
          <div>
            <motion.div
              className="flex items-center gap-3 mb-5"
              initial={{ opacity: 0, x: -10 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            >
              <div className="h-px flex-1" style={{ background: "rgba(16,185,129,0.25)" }} />
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "#34D399" }}>
                {implemented.length} Implemented
              </span>
              <div className="h-px flex-1" style={{ background: "rgba(16,185,129,0.25)" }} />
            </motion.div>
            <div className="space-y-2.5">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[60px] rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
                  ))
                : implemented.map((m, i) => <ModuleCard key={m.name} module={m} index={i} />)}
            </div>
          </div>

          {/* Roadmap */}
          <div>
            <motion.div
              className="flex items-center gap-3 mb-5"
              initial={{ opacity: 0, x: 10 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            >
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "rgba(255,255,255,0.28)" }}>
                {roadmap.length} On Roadmap
              </span>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
            </motion.div>
            <div className="space-y-2.5">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-[60px] rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
                  ))
                : roadmap.map((m, i) => <ModuleCard key={m.name} module={m} index={i} />)}
            </div>
          </div>

        </div>

        {/* Backend source badge */}
        {caps && (
          <motion.div
            className="mt-10 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.22)" }}>
              Live data from GET /system-capabilities &nbsp;·&nbsp; {new Date(caps.generated_at ?? Date.now()).toUTCString()}
            </span>
          </motion.div>
        )}
      </div>
    </section>
  );
}
