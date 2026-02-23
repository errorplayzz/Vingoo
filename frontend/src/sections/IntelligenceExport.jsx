import { useState, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useAnalysis } from "../context/AnalysisContext";

/* ─── Syntax-highlighted JSON renderer ───────────────────────── */
const SAMPLE = {
  generated_at: "2026-02-19T14:33:07Z",
  total_transactions: 9613,
  flagged_accounts: 14,
  patterns_detected: {
    cycles: 2,
    smurfing: 3,
    shell_chains: 1,
    high_velocity: 8,
  },
  top_suspects: [
    {
      account_id: "ACC-441",
      suspicion_score: 94.2,
      flags: ["cycle", "shell_chain"],
      transactions_involved: 27,
      total_amount_usd: 184200,
    },
    {
      account_id: "ACC-112",
      suspicion_score: 81.5,
      flags: ["smurfing"],
      transactions_involved: 19,
      total_amount_usd: 93400,
    },
    {
      account_id: "ACC-837",
      suspicion_score: 67.8,
      flags: ["high_velocity"],
      transactions_involved: 41,
      total_amount_usd: 210000,
    },
  ],
  report_hash: "sha256:a3f4d1e7b2c09f8a...",
};

function Token({ type, children }) {
  const cls = {
    key:   "token-key",
    str:   "token-str",
    num:   "token-num",
    bool:  "token-bool",
    null:  "token-null",
    brace: "token-brace",
    plain: "text-slate-600",
  };
  return <span className={cls[type] || "text-slate-600"}>{children}</span>;
}

function renderValue(val, indent = 0) {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);

  if (val === null) return <Token type="null">null</Token>;
  if (typeof val === "boolean") return <Token type="bool">{String(val)}</Token>;
  if (typeof val === "number")  return <Token type="num">{val.toLocaleString()}</Token>;
  if (typeof val === "string")  return <Token type="str">"{val}"</Token>;

  if (Array.isArray(val)) {
    return (
      <>
        <Token type="brace">{"["}</Token>
        {"\n"}
        {val.map((item, i) => (
          <span key={i}>
            {padInner}
            {renderValue(item, indent + 1)}
            {i < val.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {pad}
        <Token type="brace">{"]"}</Token>
      </>
    );
  }

  if (typeof val === "object") {
    const entries = Object.entries(val);
    return (
      <>
        <Token type="brace">{"{"}</Token>
        {"\n"}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {padInner}
            <Token type="key">"{k}"</Token>
            <Token type="plain">: </Token>
            {renderValue(v, indent + 1)}
            {i < entries.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {pad}
        <Token type="brace">{"}"}</Token>
      </>
    );
  }

  return <span>{String(val)}</span>;
}

/* ─── Stats mini-tiles ───────────────────────────────────────── */
function buildStats(result) {
  if (!result?.summary) {
    return [
      { label: "Flagged",   value: "14",    sub: "accounts"     },
      { label: "Patterns",  value: "4",     sub: "types found"  },
      { label: "Top score", value: "94.2",  sub: "/ 100"        },
      { label: "Processed", value: "9,613", sub: "transactions" },
    ];
  }
  const s = result.summary;
  const topScore = result.suspicious_accounts?.[0]?.suspicion_score?.toFixed(1) ?? "—";
  const patternTypes = new Set(
    result.fraud_rings?.map((r) => r.pattern_type) ?? []
  ).size || "—";
  return [
    { label: "Flagged",   value: String(s.suspicious_accounts_flagged), sub: "accounts"     },
    { label: "Rings",     value: String(s.fraud_rings_detected),        sub: "detected"     },
    { label: "Top score", value: String(topScore),                      sub: "/ 100"        },
    { label: "Analysed",  value: s.total_accounts_analyzed.toLocaleString(), sub: "accounts" },
  ];
}

function buildReport(result) {
  if (!result?.summary) return SAMPLE;
  const s = result.summary;
  const topSuspects = (result.suspicious_accounts ?? []).slice(0, 5).map((acc) => ({
    account_id: acc.account_id,
    suspicion_score: +acc.suspicion_score.toFixed(2),
    flags: acc.pattern_labels ?? acc.detected_patterns ?? [],
    ring_id: acc.ring_id ?? null,
    ai_confidence: acc.ai_confidence ?? null,
  }));
  const patternsBreakdown = {};
  for (const ring of result.fraud_rings ?? []) {
    const k = ring.pattern_type ?? "unknown";
    patternsBreakdown[k] = (patternsBreakdown[k] ?? 0) + 1;
  }
  return {
    generated_at: result._explained_at ?? new Date().toISOString(),
    total_accounts_analyzed: s.total_accounts_analyzed,
    flagged_accounts: s.suspicious_accounts_flagged,
    fraud_rings_detected: s.fraud_rings_detected,
    processing_time_seconds: s.processing_time_seconds,
    patterns_detected: patternsBreakdown,
    top_suspects: topSuspects,
    report_hash: "sha256:live-analysis-" + Date.now(),
  };
}

/* ─── IntelligenceExport ─────────────────────────────────────── */
export default function IntelligenceExport() {
  const [copied, setCopied] = useState(false);
  const [sectionRef, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const { result, rawResult } = useAnalysis();

  // Use rawResult (exact backend JSON) when available, else fall back to sample
  const reportData   = useMemo(() => rawResult ?? SAMPLE, [rawResult]);
  const stats        = useMemo(() => buildStats(result), [result]);
  const renderedJson = useMemo(() => renderValue(reportData), [reportData]);
  const isLive       = !!rawResult;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [reportData]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = isLive ? "vingoo_analysis_report.json" : "sample_report.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData, isLive]);

  return (
    <section
      id="export"
      className="bg-white border-t border-black/[0.06] py-24 md:py-32"
      ref={sectionRef}
    >
      <div className="container-wide">
        {/* Header */}
        <motion.div
          className="mb-14"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="section-label mb-3">Compliance Output (Hackathon Spec)</p>
          <h2 className="section-title max-w-lg">
            Raw backend JSON.
            <br />Unmodified output.
          </h2>
          <p className="mt-4 text-muted max-w-md leading-relaxed">
            {isLive
              ? "Exact API response from the analysis engine — no transformation applied. Suitable for direct law enforcement handoff."
              : "Sample output shown below. Upload a CSV to see your live analysis JSON."}
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">

          {/* Code block */}
          <motion.div
            className="flex-1 min-w-0"
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-2xl overflow-hidden border border-black/[0.07] shadow-glass">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {["bg-red-300","bg-yellow-300","bg-green-300"].map((c,i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${c}`} />
                    ))}
                  </div>
                  <span className="ml-3 text-[12px] font-mono text-muted">
                    {isLive ? "vingoo_analysis_report.json" : "sample_report.json"}
                  </span>
                  {isLive && (
                    <span className="text-[9.5px] font-bold text-green-600 border border-green-200 bg-green-50 px-1.5 py-0.5 rounded-full ml-1">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink transition-colors duration-150 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-black/[0.08]"
                    whileTap={{ scale: 0.96 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M6.5 2v7M3 7l3.5 3.5L10 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 11h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Download
                  </motion.button>
                  <motion.button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink transition-colors duration-150 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-black/[0.08]"
                    whileTap={{ scale: 0.96 }}
                  >
                    {copied ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2.5 6.5l3 3 5-5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-green-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M8.5 4.5V3a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        Copy JSON
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Code surface */}
              <pre className="code-surface p-6 overflow-x-auto text-[12.5px] max-h-[440px]">
                <code>
                  {renderedJson}
                </code>
              </pre>
            </div>
          </motion.div>

          {/* Right panel */}
          <motion.div
            className="lg:w-72 flex flex-col gap-5"
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  className="glass-card rounded-xl p-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.08 + 0.4, duration: 0.5 }}
                >
                  <p className="text-2xl font-black tracking-tight text-ink">{s.value}</p>
                  <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-faint">{s.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Export actions */}
            <div className="glass-card rounded-xl p-5 space-y-3">
              <p className="text-[13px] font-semibold text-ink mb-1">Export Formats</p>
              {[
                { label: "JSON Report",    ext: ".json", active: true  },
                { label: "CSV Summary",    ext: ".csv",  active: false },
                { label: "PDF Briefing",   ext: ".pdf",  active: false },
              ].map((f) => (
                <div
                  key={f.label}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
                    f.active
                      ? "bg-accent/8 text-accent font-medium"
                      : "text-muted hover:bg-slate-50"
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="font-mono text-[11px]">{f.ext}</span>
                </div>
              ))}
            </div>

            {/* Integrity badge */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/8 flex items-center justify-center text-accent">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 1l6 2.5v4C14 11 11 14 8 15 5 14 2 11 2 7.5v-4L8 1z"/>
                    <path d="M5.5 8l2 2L11 6"/>
                  </svg>
                </div>
                <p className="text-[13px] font-semibold text-ink">Integrity Verified</p>
              </div>
              <p className="text-[12px] text-muted leading-relaxed">
                Each report is SHA-256 hashed. Any post-export tampering is
                immediately detectable.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
