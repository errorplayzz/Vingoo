import { lazy, Suspense, memo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }       from './context/AuthContext';
import { AnalysisProvider }     from './context/AnalysisContext';
import { ToastProvider }        from './context/ToastContext';
import { useSseInvalidation }   from './hooks/useSseInvalidation';
import ScrollToTop              from './components/ScrollToTop';
import ProtectedRoute           from './routes/ProtectedRoute';
import { InvestigationProvider } from './context/InvestigationContext';
import Navbar              from './components/Navbar';
import Hero                from './sections/Hero';
import UploadAnalysis      from './sections/UploadAnalysis';
import Footer              from './sections/Footer';
import SystemAmbientLayer  from './ui/SystemAmbientLayer';
import { DemoModeProvider } from './demo/DemoModeProvider';
import SystemNarration     from './demo/SystemNarration';
import FocusHighlight      from './demo/FocusHighlight';

// ── Lazy-loaded sections ─────────────────────────────────────────────────────
const ProblemSection       = lazy(() => import('./sections/ProblemSection'));
const SolutionSection      = lazy(() => import('./sections/SolutionSection'));
const GraphViz             = lazy(() => import('./sections/GraphViz'));
const SystemCapabilities   = lazy(() => import('./sections/SystemCapabilities'));
const FinalCTA             = lazy(() => import('./sections/FinalCTA'));

// ── Route-level page chunks ──────────────────────────────────────────────────
const InvestigationPage    = lazy(() => import('./pages/InvestigationPage'));
const AdminPage            = lazy(() => import('./pages/AdminPage'));
const LoginPage            = lazy(() => import('./pages/LoginPage'));
const SignupPage           = lazy(() => import('./pages/SignupPage'));
// Shared fallback — a thin shimmer bar that matches the section's min-height
const SectionFallback = memo(() => (
  <div className="w-full py-20 flex items-center justify-center" aria-hidden>
    <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
  </div>
));

// ── Landing page (clean white scroll) ──────────────────────────────────────
function ScrollHome() {
  return (
    <div className="bg-white font-sans">
      <Navbar />
      <main>
        {/* Above the fold */}
        <Hero />

        {/* Problem → Solution narrative */}
        <Suspense fallback={<SectionFallback />}>
          <ProblemSection />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <SolutionSection />
        </Suspense>

        {/* Upload interaction */}
        <UploadAnalysis />

        {/* Graph product section */}
        <Suspense fallback={<SectionFallback />}>
          <GraphViz />
        </Suspense>

        {/* System capabilities */}
        <Suspense fallback={<SectionFallback />}>
          <SystemCapabilities />
        </Suspense>

        {/* Final CTA */}
        <Suspense fallback={<SectionFallback />}>
          <FinalCTA />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

// ── Root app ─────────────────────────────────────────────────────────────────
function App() {
  // Opens /stream/analysis and invalidates ["admin","analyses"] on
  // analysis_complete events.  No re-renders; purely a cache side-effect.
  // Placed here (outside ScrollHome) so SSE is active on every route.
  useSseInvalidation();

  return (
    <AuthProvider>
      <ToastProvider>
        {/* Global ambient layer — renders behind all content, no interaction cost */}
        <SystemAmbientLayer />
        <InvestigationProvider>
          <AnalysisProvider>
            <DemoModeProvider>
              {/* Scroll to top whenever the route pathname changes */}
              <ScrollToTop />
              {/* Demo Mode: guided narration + focus highlights (no-op when demo=false) */}
              <SystemNarration />
              <FocusHighlight />

        <Routes>
          {/* ── Landing page ──────────────────────────────────────── */}
          <Route path="/" element={<ScrollHome />} />

          {/* ── Investigation workspace ──────────────────────────── */}
          {/* Permanent URL for a single analysis result.            */}
          {/* Reloads fetch data from GET /admin/analysis/:id.       */}
          <Route
            path="/investigation/:analysisId"
            element={
              <Suspense fallback={<SectionFallback />}>
                <InvestigationPage />
              </Suspense>
            }
          />

          {/* ── Investigator sign-in ─────────────────────────────── */}
          {/* Public route — already-authenticated users redirected   */}
          {/* to /admin by LoginPage's useEffect.                     */}
          <Route
            path="/login"
            element={
              <Suspense fallback={null}>
                <LoginPage />
              </Suspense>
            }
          />

          {/* ── Sign-up ───────────────────────────────────────────── */}
          <Route
            path="/signup"
            element={
              <Suspense fallback={null}>
                <SignupPage />
              </Suspense>
            }
          />

          {/* ── Admin dashboard ───────────────────────────────────── */}
          {/* Guarded — redirects to /login if not authenticated.     */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Suspense fallback={null}>
                  <AdminPage />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* ── Catch-all ─────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
            </DemoModeProvider>
          </AnalysisProvider>
        </InvestigationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;


