/**
 * hooks/useSseInvalidation.js – Subscribe to the backend SSE stream and
 * surgically invalidate only the affected React Query cache keys.
 *
 * Why not invalidate everything?
 * ──────────────────────────────
 * Calling qc.invalidateQueries({ queryKey: ["admin"] }) on every SSE event
 * fires simultaneous GET requests for analyses, reports AND reviews, even
 * when only the analyses list actually changed.  By mapping each event type
 * to its specific query key we keep network traffic minimal and avoid
 * unnecessary loading states in stable panels.
 *
 * Event → query key map
 * ─────────────────────
 *  analysis_complete → ["admin", "analyses"]   (new DB row is now queryable)
 *  alert             → no cache invalidation   (pure UI notification)
 *  ring_detected     → no cache invalidation   (part of same analysis, already
 *                                               covered by analysis_complete)
 *  analysis_started  → no cache invalidation   (write in progress, not yet in DB)
 *  analysis_progress → no cache invalidation   (progress update only)
 *
 * Reconnection strategy
 * ─────────────────────
 * The browser's native EventSource reconnects automatically on network drops
 * using the Last-Event-ID header (handled by the backend).  On `onerror` we
 * additionally apply an exponential back-off (1 s → 2 s → 4 s … max 30 s)
 * so a temporarily down Render free-tier instance does not spam the server.
 *
 * Usage
 * ─────
 *   // Inside a component that is already wrapped by QueryClientProvider.
 *   // Typically called once at the App level.
 *   useSseInvalidation();
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../api/client";
import { ADMIN_KEYS } from "./useAdminData";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SSE_URL = `${API_BASE}/stream/analysis`;

// Back-off: ms between reconnect attempts [ 1s, 2s, 4s, 8s, 16s, 30s cap ]
const BACKOFF_BASE_MS  = 1_000;
const BACKOFF_MAX_MS   = 30_000;
const BACKOFF_FACTOR   = 2;

// ---------------------------------------------------------------------------
// Event → invalidation map
// ---------------------------------------------------------------------------
// Each entry maps an SSE event.type string to the exact queryKey to
// invalidate.  Keeping this as a plain object makes it easy to extend.

const EVENT_INVALIDATION_MAP = {
  /** A full analysis has finished and is now persisted in the DB. */
  analysis_complete: ADMIN_KEYS.analyses(),
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Opens a single EventSource connection to /stream/analysis and invalidates
 * specific React Query cache keys when server-sent events arrive.
 *
 * The connection is:
 *  - Opened on mount (deferred by one tick via setTimeout to avoid blocking
 *    Suspense boundary resolution).
 *  - Closed on unmount.
 *  - Reconnected automatically by the browser (Last-Event-ID) and by the
 *    manual back-off logic inside onerror.
 *
 * The hook is intentionally passive: it never modifies any component state,
 * only the React Query cache.  There are therefore no extra re-renders caused
 * by the hook itself.
 */
export function useSseInvalidation() {
  const qc           = useQueryClient();
  const esRef        = useRef(null);   // EventSource instance
  const backoffRef   = useRef(BACKOFF_BASE_MS);
  const retryTimer   = useRef(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      // Close any previous connection before opening a new one.
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const es = new EventSource(SSE_URL);
      esRef.current = es;

      // ── Named-event handlers ────────────────────────────────────────────
      // The backend emits typed SSE frames: `event: <type>\ndata: {...}\n\n`
      // We register individual listeners for each event type we care about
      // so the default `message` listener never fires for unrelated events.

      for (const [eventType, queryKey] of Object.entries(EVENT_INVALIDATION_MAP)) {
        es.addEventListener(eventType, () => {
          // Reset back-off on any successful event
          backoffRef.current = BACKOFF_BASE_MS;

          qc.invalidateQueries({ queryKey, exact: true });
        });
      }

      // ── Connection opened (reset back-off) ─────────────────────────────
      es.addEventListener("connected", () => {
        backoffRef.current = BACKOFF_BASE_MS;
      });

      // ── Error / reconnect with back-off ────────────────────────────────
      // CONNECTING (0) → browser reconnects automatically; we don't interfere.
      // CLOSED (2)     → back-off reconnect via our own timer.
      es.onerror = () => {
        if (unmountedRef.current) return;

        if (es.readyState === EventSource.CLOSED) {
          const delay = backoffRef.current;
          backoffRef.current = Math.min(backoffRef.current * BACKOFF_FACTOR, BACKOFF_MAX_MS);

          retryTimer.current = setTimeout(connect, delay);
        }
        // CONNECTING state: let the browser handle it; no extra action needed.
      };
    }

    // Defer by one tick: avoids blocking the render cycle during Suspense.
    const initTimer = setTimeout(connect, 0);

    return () => {
      unmountedRef.current = true;
      clearTimeout(initTimer);
      clearTimeout(retryTimer.current);

      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  // qc is stable for the lifetime of the app (QueryClient is created once in
  // main.jsx).  Using it as a dep satisfies the exhaustive-deps lint rule
  // without causing any extra reconnections.
  }, [qc]);
}
