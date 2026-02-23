import { AnalysisProvider } from './context/AnalysisContext';
import { ToastProvider }    from './context/ToastContext';
import Navbar              from './components/Navbar';
import Hero                from './sections/Hero';
import HowItWorks          from './sections/HowItWorks';
import UploadAnalysis      from './sections/UploadAnalysis';
import ResultsDashboard    from './sections/ResultsDashboard';
import StoryMode           from './sections/StoryMode';
import GraphViz            from './sections/GraphViz';
import IntelligenceExport  from './sections/IntelligenceExport';
import CitizenProtection       from './sections/CitizenProtection';
import InvestigatorDashboard  from './sections/InvestigatorDashboard';
import ProtectPage             from './sections/ProtectPage';
import Footer                  from './sections/Footer';

function App() {
  return (
    <ToastProvider>
      <AnalysisProvider>
        <div className="bg-white font-sans">
          <Navbar />
          <main>
            <Hero />
            <HowItWorks />
            <UploadAnalysis />
            <ResultsDashboard />
            <StoryMode />
            <GraphViz />
            <IntelligenceExport />
            <CitizenProtection />
            <InvestigatorDashboard />
            <ProtectPage />
          </main>
          <Footer />
        </div>
      </AnalysisProvider>
    </ToastProvider>
  );
}

export default App;

