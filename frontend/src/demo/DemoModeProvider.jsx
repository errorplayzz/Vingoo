/**
 * DemoModeProvider.jsx
 *
 * Context that activates demo mode when ?demo=true is present in the URL,
 * or when enableDemo() is called programmatically.
 *
 * Demo mode:
 *  - Renders SystemNarration overlay (guided messages)
 *  - Enables FocusHighlight auto-sequencing
 *  - Triggers GraphViz cinematic camera animation
 *
 * Usage:
 *   Wrap the app (or a subtree) with <DemoModeProvider>.
 *   Consume with useDemoMode() from this file.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// ── Context ─────────────────────────────────────────────────────────────────
const DemoModeContext = createContext({
  isDemoMode: false,
  enableDemo: () => {},
  disableDemo: () => {},
});

// ── Provider ─────────────────────────────────────────────────────────────────
export function DemoModeProvider({ children }) {
  const [isDemoMode, setDemoMode] = useState(false);

  // Auto-detect ?demo=true from URL on first mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true") {
      setDemoMode(true);
    }
  }, []);

  const enableDemo  = useCallback(() => setDemoMode(true),  []);
  const disableDemo = useCallback(() => setDemoMode(false), []);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, enableDemo, disableDemo }}>
      {children}
    </DemoModeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useDemoMode() {
  return useContext(DemoModeContext);
}
