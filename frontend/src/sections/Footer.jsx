export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="container-wide py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-blue-600">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
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
          <span className="text-[12px] font-semibold text-muted">
            Vingoo &nbsp;&middot;&nbsp; &copy; {year} Financial Crime Intelligence
          </span>
        </div>
        <p className="text-[11px] font-mono text-faint">
          FastAPI &nbsp;&middot;&nbsp; React &nbsp;&middot;&nbsp; NetworkX &nbsp;&middot;&nbsp; D3 &nbsp;&middot;&nbsp; v1.0.0-research
        </p>
      </div>
    </footer>
  );
}
