/**
 * api/client.js – All backend calls go through here. Base URL from VITE_API_URL env.
 */

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TIMEOUT_MS = 30_000;         // 30 s — general requests
const ANALYZE_TIMEOUT_MS = 180_000; // 180 s — large CSVs can take a while
const HEALTH_TIMEOUT_MS = 90_000;  // 90 s — allows for Render free-tier cold start

/* ── Helpers ──────────────────────────────────────────────────────────────── */

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function apiError(message, status, detail) {
  const err = new Error(message);
  err.status = status;
  err.detail = detail ?? message;
  return err;
}

async function handleResponse(res) {
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const detail = typeof body === "object" ? (body.detail ?? JSON.stringify(body)) : body;
    throw apiError(`HTTP ${res.status}`, res.status, detail);
  }
  return body;
}

/* ── Endpoints ────────────────────────────────────────────────────────────── */

/**
 * GET /health
 * Returns { status, service, version } or throws.
 */
export async function checkHealth() {
  const res = await fetchWithTimeout(`${API_BASE}/health`, {}, HEALTH_TIMEOUT_MS);
  return handleResponse(res);
}

/**
 * POST /analyze
 * @param {File} file - CSV File object from <input type="file">
 * @returns {Promise<AnalysisResponse>}
 */
export async function analyze(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithTimeout(`${API_BASE}/analyze`, {
    method: "POST",
    body: form,
  }, ANALYZE_TIMEOUT_MS);
  return handleResponse(res);
}

/**
 * GET /export
 * Returns the latest cached analysis result.
 */
export async function exportLatest() {
  const res = await fetchWithTimeout(`${API_BASE}/export`);
  return handleResponse(res);
}

/**
 * POST /report
 * @param {{ reporter_name, reporter_contact, suspect_account_id, incident_description, incident_date? }} payload
 */
export async function submitReport(payload) {
  const res = await fetchWithTimeout(`${API_BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/**
 * POST /second-chance
 * @param {{ account_id, requester_name, requester_contact, reason, supporting_evidence? }} payload
 */
export async function submitSecondChance(payload) {
  const res = await fetchWithTimeout(`${API_BASE}/second-chance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/**
 * GET /legal-info
 */
export async function getLegalInfo() {
  const res = await fetchWithTimeout(`${API_BASE}/legal-info`);
  return handleResponse(res);
}

/* ── Admin / Investigator endpoints ──────────────────────────────────────── */

/**
 * GET /admin/analyses?skip=0&limit=50
 */
export async function getAdminAnalyses(skip = 0, limit = 50) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/analyses?skip=${skip}&limit=${limit}`,
  );
  return handleResponse(res);
}

/**
 * GET /admin/analysis/{id}
 */
export async function getAdminAnalysis(id) {
  const res = await fetchWithTimeout(`${API_BASE}/admin/analysis/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

/**
 * GET /admin/reports?skip=0&limit=50
 */
export async function getAdminReports(skip = 0, limit = 50) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/reports?skip=${skip}&limit=${limit}`,
  );
  return handleResponse(res);
}

/**
 * GET /admin/reviews?skip=0&limit=50
 */
export async function getAdminReviews(skip = 0, limit = 50) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/reviews?skip=${skip}&limit=${limit}`,
  );
  return handleResponse(res);
}

/**
 * POST /admin/reports/{report_id}/approve
 */
export async function approveReport(reportId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/reports/${encodeURIComponent(reportId)}/approve`,
    { method: "POST" },
  );
  return handleResponse(res);
}

/**
 * POST /admin/reports/{report_id}/reject
 */
export async function rejectReport(reportId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/reports/${encodeURIComponent(reportId)}/reject`,
    { method: "POST" },
  );
  return handleResponse(res);
}

/**
 * POST /admin/review/{review_id}/approve
 */
export async function approveReview(reviewId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/review/${encodeURIComponent(reviewId)}/approve`,
    { method: "POST" },
  );
  return handleResponse(res);
}

/**
 * POST /admin/review/{review_id}/reject
 */
export async function rejectReview(reviewId) {
  const res = await fetchWithTimeout(
    `${API_BASE}/admin/review/${encodeURIComponent(reviewId)}/reject`,
    { method: "POST" },
  );
  return handleResponse(res);
}
