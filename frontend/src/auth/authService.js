/**
 * auth/authService.js
 *
 * Stateless auth service — handles credential exchange, session refresh,
 * and logout with the backend's OAuth2-compatible /auth/* endpoints.
 *
 * All token side-effects go through tokenStore so the rest of the codebase
 * never touches credentials directly.
 *
 * Endpoints used
 * ──────────────
 *   POST /auth/token   — exchange username + password for a JWT
 *   POST /auth/refresh — exchange a valid JWT for a fresh one (extend session)
 *
 * The backend is expected to follow the OAuth2 Password flow:
 *   • Request:  application/x-www-form-urlencoded
 *               username=… & password=… & grant_type=password
 *   • Response: { access_token: string, token_type: "bearer" }
 */

import { API_BASE }             from '../api/client';
import { setToken, clearToken, getToken } from './tokenStore';

// ── Internal helper ───────────────────────────────────────────────────────────

function authError(message, status) {
  const err = new Error(message);
  err.status  = status;
  err.detail  = message;
  err.isAuth  = true;
  return err;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Exchange username + password for a JWT and store it in tokenStore.
 *
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ access_token: string, token_type: string }>}
 * @throws {Error & { status: number, detail: string }} on failure
 */
export async function login({ username, password }) {
  // OAuth2 Password flow → form-encoded body (not JSON)
  const body = new URLSearchParams();
  body.set('username', username);
  body.set('password', password);
  body.set('grant_type', 'password');

  const res = await fetch(`${API_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const detail  = payload?.detail ?? `Authentication failed (${res.status})`;
    throw authError(detail, res.status);
  }

  const data = await res.json();

  if (!data?.access_token) {
    throw authError('Server did not return an access token.', 500);
  }

  // Persist token in memory — never in storage
  setToken(data.access_token);

  return data;
}

/**
 * Discard the current session token and navigate to the landing page.
 * Safe to call even when no session is active.
 */
export function logout() {
  clearToken();
  // Hard redirect — clears all React state and SSE connections as a side-effect,
  // which is the correct security posture on logout.
  window.location.href = '/';
}

/**
 * Attempt to extend the current session by exchanging the active JWT for a
 * fresh one via POST /auth/refresh.
 *
 * Fails silently — if the server rejects the refresh (expired, revoked) the
 * token is cleared and the user falls back to public mode.  The caller should
 * react to the return value but is not required to.
 *
 * @returns {Promise<boolean>} true if the session was successfully refreshed
 */
export async function refreshSession() {
  const current = getToken();
  if (!current) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${current}`,
      },
    });

    if (!res.ok) {
      clearToken();
      return false;
    }

    const data = await res.json();
    if (data?.access_token) {
      setToken(data.access_token);
      return true;
    }

    clearToken();
    return false;
  } catch {
    // Network error — don't clear the token, the user may just be offline.
    // The token will be cleared by the 401 handler in api/client.js if the
    // next authenticated request is rejected.
    return false;
  }
}
