/** context/AnalysisContext.jsx – Global state shared across all sections. */
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { analyze, checkHealth, getAdminAnalyses, getAdminAnalysis, getAdminReports, getAdminReviews, approveReport, rejectReport, approveReview, rejectReview } from "../api/client";
import { generateExplanations } from "../utils/explainer";


const AnalysisContext = createContext(null);

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return ctx;
}


export function AnalysisProvider({ children }) {
  // Upload / analysis state
  const [status,    setStatus]    = useState("idle");  // idle|uploading|analyzing|done|error
  const [progress,  setProgress]  = useState(0);        // 0-100
  const [result,    setResult]    = useState(null);     // AnalysisResponse + explanations
  const [rawResult, setRawResult] = useState(null);    // exact API response, unmutated
  const [error,     setError]     = useState(null);    // string | null
  const [fileName,  setFileName]  = useState(null);

  // Graph highlight (ring_id → highlight its nodes in GraphViz)
  const [highlightedRingId, setHighlightedRingId] = useState(null);

  // Backend health
  const [apiHealth, setApiHealth] = useState("unknown"); // unknown|healthy|degraded

  // Investigator mode
  const [investigatorMode, setInvestigatorMode] = useState(false);

  // Admin / investigator DB data
  const [adminAnalyses,         setAdminAnalyses]         = useState([]);
  const [adminSelectedAnalysis, setAdminSelectedAnalysis] = useState(null); // full detail
  const [adminReports,          setAdminReports]          = useState([]);
  const [adminReviews,          setAdminReviews]          = useState([]);
  const [adminLoading,          setAdminLoading]          = useState(false);
  const [adminError,            setAdminError]            = useState(null);

  // Cache: avoid re-running explain if same result
  const explainCache = useRef(new Map());


  const pingHealth = useCallback(async () => {
    try {
      await checkHealth();
      setApiHealth("healthy");
    } catch {
      // Retry once after 15 s — handles Render free-tier cold start > 30 s
      try {
        await new Promise(r => setTimeout(r, 15_000));
        await checkHealth();
        setApiHealth("healthy");
      } catch {
        setApiHealth("degraded");
      }
    }
  }, []);


  const runAnalysis = useCallback(async (file) => {
    if (!file) return false;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setStatus("uploading");
    setProgress(10);

    // Fake progress while waiting
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 88));
    }, 400);

    try {
      setStatus("analyzing");
      setProgress(20);

      const data = await analyze(file);

      clearInterval(tick);
      setProgress(95);

      // save raw API response
      setRawResult(data);

      // Attach AI explanations (rule-based, cached by file name)
      let explained;
      if (explainCache.current.has(file.name)) {
        explained = explainCache.current.get(file.name);
      } else {
        explained = generateExplanations(data);

      // prefer Claude explanation over rule-based if AI layer is active
        if (data.ai_status === "active" && Array.isArray(data.ai_explanations) && data.ai_explanations.length > 0) {
          const aiMap = Object.fromEntries(
            data.ai_explanations.map((e) => [e.account_id, e.explanation])
          );
          explained = {
            ...explained,
            suspicious_accounts: explained.suspicious_accounts.map((acc) =>
              aiMap[acc.account_id]
                ? { ...acc, explanation: aiMap[acc.account_id], ai_source: "openrouter" }
                : acc
            ),
          };
        }

        explainCache.current.set(file.name, explained);
      }

      setResult(explained);
      setProgress(100);
      setStatus("done");
      return true;
    } catch (err) {
      clearInterval(tick);
      setProgress(0);
      setStatus("error");

      if (err.name === "AbortError") {
        setError("Request timed out. The backend took too long to respond.");
      } else if (err.status === 422) {
        setError(`Invalid CSV: ${err.detail}`);
      } else if (err.status === 400) {
        setError(`Bad request: ${err.detail}`);
      } else if (!navigator.onLine) {
        setError("No internet connection. Check your network and try again.");
      } else {
        setError(err.detail ?? err.message ?? "An unexpected error occurred.");
      }
      return false;
    }
  }, []);


  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setRawResult(null);
    setError(null);
    setFileName(null);
    setHighlightedRingId(null);
  }, []);

  const fetchAdminData = useCallback(async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const [analyses, reports, reviews] = await Promise.all([
        getAdminAnalyses(),
        getAdminReports(),
        getAdminReviews(),
      ]);
      setAdminAnalyses(Array.isArray(analyses) ? analyses : []);
      setAdminReports(Array.isArray(reports)   ? reports  : []);
      setAdminReviews(Array.isArray(reviews)   ? reviews  : []);
    } catch (err) {
      setAdminError(err.detail ?? err.message ?? "Failed to load admin data.");
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchAdminAnalysisDetail = useCallback(async (id) => {
    setAdminLoading(true);
    try {
      const detail = await getAdminAnalysis(id);
      setAdminSelectedAnalysis(detail);
    } catch (err) {
      setAdminError(err.detail ?? err.message ?? "Failed to load analysis detail.");
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const adminApproveReport = useCallback(async (reportId) => {
    const res = await approveReport(reportId);
    setAdminReports((prev) =>
      prev.map((r) => r.report_id === reportId ? { ...r, status: "approved" } : r),
    );
    return res;
  }, []);

  const adminRejectReport = useCallback(async (reportId) => {
    const res = await rejectReport(reportId);
    setAdminReports((prev) =>
      prev.map((r) => r.report_id === reportId ? { ...r, status: "rejected" } : r),
    );
    return res;
  }, []);

  const adminApproveReview = useCallback(async (reviewId) => {
    const res = await approveReview(reviewId);
    setAdminReviews((prev) =>
      prev.map((r) => r.review_id === reviewId ? { ...r, status: "approved" } : r),
    );
    return res;
  }, []);

  const adminRejectReview = useCallback(async (reviewId) => {
    const res = await rejectReview(reviewId);
    setAdminReviews((prev) =>
      prev.map((r) => r.review_id === reviewId ? { ...r, status: "rejected" } : r),
    );
    return res;
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        // analysis
        status, progress, result, rawResult, error, fileName,
        // health
        apiHealth, pingHealth,
        // mode
        investigatorMode, setInvestigatorMode,
        // highlight
        highlightedRingId, setHighlightedRingId,
        // analysis actions
        runAnalysis, reset,
        // admin state
        adminAnalyses, adminSelectedAnalysis, setAdminSelectedAnalysis,
        adminReports, adminReviews,
        adminLoading, adminError,
        // admin actions
        fetchAdminData, fetchAdminAnalysisDetail,
        adminApproveReport, adminRejectReport,
        adminApproveReview, adminRejectReview,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}
