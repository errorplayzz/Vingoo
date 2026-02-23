import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ── Freshness window ────────────────────────────────────────────
      // Data is considered fresh for 60 s.  Requests within the window
      // are served from cache with zero network cost.
      staleTime: 60_000,

      // ── Cache lifetime ──────────────────────────────────────────────
      // Garbage-collect unused query data after 5 minutes of inactivity.
      gcTime: 5 * 60_000,

      // ── Retry budget ────────────────────────────────────────────────
      // One automatic retry is sufficient; the backend returns 4xx
      // errors that will not self-heal within milliseconds on a second
      // attempt, so retrying more adds latency without benefit.
      retry: 1,

      // ── Window-focus refetch disabled ───────────────────────────────
      // React Query's default behaviour re-fetches every query when the
      // browser tab regains focus.  In an analyst dashboard that serves
      // large paginated admin lists this causes a burst of N simultaneous
      // GET requests every time the user alt-tabs.  Since admin data is
      // already invalidated on mutation (useApproveReport etc.) and via
      // the SSE invalidation hook, focus-based refetching is redundant.
      refetchOnWindowFocus: false,

      // ── Reconnect refetch enabled ────────────────────────────────────
      // When the device goes back online after a network drop we DO want
      // fresh data (the user may have missed several mutations).
      refetchOnReconnect: true,

      // ── Structural sharing ──────────────────────────────────────────
      // On by default; keeps object identity stable across refetches so
      // React bailout (Object.is) prevents unnecessary re-renders in
      // components that did not receive new data.
      structuralSharing: true,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
