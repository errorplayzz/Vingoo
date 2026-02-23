import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { submitReport, submitSecondChance } from "../api/client";
import { useToast } from "../context/ToastContext";

/* --- Card data --- */
const CARDS = [
  {
    id: "report",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 18s7-3.5 7-8.75V4.375L10 2 3 4.375V9.25C3 14.5 10 18 10 18z" />
        <path d="M10 7v3M10 13h.01" />
      </svg>
    ),
    title: "Report Suspicious Account",
    description: "Submit a verified fraud report. Assigned a unique reference ID and routed to a compliance officer within 24 hours.",
    action: "Submit Report",
    accent: "blue",
  },
  {
    id: "track",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v4l2.5 2.5" />
      </svg>
    ),
    title: "Track Report Status",
    description: "Monitor the live status of your submission. Receive timestamped updates at each stage of the compliance review.",
    action: "Check Status",
    accent: "blue",
  },
  {
    id: "learn",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 5l8-3 8 3-8 3-8-3z" />
        <path d="M2 9l8 3 8-3M2 13l8 3 8-3" />
      </svg>
    ),
    title: "Learn Warning Signs",
    description: "Interactive guide covering the seven key indicators of money muling recruitment and how to spot suspicious contact.",
    action: "View Guide",
    accent: "blue",
  },
  {
    id: "second_chance",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10a6 6 0 1012 0 6 6 0 00-12 0" />
        <path d="M4 6V2M4 6H8" />
        <path d="M10 8v3l2 1" />
      </svg>
    ),
    title: "Request Second Chance",
    description: "Believe your account was flagged in error? Submit a formal review request. You'll receive a reference ID and a response deadline.",
    action: "Open Request Form",
    accent: "blue",
  },
  {
    id: "reward",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="8" r="4" />
        <path d="M6 12l-3 6h14l-3-6" />
      </svg>
    ),
    title: "Reward for Verified Reports",
    description: "Verified fraud reports that lead to a confirmed case may qualify for a civil reward under our whistleblower programme.",
    action: "Learn More",
    accent: "blue",
  },
];

/* --- Form field util --- */
function Field({ label, id, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold text-muted block mb-1">{label}</label>
      <input
        id={id}
        className="w-full text-[12px] px-3 py-2 rounded-lg border border-black/[0.10] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white transition"
        {...props}
      />
    </div>
  );
}

function TextArea({ label, id, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold text-muted block mb-1">{label}</label>
      <textarea
        id={id}
        rows={3}
        className="w-full text-[12px] px-3 py-2 rounded-lg border border-black/[0.10] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white transition resize-none"
        {...props}
      />
    </div>
  );
}

/* --- Report form (inline in card) --- */
function ReportForm() {
  const toast = useToast();
  const [form, setForm] = useState({ reporter_name: "", account_reported: "", description: "", contact_email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_reported || !form.description) {
      toast.error("Please fill in the required fields.", "Missing info");
      return;
    }
    setSubmitting(true);
    try {
      const ack = await submitReport(form);
      setSubmitted(ack);
      toast.success(`Report #${ack.report_id} submitted successfully.`, "Report filed");
    } catch (err) {
      toast.error(err.detail ?? "Could not submit report. Please try again.", "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pt-5 border-t border-black/[0.06] text-sm">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0">
            <circle cx="8" cy="8" r="7.25" stroke="#16A34A" strokeWidth="1.5"/>
            <path d="M5 8l2.5 2.5L11 5.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-green-800 mb-0.5">Report {submitted.report_id} filed</p>
            <p className="text-[12px] text-green-700">{submitted.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="mt-5 pt-5 border-t border-black/[0.06] space-y-3" onSubmit={handleSubmit}>
      <Field label="Your name" id="rep-name" placeholder="Optional" value={form.reporter_name} onChange={set("reporter_name")} />
      <Field label="Account to report *" id="rep-account" placeholder="ACC-XXXXX" required value={form.account_reported} onChange={set("account_reported")} />
      <TextArea label="Description *" id="rep-desc" placeholder="Describe the suspicious activity…" required value={form.description} onChange={set("description")} />
      <Field label="Contact email" id="rep-email" type="email" placeholder="Optional — for case updates" value={form.contact_email} onChange={set("contact_email")} />
      <button
        type="submit"
        disabled={submitting}
        className="w-full text-[12px] font-semibold py-2 rounded-lg bg-accent text-white hover:bg-accent-dim disabled:opacity-50 transition-colors duration-200"
      >
        {submitting ? "Submitting…" : "Submit Secure Report"}
      </button>
    </form>
  );
}

/* --- Second chance form (inline in card) --- */
function SecondChanceForm() {
  const toast = useToast();
  const [form, setForm] = useState({ account_id: "", full_name: "", explanation: "", contact_email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_id || !form.full_name || !form.explanation) {
      toast.error("Please fill in all required fields.", "Missing info");
      return;
    }
    setSubmitting(true);
    try {
      const ack = await submitSecondChance(form);
      setSubmitted(ack);
      toast.success(`Review #${ack.review_id} created. Deadline: ${ack.review_deadline}.`, "Request received");
    } catch (err) {
      toast.error(err.detail ?? "Could not submit request.", "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pt-5 border-t border-black/[0.06]">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0">
            <circle cx="8" cy="8" r="7.25" stroke="#16A34A" strokeWidth="1.5"/>
            <path d="M5 8l2.5 2.5L11 5.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-green-800 mb-0.5">Review {submitted.review_id}</p>
            <p className="text-[12px] text-green-700">Status: {submitted.status} · Deadline: {submitted.review_deadline}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="mt-5 pt-5 border-t border-black/[0.06] space-y-3" onSubmit={handleSubmit}>
      <Field label="Account ID *" id="sc-acc" placeholder="Your flagged account ID" required value={form.account_id} onChange={set("account_id")} />
      <Field label="Full name *" id="sc-name" placeholder="Your legal name" required value={form.full_name} onChange={set("full_name")} />
      <TextArea label="Explanation *" id="sc-exp" placeholder="Why this flag is incorrect…" required value={form.explanation} onChange={set("explanation")} />
      <Field label="Contact email" id="sc-email" type="email" placeholder="For review updates" value={form.contact_email} onChange={set("contact_email")} />
      <button
        type="submit"
        disabled={submitting}
        className="w-full text-[12px] font-semibold py-2 rounded-lg bg-accent text-white hover:bg-accent-dim disabled:opacity-50 transition-colors duration-200"
      >
        {submitting ? "Submitting…" : "Request Second Chance Review"}
      </button>
    </form>
  );
}

/* --- Single card --- */
function Card({ card, index, inView }) {
  const [open, setOpen] = useState(false);

  const expandedContent = (() => {
    if (card.id === "report") return <ReportForm />;
    if (card.id === "second_chance") return <SecondChanceForm />;
    return (
      <p className="text-sm text-muted leading-relaxed">
        Our system is built to protect whistleblowers. All submissions are
        encrypted end-to-end and stored with zero personally identifiable
        data unless voluntarily provided. Your report contributes directly
        to disrupting financial crime networks.
      </p>
    );
  })();
  return (
    <motion.div
      className="glass-card rounded-2xl p-6 group transition-lift cursor-pointer"
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => setOpen((v) => !v)}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-accent/8 text-accent flex items-center justify-center mb-5 group-hover:bg-accent group-hover:text-white transition-colors duration-300">
        {card.icon}
      </div>

      <h3 className="text-[15px] font-semibold text-ink mb-2">{card.title}</h3>
      <p className="text-sm text-muted leading-relaxed mb-5">{card.description}</p>

      <button
        className="flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:gap-3 transition-all duration-200"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        {card.action}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mt-5 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {expandedContent}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* --- Section --- */
export default function CitizenProtection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="protect" className="bg-surface border-t border-black/[0.06] py-24 md:py-32">
      <div className="container-wide" ref={ref}>
        <motion.div
          className="mb-14"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="section-label mb-3">Citizen Protection</p>
          <h2 className="section-title max-w-lg">
            You see something.
            <br />We help you act.
          </h2>
          <p className="mt-4 text-muted max-w-md leading-relaxed">
            Direct channels for the public to report fraud, track investigations,
            and stay protected from money muling recruitment.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {CARDS.map((c, i) => (
            <Card key={c.id} card={c} index={i} inView={inView} />
          ))}
        </div>

        {/* Safety banner */}
        <motion.div
          className="mt-10 glass-card rounded-2xl px-7 py-5 flex flex-col md:flex-row items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <div className="w-10 h-10 rounded-xl bg-accent/8 text-accent flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="9" width="14" height="9" rx="1.5" />
              <path d="M7 9V6a3 3 0 016 0v3" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink mb-0.5">Your identity is protected</p>
            <p className="text-sm text-muted">All reports are end-to-end encrypted. No PII stored without consent. Reports reviewed under regulatory confidentiality.</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[12px] text-muted font-medium">Encrypted  Verified</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
