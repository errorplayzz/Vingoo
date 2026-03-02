/**
 * SystemCapabilities.jsx — premium single-viewport redesign
 * Left col: headline + metrics | Right col: live + roadmap capability cards
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { API_BASE } from "../api/client";

const EASE = [0.22, 1, 0.36, 1];

function CapRow({ module, index, isLive }) {
  return (
    <motion.div
      className="group flex items-start gap-3 p-3 rounded-xl border cursor-default relative overflow-hidden"
      style={{
        background: "#ffffff",
        borderColor: isLive ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.15)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
      }}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: EASE }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"
        style={{ background: isLive ? "radial-gradient(ellipse at 0% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)" : "radial-gradient(ellipse at 0% 50%, rgba(148,163,184,0.05) 0%, transparent 70%)" }}/>
      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: isLive ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.1)" }}>
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-slate-300"}`}
          style={isLive ? { boxShadow: "0 0 4px rgba(16,185,129,0.6)" } : {}} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold leading-snug mb-0.5 truncate"
          style={{ color: isLive ? "#0F172A" : "#94A3B8" }}>{module.name}</p>
        {module.description && (
          <p className="text-[11px] leading-snug line-clamp-1" style={{ color: "#94A3B8" }}>{module.description}</p>
        )}
      </div>
      {isLive && (
        <div className="flex-shrink-0 text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}>Live</div>
      )}
    </motion.div>
  );
}

export default function SystemCapabilities() {
  const [caps, setCaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.06 });

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
    { name: "Automated SAR Drafting",         status: "ROADMAP", description: "Suspicious Activity Report generation from AI analysis" },
    { name: "Investigator Collaboration Hub", status: "ROADMAP", description: "Multi-analyst real-time case annotation and assignment" },
  ];

  const implemented = caps?.capabilities?.filter(c => c.status === "IMPLEMENTED") ?? fallbackImplemented;
  const roadmap     = caps?.capabilities?.filter(c => c.status === "ROADMAP")     ?? fallbackRoadmap;

  return (
    <section
      id="capabilities"
      ref={ref}
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #F0F7FF 0%, #F5F8FF 35%, #ffffff 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}/>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 65%)" }}/>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)" }}/>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.2), rgba(99,102,241,0.2), transparent)" }}/>

      <div className="container-wide relative w-full py-16">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.35fr] gap-12 xl:gap-20 items-start">

          {/* LEFT */}
          <motion.div className="xl:sticky xl:top-24"
            initial={{ opacity: 0, x: -28 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border"
              style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-600">System Capabilities</span>
            </div>

            <h2 className="font-black leading-[1.05] tracking-tight mb-4"
              style={{ fontSize: "clamp(1.9rem, 3.2vw, 2.8rem)", color: "#0F172A" }}>
              Built.<br />Not
              <span style={{
                background: "linear-gradient(135deg, #10B981 0%, #3B82F6 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}> promised.</span>
            </h2>

            <p className="text-[0.92rem] leading-relaxed mb-8 max-w-[380px]" style={{ color: "#64748B" }}>
              What is live in production today and what is shipping next. No vaporware, no features hidden behind a paywall.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              <div className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.15)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.12)" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                    <path d="M3 8.5l3 3 7-7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: "#0F172A" }}>{implemented.length} modules live</div>
                  <div className="text-[11px]" style={{ color: "#64748B" }}>Deployed and verified in production</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.12)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.1)" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="5.5" stroke="#6366F1" strokeWidth="1.5"/>
                    <path d="M8 5v3.5l2 1.5" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: "#0F172A" }}>{roadmap.length} shipping next</div>
                  <div className="text-[11px]" style={{ color: "#64748B" }}>On the active development roadmap</div>
                </div>
              </div>
            </div>

            {caps && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-[10px] font-mono" style={{ color: "#94A3B8" }}>
                  Live · GET /system-capabilities
                </span>
              </div>
            )}
          </motion.div>

          {/* RIGHT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.15, ease: EASE }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: "rgba(16,185,129,0.3)" }}/>
                <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: "#10B981" }}>Live Now</span>
                <div className="h-px flex-1" style={{ background: "rgba(16,185,129,0.3)" }}/>
              </div>
              <div className="flex flex-col gap-2">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-[60px] rounded-xl animate-pulse"
                        style={{ background: "rgba(16,185,129,0.06)" }}/>
                    ))
                  : implemented.map((m, i) => <CapRow key={m.name} module={m} index={i} isLive={true} />)
                }
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.25, ease: EASE }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: "rgba(148,163,184,0.3)" }}/>
                <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: "#94A3B8" }}>Roadmap</span>
                <div className="h-px flex-1" style={{ background: "rgba(148,163,184,0.3)" }}/>
              </div>
              <div className="flex flex-col gap-2">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[60px] rounded-xl animate-pulse"
                        style={{ background: "rgba(148,163,184,0.06)" }}/>
                    ))
                  : roadmap.map((m, i) => <CapRow key={m.name} module={m} index={i} isLive={false} />)
                }
              </div>
              <div className="mt-3 p-3 rounded-xl border border-dashed flex items-center gap-3"
                style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.03)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.1)" }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                    <path d="M7 2v10M2 7h10" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-[11px]" style={{ color: "#94A3B8" }}>More modules shipping Q2 2026</span>
              </div>
            </motion.div>
          </div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.15), rgba(99,102,241,0.15), transparent)" }}/>
    </section>
  );
}
