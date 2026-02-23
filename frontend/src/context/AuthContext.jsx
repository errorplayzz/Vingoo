/**
 * context/AuthContext.jsx
 *
 * Zero-Trust authentication context for the VINGOO frontend.
 *
 * Architecture
 * ────────────
 * Follows the same split-context pattern as AnalysisContext:
 *
 *   useAuthState()    – { user, isAuthenticated }
 *                       Re-renders when auth state changes (login / logout).
 *   useAuthActions()  – { login, logout }
 *                       Stable callbacks; never triggers extra re-renders.
 *   useAuth()         – merged sugar; backward-compatible.
 *
 * Security properties
 * ───────────────────
 * • Token is held 100% in memory (tokenStore.js — never in storage APIs).
 * • isAuthenticated is derived from token presence — not from a mutable flag
 *   that can be toggled externally (closes the "soft toggle" vulnerability
 *   present in the Phase 14 investigatorMode boolean).
 * • Session guard on mount: if a token somehow exists in memory when the
 *   provider mounts (e.g. hot reload in dev), the auth state is restored.
 *   On a real page reload the token is gone (memory cleared) — safe default.
 * • Logout performs a hard redirect, clearing all React state, SSE
 *   connections, and React Query caches as a side-effect.
 *
 * Provider order (App.jsx)
 * ────────────────────────
 *   <AuthProvider>          ← outermost
 *     <ToastProvider>
 *       <AnalysisProvider>  ← can call useAuthState() because it's a child
 *         …
 *       </AnalysisProvider>
 *     </ToastProvider>
 *   </AuthProvider>
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { login as serviceLogin, logout as serviceLogout } from '../auth/authService';
import { isAuthenticated as tokenExists, getToken }       from '../auth/tokenStore';

// ── JWT payload decoder (client-side, no verification) ───────────────────────
// Used only for display (username, role).  Trust decisions are made
// server-side — this is purely for UI personalisation.
function decodePayload(token) {
  try {
    const payload = token.split('.')[1];
    const padded   = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function buildUser(token) {
  if (!token) return null;
  const payload = decodePayload(token);
  return {
    username: payload?.sub   ?? 'Investigator',
    role:     payload?.role  ?? 'admin',
    exp:      payload?.exp   ?? null,
  };
}

// ── Contexts ──────────────────────────────────────────────────────────────────
const _AuthStateContext   = createContext(null);
const _AuthActionsContext = createContext(null);

// ── Consumer hooks ────────────────────────────────────────────────────────────

/** Subscribe to auth state only — { user, isAuthenticated } */
export function useAuthState() {
  const ctx = useContext(_AuthStateContext);
  if (!ctx) throw new Error('useAuthState must be used inside AuthProvider');
  return ctx;
}

/** Subscribe to stable auth actions — { login, logout } */
export function useAuthActions() {
  const ctx = useContext(_AuthActionsContext);
  if (!ctx) throw new Error('useAuthActions must be used inside AuthProvider');
  return ctx;
}

/** Merged hook — convenience for components that need both */
export function useAuth() {
  return { ...useAuthState(), ...useAuthActions() };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // Initialise from memory — handles dev hot-reload where token might exist.
  // On a real page reload this will always be null (memory cleared).
  const [user,  setUser]  = useState(() => buildUser(getToken()));

  // isAuthenticated is purely derived from user state — no separate flag.
  const isAuthenticated = user !== null;

  // ── Session guard (startup) ───────────────────────────────────────────────
  // If tokenStore has a token (dev hot-reload or in-tab navigation), parse
  // and restore the user object so the UI doesn't flash to public mode.
  useEffect(() => {
    if (tokenExists() && user === null) {
      setUser(buildUser(getToken()));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Authenticate with username + password.
   * Calls /auth/token, stores JWT in memory, updates user state.
   *
   * @param {{ username: string, password: string }} credentials
   * @returns {Promise<void>}
   * @throws on authentication failure (propagate to LoginPage for display)
   */
  const login = useCallback(async (credentials) => {
    const data = await serviceLogin(credentials);
    // serviceLogin already called setToken — just sync React state
    setUser(buildUser(data.access_token));
  }, []);

  /**
   * Clear session and hard-redirect to landing page.
   * serviceLogout() calls clearToken() + window.location.href = '/'
   */
  const logout = useCallback(() => {
    setUser(null);
    serviceLogout();
  }, []);

  // ── Stable memoised context values ───────────────────────────────────────
  const actionsValue = useMemo(
    () => ({ login, logout }),
    [login, logout],
  );

  const stateValue = useMemo(
    () => ({ user, isAuthenticated }),
    [user, isAuthenticated],
  );

  return (
    <_AuthActionsContext.Provider value={actionsValue}>
      <_AuthStateContext.Provider value={stateValue}>
        {children}
      </_AuthStateContext.Provider>
    </_AuthActionsContext.Provider>
  );
}
