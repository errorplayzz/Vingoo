/**
 * routes/ProtectedRoute.jsx
 *
 * Soft route guard for the /admin investigator panel.
 *
 * Current implementation (Phase 14 — soft version)
 * ─────────────────────────────────────────────────
 * Guards access by checking whether `investigatorMode` is enabled in
 * AnalysisContext.  Users who haven't toggled investigator mode via the
 * Navbar button (or who land directly on /admin without a session) are
 * silently redirected to the landing page.
 *
 * This is NOT a JWT or session guard — any user who toggles investigator
 * mode in the Navbar can access /admin.  The purpose is structural: to
 * demonstrate route-level access control patterns that can be upgraded to
 * real authentication in a future phase.
 *
 * Future upgrade path (Phase 15+):
 * ─────────────────────────────────
 * Replace the `investigatorMode` check with a token validity check:
 *
 *   import { getToken } from '../auth/tokenStore';
 *
 *   const isAuth = !!getToken();      // replace investigatorMode check
 *   if (!isAuth) return <Navigate to="/auth/login" replace />;
 *
 * No other changes needed — the guard pattern stays identical.
 *
 * Usage:
 *   Wrap any route element in App.jsx:
 *
 *   <Route
 *     path="/admin"
 *     element={
 *       <ProtectedRoute>
 *         <AdminPage />
 *       </ProtectedRoute>
 *     }
 *   />
 */

import { Navigate } from 'react-router-dom';
import { useAnalysisState } from '../context/AnalysisContext';

/**
 * @param {{ children: React.ReactNode }} props
 */
export default function ProtectedRoute({ children }) {
  const { investigatorMode } = useAnalysisState();

  if (!investigatorMode) {
    // Redirect to landing page, replacing history entry so back-button
    // doesn't loop the user back into an unauthorised route.
    return <Navigate to="/" replace />;
  }

  return children;
}
