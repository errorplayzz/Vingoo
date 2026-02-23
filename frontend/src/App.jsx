import { lazy, Suspense, memo } from 'react';
import { AnalysisProvider } from './context/AnalysisContext';
import { ToastProvider }    from './context/ToastContext';
import Navbar              from './components/Navbar';
import Hero                from './sections/Hero';
import HowItWorks          from './sections/HowItWorks';
import UploadAnalysis      from './sections/UploadAnalysis';
import ProtectPage         from './sections/ProtectPage';
import Footer              from './sections/Footer';

// ── Lazy-loaded sections ─────────────────────────────────────────────────────
// These are below-the-fold or only conditionally rendered.  Each gets its own
// async chunk so the initial JS bundle stays small.
//
// Load order is chosen by scroll position (top → bottom).  ResultsDashboard
// and GraphViz are the heaviest; InvestigatorDashboard pulls in admin data so
// it only loads when investigator mode is enabled.
const ResultsDashboard     = lazy(() => import('./sections/ResultsDashboard'));
const StoryMode            = lazy(() => import('./sections/StoryMode'));
const GraphViz             = lazy(() => import('./sections/GraphViz'));
const IntelligenceExport   = lazy(() => import('./sections/IntelligenceExport'));
const CitizenProtection    = lazy(() => import('./sections/CitizenProtection'));
const InvestigatorDashboard = lazy(() => import('./sections/InvestigatorDashboard'));

// Shared fallback — a thin shimmer bar that matches the section's min-height
const SectionFallback = memo(() => (
  <div className="w-full py-20 flex items-center justify-center" aria-hidden>
    <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
  </div>
));

function App() {
  return (
    <ToastProvider>
      <AnalysisProvider>
        <div className="bg-white font-sans">
          <Navbar />
          <main>
            {/* Eager — above the fold + small */}
            <Hero />
            <HowItWorks />
            <UploadAnalysis />

            {/* Lazy — rendered only after main bundle hydrates */}
            <Suspense fallback={<SectionFallback />}>
              <ResultsDashboard />
            </Suspense>

            <Suspense fallback={<SectionFallback />}>
              <StoryMode />
            </Suspense>

            {/* GraphViz loads the entire D3 bundle — isolated chunk */}
            <Suspense fallback={<SectionFallback />}>
              <GraphViz />
            </Suspense>

            <Suspense fallback={<SectionFallback />}>
              <IntelligenceExport />
            </Suspense>

            <Suspense fallback={<SectionFallback />}>
              <CitizenProtection />
            </Suspense>

            {/* Investigator panel — only loads JS when mode is toggled on */}
            <Suspense fallback={null}>
              <InvestigatorDashboard />
            </Suspense>

            <ProtectPage />
          </main>
          <Footer />
        </div>
      </AnalysisProvider>
    </ToastProvider>
  );
}

export default App;

