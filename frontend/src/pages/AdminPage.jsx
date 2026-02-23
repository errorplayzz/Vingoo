/**
 * pages/AdminPage.jsx
 *
 * Route: /admin  (guarded by ProtectedRoute)
 *
 * Forces investigator mode on mount so InvestigatorDashboard's internal
 * `if (!investigatorMode) return null;` guard doesn't block rendering when
 * the user navigates directly to /admin via URL.
 *
 * The Navbar toggle still works correctly — the user can turn off
 * investigator mode via the Navbar, which will cause ProtectedRoute to
 * redirect back to / on the next render.
 */
import { useEffect, lazy, Suspense } from 'react';
import { useAnalysisActions }        from '../context/AnalysisContext';
import Navbar                        from '../components/Navbar';
import Footer                        from '../sections/Footer';

// Keep this a lazy chunk so it's not bundled into the landing page main chunk.
const InvestigatorDashboard = lazy(() => import('../sections/InvestigatorDashboard'));

export default function AdminPage() {
  const { setInvestigatorMode } = useAnalysisActions();

  // Ensure investigator mode is active for direct URL navigation.
  // The Navbar toggle writes to the same value — no conflict.
  useEffect(() => {
    setInvestigatorMode(true);
  }, [setInvestigatorMode]);

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
