import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }   from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useAnalysisState, useAnalysisActions } from '../context/AnalysisContext';
import { useDemoMode } from '../demo/DemoModeProvider';

const links = [
  { label: "How It Works",  href: "#solution" },
  { label: "Upload",        href: "#upload" },
  { label: "Capabilities",  href: "#capabilities" },
];

export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { status: analysisStatus } = useAnalysisState();
  const { reset } = useAnalysisActions();
  const { isDemoMode } = useDemoMode();
  const navigate = useNavigate();

  const hasResults = analysisStatus === 'done';

  const handleTryAnother = useCallback(() => {
    reset();
    // If not on home page, navigate there first then scroll
    navigate('/');
    setTimeout(() => {
      const el = document.getElementById('upload');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [reset, navigate]);

  // ── Live clock ──────────────────────────────────────────────────────────
  const [clock, setClock] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' }) + ' UTC';
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setClock(d.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' }) + ' UTC');
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── System status derived from analysis state ────────────────────────────
  const sysStatus = analysisStatus === 'uploading' || analysisStatus === 'analyzing'
    ? 'ANALYZING'
    : analysisStatus === 'error'
    ? 'ALERT'
    : 'ONLINE';

  const statusStyle = sysStatus === 'ANALYZING'
    ? 'border-amber-400/40 text-amber-400 bg-amber-400/[0.07]'
    : sysStatus === 'ALERT'
    ? 'border-red-500/40 text-red-400 bg-red-500/[0.07]'
    : 'border-green-400/35 text-green-400 bg-green-400/[0.06]';

  const statusDot = sysStatus === 'ANALYZING'
    ? 'bg-amber-400 animate-pulse'
    : sysStatus === 'ALERT'
    ? 'bg-red-500 animate-pulse'
    : 'bg-green-400';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-300 ${
          scrolled ? "border-b border-slate-200 shadow-[0_1px_12px_rgba(0,0,0,0.06)]" : "border-b border-slate-100"
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="container-wide flex items-center justify-between h-16">
          {/* Brand */}
          <a href="#" className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-[0_2px_10px_rgba(29,78,216,0.4)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="3" cy="7" r="1.5" fill="white" />
                <circle cx="7" cy="3" r="1.5" fill="white" />
                <circle cx="11" cy="7" r="1.5" fill="white" />
                <circle cx="7" cy="11" r="1.5" fill="white" />
                <line x1="3" y1="7" x2="7" y2="3"  stroke="white" strokeWidth="1" strokeOpacity="0.7" />
                <line x1="7" y1="3" x2="11" y2="7" stroke="white" strokeWidth="1" strokeOpacity="0.7" />
                <line x1="11" y1="7" x2="7" y2="11" stroke="white" strokeWidth="1" strokeOpacity="0.7" />
                <line x1="7" y1="11" x2="3" y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.7" />
              </svg>
            </div>
            <span className={`text-[15px] font-bold tracking-tight transition-colors duration-500 ${scrolled ? "text-white" : "text-white"}`}>
              Vingoo
            </span>
          </a>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[13px] font-medium text-muted hover:text-ink transition-colors duration-200"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA + auth badges */}
          <div className="hidden md:flex items-center gap-3">
            {/* ── Command-center status cluster ─────────────────────── */}
            <div className="flex items-center gap-2">
              {/* System status pill */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9.5px] font-mono font-semibold uppercase tracking-widest ${statusStyle}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
                {sysStatus}
              </div>
              {/* Live clock */}
              <span
                className="text-[9.5px] font-mono tabular-nums tracking-wider select-none text-muted"
              >
                {clock}
              </span>
            </div>

            {/* visual separator */}
            <div className="w-px h-4 bg-slate-200" />
            <StatusBadge />

            {isDemoMode && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[9.5px] font-bold uppercase tracking-[0.12em]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Demo Mode
              </span>
            )}

            {/* ── Auth section ─────────────────────────────────────── */}
            {isAuthenticated ? (
              /* Authenticated: show username chip + sign-out */
              <div className="flex items-center gap-2">
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-300 bg-white/[0.10] text-white/80 border-white/[0.15] hover:bg-white/[0.16]`}
                  title="Open investigator console"
                >
                  <span className="text-[8px] font-mono opacity-55 tracking-widest mr-0.5">ANALYST</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  {user?.username ?? 'Investigator'}
                </Link>
                <button
                  onClick={logout}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 bg-white text-muted border-slate-200 hover:border-red-300 hover:text-red-600"
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              /* Public: subtle sign-in link */
              <Link
                to="/login"
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 bg-white text-muted border-slate-200 hover:border-accent/40 hover:text-ink"
                title="Sign in to investigator console"
              >
                Sign In
              </Link>
            )}

            <motion.button
              onClick={hasResults ? handleTryAnother : () => { navigate('/'); setTimeout(() => { const el = document.getElementById('upload'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }}
              className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-accent text-white flex items-center gap-1.5"
              style={{ boxShadow: "0 2px 12px rgba(29,78,216,0.40)" }}
              whileHover={{ scale: 1.03, boxShadow: "0 4px 20px rgba(29,78,216,0.55)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
            >
              {hasResults ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Try Another File
                </>
              ) : 'Try Detection'}
            </motion.button>
          </div>

          {/* ── Data-stream scan line ─────────────────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-y-0 w-56 bg-gradient-to-r from-transparent via-accent/50 to-transparent"
              animate={{ left: ['-15%', '115%'] }}
              transition={{ duration: 5, ease: 'linear', repeat: Infinity, repeatDelay: 3 }}
            />
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-md hover:bg-black/5"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {["w-5","w-4","w-5"].map((w, i) => (
              <span key={i} className={`block h-[1.5px] transition-all duration-300 bg-ink/70 ${
                i === 0 && menuOpen ? "w-5 rotate-45 translate-y-[5px]" :
                i === 1 && menuOpen ? "opacity-0 w-0" :
                i === 2 && menuOpen ? "w-5 -rotate-45 -translate-y-[5px]" : w
              }`} />
            ))}
          </button>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-white pt-16 flex flex-col px-6 pb-8 shadow-2xl"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <nav className="flex flex-col gap-2 mt-6">
              {links.map((l, i) => (
                <motion.a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl font-semibold text-ink py-3 border-b border-slate-100"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <button
              onClick={() => { setMenuOpen(false); hasResults ? handleTryAnother() : (navigate('/'), setTimeout(() => { const el = document.getElementById('upload'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 80)); }}
              className="mt-auto text-center text-[15px] font-semibold px-5 py-3.5 rounded-xl bg-accent text-white"
            >
              {hasResults ? 'Try Another File' : 'Try Detection'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
