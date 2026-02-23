import { useState } from 'react';
import FadeUp from '../components/FadeUp';

const MOCK_JSON = `{
  "suspicious_accounts": [
    {
      "account_id": "ACC_00143",
      "suspicion_score": 87.4,
      "detected_patterns": [
        "cycle_length_3",
        "high_velocity"
      ],
      "ring_id": "RING_007"
    },
    {
      "account_id": "COLLECTOR",
      "suspicion_score": 72.1,
      "detected_patterns": ["fan_in"],
      "ring_id": null
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_007",
      "member_accounts": [
        "ACC_00143",
        "ACC_00791",
        "ACC_00009"
      ],
      "pattern_type": "cycle_length_3",
      "risk_score": 84.3
    }
  ],
  "summary": {
    "total_accounts_analyzed": 923,
    "suspicious_accounts_flagged": 179,
    "fraud_rings_detected": 27,
    "processing_time_seconds": 10.54
  }
}`;

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
    title: 'Structured JSON Export',
    description:
      'Every analysis produces a fully typed JSON response — account list, ring mappings, pattern labels, risk scores — ready for downstream ingestion.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    title: 'Fraud Ring Mapping',
    description:
      'Each detected cycle is labeled with a unique ring ID, member list, and risk score. Maps directly to law enforcement case numbering.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5" />
        <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5" />
      </svg>
    ),
    title: 'Law Enforcement Integration',
    description:
      'The GET /export endpoint returns the latest cached report. Integrates with SIEM, BNM reporting portals, and police intelligence systems.',
  },
];

export default function CyberIntelligence() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MOCK_JSON).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="intelligence" className="section-padding bg-[#FAFAFA] border-t border-border">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeUp>
          <div className="max-w-2xl mb-14">
            <p className="text-[12px] font-semibold text-accent tracking-widest uppercase mb-3">
              Cyber Intelligence Export
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight leading-tight">
              Machine-readable.
              <br />
              Enforcement-ready.
            </h2>
          </div>
        </FadeUp>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Feature list */}
          <div className="lg:w-2/5 flex flex-col gap-8">
            {features.map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.1}>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-1.5">{f.title}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{f.description}</p>
                  </div>
                </div>
              </FadeUp>
            ))}

            {/* Endpoint pill */}
            <FadeUp delay={0.3}>
              <div className="mt-2 p-5 bg-white border border-border rounded-xl">
                <p className="text-[11px] text-secondary uppercase tracking-wider font-semibold mb-3">Endpoints</p>
                {[
                  { method: 'GET', path: '/export', desc: 'Latest analysis JSON' },
                  { method: 'POST', path: '/analyze', desc: 'Run full detection' },
                  { method: 'GET', path: '/health', desc: 'Liveness probe' },
                ].map((e) => (
                  <div key={e.path} className="flex items-center gap-3 mb-2 last:mb-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                      e.method === 'GET' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-accent'
                    }`}>
                      {e.method}
                    </span>
                    <code className="text-[12px] text-primary font-mono">{e.path}</code>
                    <span className="text-[11px] text-secondary/60">{e.desc}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>

          {/* JSON block */}
          <FadeUp delay={0.2} className="lg:w-3/5 w-full">
            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[#FAFAFA]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-300" />
                  <span className="w-3 h-3 rounded-full bg-yellow-300" />
                  <span className="w-3 h-3 rounded-full bg-green-300" />
                  <span className="ml-3 text-[12px] text-secondary font-mono">analysis_response.json</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="text-[11px] text-secondary hover:text-accent transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      Copy
                    </>
                  )}
                </button>
              </div>

              {/* Code content */}
              <div className="overflow-auto max-h-[500px]">
                <pre className="p-5 text-[12px] leading-relaxed font-mono text-primary">
                  {MOCK_JSON.split('\n').map((line, i) => {
                    let className = '';
                    if (line.includes('"account_id"') || line.includes('"ring_id"') || line.includes('"pattern_type"')) className = 'text-accent';
                    if (line.includes('"suspicion_score"') || line.includes('"risk_score"')) className = 'text-red-500';
                    if (line.includes('87.4') || line.includes('72.1') || line.includes('84.3') || line.includes('10.54')) className = 'text-red-500';
                    if (line.includes('cycle_length') || line.includes('high_velocity') || line.includes('fan_in')) className = 'text-orange-500';
                    return (
                      <span key={i} className={`block ${className}`}>{line}</span>
                    );
                  })}
                </pre>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
