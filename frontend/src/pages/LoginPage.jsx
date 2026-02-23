/**
 * pages/LoginPage.jsx
 *
 * Route: /login
 *
 * Minimal investigator sign-in form.
 *
 * UX contract
 * ───────────
 * • No modal — full route, so back-button works naturally.
 * • No UI blocking — loading state is inline within the button.
 * • Error messages are inline below the form.
 * • Navigates to /admin on success (the investigator console).
 * • Already-authenticated users are redirected away immediately.
 * • Matches the existing design system (accent, font-sans, container-wide).
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link }                 from 'react-router-dom';
import { motion }                            from 'framer-motion';
import { useAuth }                           from '../context/AuthContext';

const EASE = [0.22, 1, 0.36, 1];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // Already signed in — go straight to the console
  useEffect(() => {
    if (isAuthenticated) navigate('/admin', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      await login({ username: username.trim(), password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.detail ?? err.message ?? 'Sign-in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }, [username, password, login, navigate]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans flex flex-col">

      {/* Minimal top bar */}
      <header className="h-16 flex items-center px-6 border-b border-black/[0.05] bg-white">
        <Link to="/" className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-[0_2px_10px_rgba(29,78,216,0.4)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="3"  cy="7"  r="1.5" fill="white" />
              <circle cx="7"  cy="3"  r="1.5" fill="white" />
              <circle cx="11" cy="7"  r="1.5" fill="white" />
              <circle cx="7"  cy="11" r="1.5" fill="white" />
              <line x1="3"  y1="7"  x2="7"  y2="3"  stroke="white" strokeWidth="1" strokeOpacity="0.7" />
              <line x1="7"  y1="3"  x2="11" y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.7" />
              <line x1="11" y1="7"  x2="7"  y2="11" stroke="white" strokeWidth="1" strokeOpacity="0.7" />
              <line x1="7"  y1="11" x2="3"  y2="7"  stroke="white" strokeWidth="1" strokeOpacity="0.7" />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-ink">Vingoo</span>
        </Link>
      </header>

      {/* Form card */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">
                Secure Access
              </span>
            </div>
            <h1 className="text-[1.75rem] font-black text-ink tracking-tight leading-tight">
              Investigator Sign In
            </h1>
            <p className="text-muted text-[0.875rem] mt-2 leading-relaxed">
              Access the intelligence console. Credentials are verified against the
              backend — sessions are in-memory only.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-[12px] font-semibold text-ink mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="admin"
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.12] bg-white text-[14px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-[12px] font-semibold text-ink mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.12] bg-white text-[14px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition disabled:opacity-50"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || !username.trim() || !password}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={  { scale: loading ? 1 : 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="mt-6 w-full h-11 rounded-xl bg-accent text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(29,78,216,0.40)] hover:shadow-[0_4px_20px_rgba(29,78,216,0.55)] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                  Verifying…
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-[12px] text-faint">
            Sessions are in-memory only — credentials are never stored locally.
          </p>
          <div className="mt-4 text-center">
            <Link
              to="/"
              className="text-[12px] text-accent hover:underline font-medium"
            >
              ← Return to landing page
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
