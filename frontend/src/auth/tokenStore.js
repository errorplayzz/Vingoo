/**
 * auth/tokenStore.js — Firebase ID token store
 *
 * Firebase ID tokens are short-lived (~1 hr) and auto-refreshed by the SDK.
 * We cache the most-recent token string so api/client.js can attach it
 * to every request without an extra async wait on every call.
 *
 * Security contract (unchanged from original):
 *   • Token lives in this module's private closure only.
 *   • Never written to localStorage, sessionStorage, or cookies.
 *   • The Firebase SDK handles internal persistence (IndexedDB).
 */
import { auth } from '../lib/firebase';

let _token = null;

/** Store a fresh ID token string. */
export function setToken(token) { _token = token ?? null; }

/** Return cached token (may be slightly stale — fine for display/UI checks). */
export function getToken() { return _token; }

/** Clear the cached token (on logout). */
export function clearToken() { _token = null; }

/** True iff a token is currently cached. */
export function isAuthenticated() { return _token !== null; }

/**
 * Get a *fresh* Firebase ID token, force-refreshing if close to expiry.
 * Use this before every API call to ensure the token is never expired.
 * @returns {Promise<string|null>}
 */
export async function refreshToken() {
  const user = auth.currentUser;
  if (!user) { _token = null; return null; }
  _token = await user.getIdToken(false);
  return _token;
}
