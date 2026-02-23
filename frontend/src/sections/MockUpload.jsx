import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FadeUp from '../components/FadeUp';

const MOCK_RESULTS = {
  suspicious_accounts: 23,
  fraud_rings: 4,
  processing_time: 2.34,
};

export default function MockUpload() {
  const [state, setState] = useState('idle'); // idle | uploading | done
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState('');

  const startFakeUpload = useCallback((name) => {
    setFilename(name);
    setState('uploading');
    setProgress(0);
    let p = 0;
    const steps = [8, 22, 41, 58, 73, 88, 95, 100];
    steps.forEach((target, i) => {
      setTimeout(() => {
        setProgress(target);
        if (target === 100) setTimeout(() => setState('done'), 400);
      }, i * 280);
    });
  }, []);

  const handleFile = (file) => {
    if (file) startFakeUpload(file.name);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  const reset = () => { setState('idle'); setProgress(0); setFilename(''); };

  return (
    <section id="upload" className="section-padding bg-[#FAFAFA] border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left — text */}
          <div className="lg:w-2/5">
            <FadeUp>
              <p className="text-[12px] font-semibold text-accent tracking-widest uppercase mb-3">
                Upload & Analyze
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight leading-tight mb-6">
                Drop your CSV.<br />Get intelligence.
              </h2>
              <p className="text-base text-secondary leading-relaxed mb-8">
                Upload any financial transaction CSV and receive a structured
                fraud report in under 15 seconds. Columns required:
              </p>
              <ul className="space-y-2">
                {['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'].map((col) => (
                  <li key={col} className="flex items-center gap-2.5 text-sm text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    <code className="font-mono text-[12px] text-primary">{col}</code>
                  </li>
                ))}
              </ul>
            </FadeUp>
          </div>

          {/* Right — upload card */}
          <FadeUp delay={0.15} className="lg:w-3/5 w-full">
            <div className="bg-white border border-border rounded-2xl p-8 shadow-sm">
              <AnimatePresence mode="wait">
                {state === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    <label
                      htmlFor="csv-upload"
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ${
                        dragOver ? 'border-accent bg-accent-light' : 'border-border hover:border-accent/60 hover:bg-accent-light/50'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center text-accent mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v12M8 7l4-4 4 4M20 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-primary mb-1">
                        Drag & drop your CSV file here
                      </p>
                      <p className="text-xs text-secondary">or click to browse</p>
                      <input
                        id="csv-upload" type="file" accept=".csv"
                        className="sr-only" onChange={handleChange}
                      />
                    </label>

                    <p className="text-[11px] text-secondary/60 text-center mt-4">
                      Supported format: .csv &nbsp;|&nbsp; Max size: 50 MB
                    </p>
                  </motion.div>
                )}

                {state === 'uploading' && (
                  <motion.div
                    key="uploading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="py-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center text-accent flex-shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">{filename}</p>
                        <p className="text-xs text-secondary">Analyzing transactions…</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-3">
                      <motion.div
                        className="h-full bg-accent rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    {/* Stage labels */}
                    <div className="flex justify-between text-[11px] text-secondary">
                      <span className={progress >= 30 ? 'text-accent' : ''}>Parsing</span>
                      <span className={progress >= 60 ? 'text-accent' : ''}>Graph build</span>
                      <span className={progress >= 85 ? 'text-accent' : ''}>Detection</span>
                      <span className={progress === 100 ? 'text-accent' : ''}>Scoring</span>
                    </div>
                  </motion.div>
                )}

                {state === 'done' && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-6"
                  >
                    {/* Success header */}
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">Analysis complete</p>
                        <p className="text-xs text-secondary">Processed in {MOCK_RESULTS.processing_time}s</p>
                      </div>
                    </div>

                    {/* Results summary */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      {[
                        { label: 'Suspicious Accounts', value: MOCK_RESULTS.suspicious_accounts, color: 'text-red-500' },
                        { label: 'Fraud Rings', value: MOCK_RESULTS.fraud_rings, color: 'text-orange-500' },
                        { label: 'Processing Time', value: `${MOCK_RESULTS.processing_time}s`, color: 'text-accent' },
                      ].map((item) => (
                        <div key={item.label} className="bg-[#FAFAFA] border border-border rounded-lg p-4 text-center">
                          <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                          <div className="text-[11px] text-secondary mt-1">{item.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded hover:bg-[#005fa3] transition-colors">
                        View Full Report
                      </button>
                      <button
                        onClick={reset}
                        className="flex-1 py-2.5 border border-border text-sm font-medium text-secondary rounded hover:border-accent hover:text-accent transition-colors"
                      >
                        New Upload
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
