/**
 * hooks/useAdminData.js – React Query wrappers for all /admin/* endpoints.
 *
 * Why React Query here instead of useState/ useCallback in AnalysisContext?
 *
 *  1. Automatic caching: switching tabs no longer re-fetches the same list.
 *  2. Background revalidation: stale data updates silently without a spinner.
 *  3. Optimistic UI: approve/reject mutations update the cache instantly so
 *     the badge counts decrement before the server round-trip completes.
 *  4. Re-render isolation: components subscribe only to the specific slice
 *     they display; a loading state for "reports" does not re-render the
 *     "analyses" list.
 *  5. Devtools: @tanstack/react-query-devtools gives full cache visibility in
 *     development (add to main.jsx if needed).
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getAdminAnalyses,
  getAdminAnalysis,
  getAdminReports,
  getAdminReviews,
  approveReport,
  rejectReport,
  approveReview,
  rejectReview,
} from "../api/client";

/* ── Query keys ───────────────────────────────────────────────────────────── */
// Using a ["admin", ...] prefix so we can invalidate the whole admin namespace
// in a single invalidateQueries({ queryKey: ["admin"] }) call.

export const ADMIN_KEYS = {
  all:       () => ["admin"],
  analyses:  () => ["admin", "analyses"],
  analysis:  (id) => ["admin", "analysis", id],
  reports:   () => ["admin", "reports"],
  reviews:   () => ["admin", "reviews"],
};

/* ── Stale times ─────────────────────────────────────────────────────────── */
// Mirror the global QueryClient staleTime so there is one source of truth.
// List views refresh every 60 s; detail views are point-in-time snapshots
// that never change after creation, so they stay fresh indefinitely.
const STALE_LIST   = 60_000;      // 60 s — matches global default
const STALE_DETAIL = Infinity;     // analysis snapshots are immutable

/* ── List queries ─────────────────────────────────────────────────────────── */

/**
 * Fetch the paginated analyses list.
 * @param {boolean} enabled – pass `false` to defer until investigator mode active
 */
export function useAdminAnalyses(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.analyses(),
    queryFn:  () => getAdminAnalyses(0, 50),
    staleTime: STALE_LIST,
    enabled,
    // Disable focus-triggered refetch at the hook level (defence-in-depth:
    // the global QueryClient default also sets this, but being explicit here
    // means the hook is correct even if the global default changes).
    refetchOnWindowFocus: false,
    // While a background refetch is in flight, keep showing the previous data
    // instead of switching the component to a loading skeleton.
    placeholderData: keepPreviousData,
    // Normalise to [] so callers never have to guard against undefined
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

/**
 * Fetch full detail for one analysis (triggered only when an id is provided).
 */
export function useAdminAnalysisDetail(id) {
  return useQuery({
    queryKey: ADMIN_KEYS.analysis(id),
    queryFn:  () => getAdminAnalysis(id),
    // Analysis snapshots are immutable: once fetched, the data never changes,
    // so mark as permanently fresh to prevent any background re-fetches.
    staleTime: STALE_DETAIL,
    enabled:  !!id,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch the paginated victim-report list.
 */
export function useAdminReports(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.reports(),
    queryFn:  () => getAdminReports(0, 50),
    staleTime: STALE_LIST,
    enabled,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

/**
 * Fetch the paginated second-chance review list.
 */
export function useAdminReviews(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.reviews(),
    queryFn:  () => getAdminReviews(0, 50),
    staleTime: STALE_LIST,
    enabled,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

/* ── Mutations ────────────────────────────────────────────────────────────── */
// All mutations use optimistic updates: the cache is updated immediately on
// mutate() so the UI responds before the server round-trip completes.
// On error the cache is rolled back automatically via onError.

function optimisticStatusUpdate(queryClient, queryKey, idField, id, newStatus) {
  const previous = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, (old = []) =>
    old.map((item) => item[idField] === id ? { ...item, status: newStatus } : item),
  );
  return previous;
}

/** Approve a victim report → optimistically mark "approved" in the cache. */
export function useApproveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveReport,
    onMutate: (reportId) =>
      optimisticStatusUpdate(qc, ADMIN_KEYS.reports(), "report_id", reportId, "approved"),
    onError: (_err, _reportId, previous) => {
      if (previous !== undefined) qc.setQueryData(ADMIN_KEYS.reports(), previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.reports() }),
  });
}

/** Reject a victim report → optimistically mark "rejected" in the cache. */
export function useRejectReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectReport,
    onMutate: (reportId) =>
      optimisticStatusUpdate(qc, ADMIN_KEYS.reports(), "report_id", reportId, "rejected"),
    onError: (_err, _reportId, previous) => {
      if (previous !== undefined) qc.setQueryData(ADMIN_KEYS.reports(), previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.reports() }),
  });
}

/** Approve a second-chance review → optimistically mark "approved". */
export function useApproveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveReview,
    onMutate: (reviewId) =>
      optimisticStatusUpdate(qc, ADMIN_KEYS.reviews(), "review_id", reviewId, "approved"),
    onError: (_err, _reviewId, previous) => {
      if (previous !== undefined) qc.setQueryData(ADMIN_KEYS.reviews(), previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.reviews() }),
  });
}

/** Reject a second-chance review → optimistically mark "rejected". */
export function useRejectReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectReview,
    onMutate: (reviewId) =>
      optimisticStatusUpdate(qc, ADMIN_KEYS.reviews(), "review_id", reviewId, "rejected"),
    onError: (_err, _reviewId, previous) => {
      if (previous !== undefined) qc.setQueryData(ADMIN_KEYS.reviews(), previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.reviews() }),
  });
}

/**
 * Invalidate the entire admin cache namespace.
 * Call this from the Refresh button in the dashboard instead of fetchAdminData().
 *
 * @example
 *   const refresh = useRefreshAdmin();
 *   <button onClick={refresh}>Refresh</button>
 */
export function useRefreshAdmin() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.all() });
}
