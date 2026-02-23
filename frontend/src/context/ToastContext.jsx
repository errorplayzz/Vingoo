/**
 * context/ToastContext.jsx
 * Lightweight toast notification system — no external deps.
 */
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" stroke="#16A34A" />
      <path d="M5 8l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" stroke="#DC2626" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" stroke="#1D4ED8" />
      <path d="M8 7v5M8 5v1" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const STYLES = {
  success: "border-green-200 bg-white text-ink",
  error:   "border-red-200   bg-white text-ink",
  info:    "border-blue-200  bg-white text-ink",
};

function ToastItem({ toast, onDismiss }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.96  }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-glass
        max-w-sm w-full pointer-events-auto ${STYLES[toast.type]}`}
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)" }}
    >
      <span className="flex-shrink-0 mt-0.5">{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-[13px] font-semibold text-ink leading-tight mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-[12px] text-muted leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-faint hover:text-muted transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ type = "info", title, message, duration = 4500 }) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Convenience shortcuts
  toast.success = (message, title) => toast({ type: "success", title, message });
  toast.error   = (message, title) => toast({ type: "error",   title, message, duration: 6000 });
  toast.info    = (message, title) => toast({ type: "info",    title, message });

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Portal-like fixed container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
