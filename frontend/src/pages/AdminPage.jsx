/**
 * pages/AdminPage.jsx
 *
 * Route: /admin  (guarded by ProtectedRoute → requires JWT authentication)
 *
 * Phase 15 security upgrade
 * ─────────────────────────
 * investigatorMode is now derived from isAuthenticated (AuthContext) rather
 * than a manual boolean toggle.  ProtectedRoute guarantees that only
 * authenticated users can reach this component, so InvestigatorDashboard's
 * internal guard (if !investigatorMode return null) is always satisfied here.
 *
 * The old useEffect(() => { setInvestigatorMode(true) }) is removed because:
 *  • setInvestigatorMode no longer exists in AnalysisContext actions
 *  • investigatorMode = isAuthenticated, which is already true by the time
 *    ProtectedRoute allows rendering of this component
 */
import { lazy, Suspense } from 'react';
import Navbar             from '../components/Navbar';
import Footer             from '../sections/Footer';

// Keep this a lazy chunk so it's not bundled into the landing page main chunk.
const InvestigatorDashboard = lazy(() => import('../sections/InvestigatorDashboard'));

export default function AdminPage() {
  return (
    <div className="bg-white font-sans min-h-screen">
      <Navbar />
      <main>
        <Suspense fallback={null}>
          <InvestigatorDashboard />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
