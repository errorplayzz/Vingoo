/**
 * pages/SignupPage.jsx — Firebase email/password signup + email verification
 * Steps: form → verify
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link }            from 'react-router-dom';
import { motion, AnimatePresence }      from 'framer-motion';
import {
  signupWithEmail, loginWithGoogle,
  sendVerificationEmail, reloadUser,
} from '../auth/authService';
import { useAuth } from '../context/AuthContext';

const cls = (...c) => c.filter(Boolean).join(' ');

const Label = ({ children }) => (
  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-1.5">
    {children}
  </label>
);

const Input = ({ label, error, ...props }) => (
  <div>
    {label && <Label>{label}</Label>}
    <input
      {...props}
      className={cls(
        'w-full rounded-xl border bg-slate-50/60 px-4 py-3 text-sm text-slate-800',
        'placeholder-slate-400 outline-none transition-all duration-150',
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-red-50/30'
          : 'border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white',
      )}
    />
    {error && (
      <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0a6 6 0 100 12A6 6 0 006 0zm-.75 3.75h1.5v3.75h-1.5V3.75zm0 4.5h1.5v1.5h-1.5v-1.5z"/></svg>
        {error}
      </p>
    )}
  </div>
);

const PrimaryBtn = ({ children, loading, ...props }) => (
  <button
    {...props}
    disabled={loading || props.disabled}
    className={cls(
      'relative w-full rounded-xl py-3 text-sm font-semibold text-white',
      'bg-gradient-to-r from-indigo-600 to-violet-600',
      'hover:from-indigo-500 hover:to-violet-500',
      'shadow-lg shadow-indigo-200 hover:shadow-indigo-300',
      'transition-all duration-150 active:scale-[0.98]',
      'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2',
      'disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none',
    )}
  >
    {loading ? (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Please wait…
      </span>
    ) : children}
  </button>
);

const OutlineBtn = ({ children, loading, ...props }) => (
  <button
    {...props}
    disabled={loading || props.disabled}
    className={cls(
      'flex items-center justify-center gap-2.5 w-full rounded-xl py-3',
      'border border-slate-200 bg-white text-slate-700 text-sm font-medium',
      'hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow',
      'transition-all duration-150 active:scale-[0.98]',
      'focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60',
    )}
  >
    {loading ? (
      <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
    ) : children}
  </button>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.2 0 24 0 14.8 0 6.9 5.4 3 13.3l7.8 6C12.8 13.1 17.9 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2 5.3-4.4 6.9l6.8 5.3C43.4 36.7 46.5 31 46.5 24.5z"/>
    <path fill="#FBBC05" d="M10.8 28.3A14.5 14.5 0 0 1 9.5 24c0-1.5.3-2.9.7-4.3l-7.8-6A23.8 23.8 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.3-6.5z"/>
    <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-6.8-5.3C30.4 39 27.4 40 24 40c-6.1 0-11.3-3.7-13.2-9l-8.3 6.5C6.3 43 14.6 48 24 48z"/>
  </svg>
);

const Panel = ({ children, id }) => (
  <motion.div key={id}
    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    className="flex flex-col gap-6 w-full"
  >
    {children}
  </motion.div>
);

const StepHeader = ({ back, badge, title, subtitle }) => (
  <div className="flex flex-col gap-1">
    {back && (
      <button onClick={back} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition mb-2 w-fit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>
    )}
    {badge && (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 w-fit mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        {badge}
      </span>
    )}
    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
    {subtitle && <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
  </div>
);

const ErrBox = ({ msg }) => msg ? (
  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0a6 6 0 100 12A6 6 0 006 0zm-.75 3.75h1.5v3.75h-1.5V3.75zm0 4.5h1.5v1.5h-1.5v-1.5z"/></svg>
    {msg}
  </div>
) : null;

/* ── Left brand panel ───────────────────────────────────────────────────────── */
const BrandPanel = () => (
  <div className="hidden lg:flex flex-col justify-between h-full p-12 relative overflow-hidden"
    style={{ background: 'linear-gradient(145deg, #f5f3ff 0%, #ede9fe 40%, #e0e7ff 100%)' }}
  >
    <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-indigo-200/30 blur-3xl" />
    <div className="absolute bottom-0 -left-16 w-64 h-64 rounded-full bg-violet-200/40 blur-3xl" />

    <div className="relative z-10 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-300">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-xl font-black tracking-tight text-slate-900">VINGOO</span>
    </div>

    <div className="relative z-10 flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 leading-tight mb-3">
          Detect Fraud.<br />Stop Crime. Fast.
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Join investigators who use AI-powered graph analysis to surface financial crime in seconds.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { stat: '< 30s', label: 'Full analysis' },
          { stat: '99.2%', label: 'Detection rate' },
          { stat: '6 types', label: 'Fraud patterns' },
          { stat: 'Free', label: 'To get started' },
        ].map(({ stat, label }) => (
          <div key={stat} className="bg-white/60 border border-white rounded-xl p-3.5 flex flex-col gap-0.5">
            <span className="text-lg font-black text-indigo-700">{stat}</span>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Secured with Firebase Authentication
    </div>
  </div>
);

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function SignupPage() {
  const navigate                    = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const [step,      setStep]      = useState('form');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [showCf,    setShowCf]    = useState(false);
  const [err,       setErr]       = useState('');
  const [resent,    setResent]    = useState(false);
  const [busy,      setBusy]      = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/admin', { replace: true });
  }, [isAuthenticated, navigate]);

  // Poll every 3s once on verify step
  useEffect(() => {
    if (step === 'verify') {
      pollRef.current = setInterval(async () => {
        try {
          const user = await reloadUser();
          if (user?.emailVerified) {
            clearInterval(pollRef.current);
            navigate('/admin', { replace: true });
          }
        } catch (_) {}
      }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [step, navigate]);

  const handleSignup = async (e) => {
    e.preventDefault(); setErr('');
    if (password !== confirm) return setErr('Passwords do not match.');
    if (password.length < 8)  return setErr('Password must be at least 8 characters.');
    setBusy(true);
    try {
      await signupWithEmail(email, password);
      await sendVerificationEmail();
      setStep('verify');
    } catch (e) { setErr(e.message || 'Signup failed. Try again.'); }
    finally { setBusy(false); }
  };

  const handleGoogle = async () => {
    setErr(''); setBusy(true);
    try {
      await loginWithGoogle();
      navigate('/admin', { replace: true });
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') setErr(e.message || 'Google sign-in failed.');
    } finally { setBusy(false); }
  };

  const handleResend = async () => {
    setResent(false); setErr('');
    try {
      await sendVerificationEmail();
      setResent(true);
    } catch (e) { setErr(e.message || 'Failed to resend email.'); }
  };

  const pwMeter = (() => {
    const l = password.length;
    if (l === 0) return null;
    if (l < 6)  return { w: '33%', c: 'bg-red-400',    label: 'Weak' };
    if (l < 10) return { w: '66%', c: 'bg-amber-400',  label: 'Fair' };
    return              { w: '100%', c: 'bg-emerald-500', label: 'Strong' };
  })();

  return (
    <div className="min-h-screen bg-white flex">
      <div className="w-[480px] flex-shrink-0 min-h-screen"><BrandPanel /></div>

      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900">VINGOO</span>
          </div>

          <AnimatePresence mode="wait">

            {/* ── SIGNUP FORM ── */}
            {step === 'form' && (
              <Panel id="form">
                <StepHeader badge="Create Account" title="Get started free"
                  subtitle="Set up your Vingoo investigator account in seconds." />
                <OutlineBtn onClick={handleGoogle} loading={busy}>
                  <GoogleIcon />Continue with Google
                </OutlineBtn>
                <div className="flex items-center gap-3 text-xs text-slate-400 select-none">
                  <span className="flex-1 h-px bg-slate-200" />or<span className="flex-1 h-px bg-slate-200" />
                </div>
                <form onSubmit={handleSignup} className="flex flex-col gap-4">
                  <Input label="Email address" type="email" placeholder="you@company.com"
                    value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />

                  <div>
                    <Label>Password</Label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} placeholder="Min 8 characters"
                        value={password} onChange={e => setPassword(e.target.value)}
                        required autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white"
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                        {showPw
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                    {pwMeter && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${pwMeter.c}`} style={{ width: pwMeter.w }} />
                        </div>
                        <span className="text-[10px] text-slate-400">{pwMeter.label}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Confirm password</Label>
                    <div className="relative">
                      <input
                        type={showCf ? 'text' : 'password'} placeholder="Repeat password"
                        value={confirm} onChange={e => setConfirm(e.target.value)}
                        required autoComplete="new-password"
                        className={cls(
                          'w-full rounded-xl border bg-slate-50/60 px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all',
                          confirm && confirm !== password
                            ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-red-50/30'
                            : 'border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white',
                        )}
                      />
                      <button type="button" onClick={() => setShowCf(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                        {showCf
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="mt-1 text-[11px] text-red-500">Passwords don't match</p>
                    )}
                  </div>

                  <ErrBox msg={err} />
                  <PrimaryBtn type="submit" loading={busy}>Create account</PrimaryBtn>
                </form>
                <p className="text-center text-xs text-slate-400">
                  Already have an account?{' '}
                  <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition">Sign in →</Link>
                </p>
              </Panel>
            )}

            {/* ── VERIFY EMAIL ── */}
            {step === 'verify' && (
              <Panel id="verify">
                <StepHeader badge="Email Verification" title="Check your inbox"
                  subtitle={`We sent a verification link to ${email}. Click it to activate your account.`} />

                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />
                    Waiting for verification…
                  </div>
                </div>

                <ErrBox msg={err} />

                {resent && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Verification email resent!
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <OutlineBtn onClick={handleResend}>Resend verification email</OutlineBtn>
                  <button onClick={async () => { await logout(); setStep('form'); }}
                    className="text-xs text-slate-400 hover:text-indigo-600 transition text-center">
                    Use a different account
                  </button>
                </div>

                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  Can't find it? Check your spam folder.<br />
                  The link expires in 24 hours.
                </p>
              </Panel>
            )}

          </AnimatePresence>

          <p className="mt-10 text-center text-[11px] text-slate-300">
            © {new Date().getFullYear()} Vingoo · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
