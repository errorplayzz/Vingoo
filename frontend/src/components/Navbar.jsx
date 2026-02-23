import { useState, useEffect } from 'react';
import { Link }                from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';

const links = [
  { label: "How It Works", href: "#how" },
  { label: "Upload",       href: "#upload" },
  { label: "Detection",    href: "#graph" },
  { label: "Intelligence", href: "#export" },
  { label: "Protect",      href: "#protect" },
];

export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-white/92 backdrop-blur-xl border-b border-black/[0.06] shadow-[0_1px_16px_rgba(0,0,0,0.06)]"
            : "bg-transparent border-b border-transparent"
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
            <span className={`text-[15px] font-bold tracking-tight transition-colors duration-500 ${scrolled ? "text-ink" : "text-white"}`}>
              Vingoo
            </span>
          </a>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className={`text-[13px] font-medium transition-colors duration-300 ${
                  scrolled
                    ? "text-muted hover:text-ink"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA + auth badges */}
          <div className="hidden md:flex items-center gap-3">
            <StatusBadge />

            {/* ── Auth section ─────────────────────────────────────── */}
            {isAuthenticated ? (
              /* Authenticated: show username chip + sign-out */
              <div className="flex items-center gap-2">
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                    scrolled
                      ? "bg-accent/[0.07] text-accent border-accent/20 hover:bg-accent/[0.12]"
                      : "bg-white/[0.10] text-white/80 border-white/[0.15] hover:bg-white/[0.16]"
                  }`}
                  title="Open investigator console"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  {user?.username ?? 'Investigator'}
                </Link>
                <button
                  onClick={logout}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                    scrolled
                      ? "bg-white text-muted border-black/[0.10] hover:border-red-300 hover:text-red-600"
                      : "bg-white/[0.07] text-white/60 border-white/[0.12] hover:bg-white/[0.12] hover:text-white/90"
                  }`}
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              /* Public: subtle sign-in link */
              <Link
                to="/login"
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                  scrolled
                    ? "bg-white text-muted border-black/[0.10] hover:border-accent/40 hover:text-ink"
                    : "bg-white/[0.07] text-white/60 border-white/[0.12] hover:bg-white/[0.12] hover:text-white/90"
                }`}
                title="Sign in to investigator console"
              >
                Sign In
              </Link>
            )}

            <motion.a
              href="#upload"
              className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-accent text-white"
              style={{ boxShadow: "0 2px 12px rgba(29,78,216,0.40)" }}
              whileHover={{ scale: 1.03, boxShadow: "0 4px 20px rgba(29,78,216,0.55)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
            >
              Try Detection
            </motion.a>
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-md hover:bg-black/5"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {["w-5","w-4","w-5"].map((w, i) => (
              <span key={i} className={`block h-[1.5px] transition-all duration-300 ${scrolled ? "bg-ink" : "bg-white/80"} ${
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
            className="fixed inset-0 z-40 bg-white pt-16 flex flex-col px-6 pb-8"
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
                  className="text-2xl font-semibold text-ink py-3 border-b border-black/[0.06]"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <a
              href="#graph"
              onClick={() => setMenuOpen(false)}
              className="mt-auto text-center text-[15px] font-semibold px-5 py-3.5 rounded-xl bg-accent text-white"
            >
              Try Detection
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
