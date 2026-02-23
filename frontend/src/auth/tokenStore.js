/**
 * auth/tokenStore.js
 *
 * Zero-Trust in-memory token store.
 *
 * Security contract
 * ─────────────────
 * • Token lives ONLY in this module's private closure variable.
 * • NEVER written to localStorage, sessionStorage, or any Cookie.
 * • Token is automatically lost on page reload — intentional security
 *   behaviour: unauthenticated state is the safe default.
 * • XSS scripts that enumerate window, document.cookie, or storage APIs
 *   cannot extract the token — it is not accessible from outside this module.
 *
 * Usage
 * ─────
 *   import { setToken, getToken, clearToken, isAuthenticated } from './tokenStore';
 *
 *   setToken(jwt)          // after successful login
 *   getToken()             // called by api/client.js before each request
 *   clearToken()           // on logout or 401 response
 *   isAuthenticated()      // true iff a token is currently held
 */

// ── Private closure — inaccessible from outside this module ──────────────────
let _token = null;

/**
 * Store the JWT in memory.
 * @param {string} token
 */
export function setToken(token) {
  _token = token ?? null;
}

/**
 * Retrieve the current JWT from memory, or null if none.
 * @returns {string | null}
 */
export function getToken() {
  return _token;
}

/**
 * Discard the current JWT.
 * Safe to call even when no token is held.
 */
export function clearToken() {
  _token = null;
}

/**
 * Convenience predicate — true iff a token is currently held.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return _token !== null;
}
