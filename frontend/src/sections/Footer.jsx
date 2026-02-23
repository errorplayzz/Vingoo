import { motion } from "framer-motion";

const LINKS = {
  Platform: ["How It Works", "Graph Analysis", "Pattern Detection", "Risk Scoring"],
  Legal:    ["Terms of Service", "Privacy Policy", "Data Handling", "Compliance"],
  Connect:  ["API Documentation", "CSV Format Guide", "Legal Guidance", "Contact"],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white/80" style={{ backgroundColor: "#0A0A0B", color: "rgba(255,255,255,0.8)" }}>
      <div className="container-wide">
        {/* Main row */}
        <motion.div
          className="pt-16 pb-12 flex flex-col md:flex-row gap-12"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand */}
          <div className="md:w-64 flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="3"  cy="7"  r="1.5" fill="white" />
                  <circle cx="7"  cy="3"  r="1.5" fill="white" />
                  <circle cx="11" cy="7"  r="1.5" fill="white" />
                  <circle cx="7"  cy="11" r="1.5" fill="white" />
                  <line x1="3" y1="7" x2="7" y2="3"   stroke="white" strokeWidth="1" strokeOpacity="0.7"/>
                  <line x1="7" y1="3" x2="11" y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.7"/>
                  <line x1="11" y1="7" x2="7" y2="11" stroke="white" strokeWidth="1" strokeOpacity="0.7"/>
                  <line x1="7" y1="11" x2="3" y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.7"/>
                </svg>
              </div>
              <span className="font-bold text-[15px] tracking-tight text-white">
                Vingoo
              </span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed mb-5 max-w-xs">
              Graph-based financial crime detection engine.
              Detecting money muling with precision and transparency.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-[11px] text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Backend API operational
            </div>
          </div>

          {/* Links */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {Object.entries(LINKS).map(([section, links]) => (
              <div key={section}>
                <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">
                  {section}
                </h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-white/50 hover:text-white/90 transition-colors duration-200">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.07] py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-white/25">
            &copy; {year} Vingoo. Financial Crime Intelligence Platform.
          </p>
          <p className="text-[12px] text-white/25">
            Built with FastAPI &nbsp;&middot;&nbsp; React &nbsp;&middot;&nbsp; NetworkX &nbsp;&middot;&nbsp; v1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
}
