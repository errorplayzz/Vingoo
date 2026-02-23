/**
 * sections/ProtectPage.jsx
 * Public Awareness & Prevention — linked from the "Protect" navbar item.
 *
 * Sections:
 *  1. What is Money Muling?   — definition + key stats
 *  2. Red Flags               — 8-card grid of warning signs
 *  3. What To Do              — 5-step numbered action list
 *  4. Legal Consequences      — AMLA 2001, imprisonment + fines panel
 *  5. Self Risk Check         — interactive yes/no checklist → risk level
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";

const EASE = [0.4, 0, 0.2, 1];

/* ─── Fade-in wrapper ──────────────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = "" }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Section heading ──────────────────────────────────────────────────────── */
function SectionHeading({ label, title, subtitle }) {
  return (
    <div className="mb-10">
      <p className="section-label mb-2">{label}</p>
      <h2 className="section-title mb-3">{title}</h2>
      {subtitle && (
        <p className="text-[15px] text-muted max-w-2xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

/* ─── 1. What Is Money Muling ──────────────────────────────────────────────── */
function WhatIsSection() {
  const stats = [
    { value: "MY", label: "Financial crime listed under AMLA 2001" },
    { value: "15 yrs", label: "Maximum imprisonment for convicted mules" },
    { value: "RM 5M", label: "Maximum fine imposed by courts" },
    { value: "Rising", label: "Cases reported to BNM yearly" },
  ];

  return (
    <section className="py-20 md:py-28 border-b border-black/[0.05]">
      <div className="container-wide">
        <FadeIn>
          <SectionHeading
            label="The Threat"
            title="What is Money Muling?"
            subtitle="A money mule is someone who transfers or moves illegally obtained money on behalf of another person. The mule receives a cut of the money, either knowingly or unknowingly, making them complicit in financial crime — even if they never touched the original fraud."
          />
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.08}>
              <div className="p-5 rounded-2xl border border-black/[0.06] bg-white"
                   style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <p className="text-2xl font-black text-ink tracking-tight mb-1">{s.value}</p>
                <p className="text-[11.5px] text-faint font-medium leading-snug">{s.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.2}>
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-[13px] font-semibold text-amber-900 leading-relaxed">
              <span className="font-black">Important: </span>
              Claiming you "didn't know" is not a complete legal defence. Malaysian courts have prosecuted individuals who acted recklessly or failed to perform basic due diligence before lending their accounts or handling transfers for others.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── 2. Red Flags ─────────────────────────────────────────────────────────── */
const RED_FLAGS = [
  {
    icon: "💼",
    title: "Unsolicited Job Offers",
    desc: "You receive a job offer — often online — requiring you to receive and forward money. Real employers do not route payroll through personal accounts.",
  },
  {
    icon: "🏦",
    title: "Requests to Use Your Account",
    desc: "Someone asks to use your bank account to receive funds on their behalf, promising a commission or claiming it is 'only temporary'.",
  },
  {
    icon: "💸",
    title: "Receive-Then-Transfer Instructions",
    desc: "You are asked to receive a deposit and immediately withdraw cash or forward it to another person or account, often abroad.",
  },
  {
    icon: "🔑",
    title: "Sharing Banking Credentials",
    desc: "You are pressured or incentivised to share your online banking login, OTP codes, or debit card details with a third party.",
  },
  {
    icon: "🤑",
    title: "Promises of Easy Money",
    desc: "The arrangement promises disproportionate returns — hundreds or thousands of ringgit — for minimal or vague work with few questions asked.",
  },
  {
    icon: "⏱️",
    title: "Urgency and Pressure Tactics",
    desc: "You are told to act quickly, not to ask questions, or that the opportunity will disappear. Legitimate opportunities do not require secrecy or haste.",
  },
  {
    icon: "🌐",
    title: "Overseas Transfers Requested",
    desc: "You are asked to transfer funds internationally to accounts in other countries, often through wire transfer, cryptocurrency, or remittance services.",
  },
  {
    icon: "📵",
    title: "Requests for Secrecy",
    desc: "The person asking explicitly tells you not to inform your bank, PDRM, or family members about the arrangement.",
  },
];

function RedFlagsSection() {
  return (
    <section className="py-20 md:py-28 border-b border-black/[0.05]">
      <div className="container-wide">
        <FadeIn>
          <SectionHeading
            label="Warning Signs"
            title="Red Flags to Recognise"
            subtitle="These are the most common indicators that you or someone you know may be targeted for recruitment as a money mule."
          />
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RED_FLAGS.map((flag, i) => (
            <FadeIn key={flag.title} delay={i * 0.06}>
              <div className="p-5 rounded-2xl border border-black/[0.06] bg-white h-full"
                   style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <span className="text-2xl mb-3 block">{flag.icon}</span>
                <p className="text-[13px] font-bold text-ink mb-1.5">{flag.title}</p>
                <p className="text-[12px] text-muted leading-relaxed">{flag.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 3. What To Do ────────────────────────────────────────────────────────── */
const STEPS = [
  {
    num: "01",
    title: "Stop All Transactions Immediately",
    desc: "Do not process any further transfers or withdrawals. Continuing to move funds after becoming aware of suspicious activity may increase your legal exposure.",
  },
  {
    num: "02",
    title: "Contact Your Bank",
    desc: "Call your bank's fraud hotline and report that your account may have been used in a suspicious manner. Banks can place holds to prevent further misuse.",
  },
  {
    num: "03",
    title: "Report to PDRM or BNM",
    desc: "File a police report with the Royal Malaysia Police (PDRM) or submit a report to Bank Negara Malaysia (BNM) via their Financial Consumer Alert portal.",
  },
  {
    num: "04",
    title: "Document Everything",
    desc: "Preserve all messages, screenshots, transaction records, and contact details of anyone who asked you to handle the funds. This evidence is critical.",
  },
  {
    num: "05",
    title: "Seek Legal Advice",
    desc: "Consult a qualified lawyer before making statements to authorities if you believe you may face criminal charges. Early legal advice can significantly affect outcomes.",
  },
];

function WhatToDoSection() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-20 md:py-28 border-b border-black/[0.05]">
      <div className="container-wide">
        <FadeIn>
          <SectionHeading
            label="Take Action"
            title="What To Do If You're Involved"
            subtitle="If you suspect you have been recruited as a money mule — or if your account has been used without your full understanding — act immediately using these steps."
          />
        </FadeIn>

        <div className="flex flex-col gap-3 max-w-3xl">
          {STEPS.map((step, i) => {
            const isOpen = open === i;
            return (
              <FadeIn key={step.num} delay={i * 0.07}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full text-left p-5 rounded-2xl border border-black/[0.06] bg-white
                             hover:border-black/[0.12] transition-colors duration-200"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-black text-accent tabular-nums flex-shrink-0">
                        {step.num}
                      </span>
                      <span className="text-[14px] font-semibold text-ink">{step.title}</span>
                    </div>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-faint flex-shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </motion.span>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.p
                        className="text-[13px] text-muted leading-relaxed mt-3 pl-[52px]"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                      >
                        {step.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── 4. Legal Consequences ────────────────────────────────────────────────── */
function LegalSection() {
  const items = [
    {
      law: "Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 (AMLA)",
      summary: "The primary legislation covering money laundering offences in Malaysia. Section 4 creates the offence of money laundering; conviction does not require that the accused personally profited from the original crime.",
    },
    {
      law: "Section 4 — Money Laundering Offence",
      summary: "Any person who engages, directly or indirectly, in a transaction involving proceeds of an unlawful activity commits an offence, whether or not they knew the specific underlying crime.",
    },
    {
      law: "Penalties",
      summary: "On conviction, an individual faces imprisonment of up to 15 years AND a fine of up to RM 5,000,000 (five million ringgit), or both. Forfeiture of all involved assets is also ordered.",
    },
    {
      law: "Ignorance Is Not a Full Defence",
      summary: "Courts consider whether a reasonable person would have asked questions. Willful blindness — failing to investigate obvious warning signs — can satisfy the knowledge element of the offence.",
    },
  ];

  return (
    <section className="py-20 md:py-28 border-b border-black/[0.05] bg-slate-50/60">
      <div className="container-wide">
        <FadeIn>
          <SectionHeading
            label="Legal Framework"
            title="Legal Consequences"
            subtitle="Malaysian law treats money muling as a serious financial crime. The penalties apply regardless of whether the mule originated the underlying fraud."
          />
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {items.map((item, i) => (
            <FadeIn key={item.law} delay={i * 0.08}>
              <div className="p-5 rounded-2xl border border-black/[0.06] bg-white h-full"
                   style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <p className="text-[11px] font-bold text-accent uppercase tracking-wider mb-2">
                  {item.law}
                </p>
                <p className="text-[13px] text-muted leading-relaxed">{item.summary}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3}>
          <div className="mt-6 p-5 rounded-2xl border border-red-200 bg-red-50 max-w-4xl">
            <p className="text-[13px] font-semibold text-red-900 leading-relaxed">
              A money mule conviction results in a permanent criminal record that affects employment, travel, and financial services. It cannot be expunged once entered. If you are uncertain about any financial request you have received, stop and seek advice before proceeding.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── 5. Self Risk Check ────────────────────────────────────────────────────── */
const RISK_ITEMS = [
  { id: "r1", text: "Someone has asked to use my bank account to receive funds." },
  { id: "r2", text: "I have been offered money to forward transfers or handle cash on behalf of others." },
  { id: "r3", text: "I have been asked to keep financial transactions secret from my bank or family." },
  { id: "r4", text: "I have received more money than expected and was asked to send the excess elsewhere." },
  { id: "r5", text: "I have shared my banking login, ATM card, or OTP with someone else." },
  { id: "r6", text: "I was recruited for a 'job' that mainly involves handling other people's money." },
  { id: "r7", text: "I have been pressured to act quickly without being given time to verify information." },
  { id: "r8", text: "Someone online has offered me unusually high income for minimal, vague tasks." },
];

const RISK_LEVELS = {
  low:    { label: "Low Risk",    color: "green",  message: "No significant indicators detected. Continue to stay informed and be cautious of unsolicited financial requests." },
  medium: { label: "Medium Risk", color: "amber",  message: "Some indicators are present. Do not proceed with any pending financial arrangements. Contact your bank and seek clarification before taking further action." },
  high:   { label: "High Risk",   color: "red",    message: "Multiple high-risk indicators detected. Stop all related transactions immediately. Contact your bank's fraud line and consider filing a report with PDRM." },
};

function SelfRiskCheck() {
  const [checked, setChecked] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const count  = Object.values(checked).filter(Boolean).length;

  const riskKey = count >= 4 ? "high" : count >= 2 ? "medium" : "low";
  const risk    = RISK_LEVELS[riskKey];

  const colorMap = {
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", badge: "bg-green-100 text-green-800 border-green-200" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-100 text-amber-800 border-amber-200" },
    red:   { bg: "bg-red-50",   border: "border-red-200",   text: "text-red-800",   badge:   "bg-red-100 text-red-800 border-red-200" },
  };
  const c = colorMap[risk.color];

  return (
    <section className="py-20 md:py-28">
      <div className="container-wide">
        <FadeIn>
          <SectionHeading
            label="Self Assessment"
            title="Self Risk Check"
            subtitle="Answer honestly. This checklist is anonymous and stored nowhere. It helps you evaluate whether any current situation warrants immediate action."
          />
        </FadeIn>

        <div className="max-w-2xl">
          <div className="flex flex-col gap-3 mb-8">
            {RISK_ITEMS.map((item, i) => (
              <FadeIn key={item.id} delay={i * 0.05}>
                <label className="flex items-start gap-3 p-4 rounded-xl border border-black/[0.06] bg-white
                                  cursor-pointer hover:border-black/[0.12] transition-colors select-none"
                       style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                  <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center
                                  transition-colors duration-150
                                  ${checked[item.id]
                                    ? "bg-accent border-accent"
                                    : "bg-white border-black/[0.18] hover:border-accent/50"}`}
                       onClick={() => toggle(item.id)}>
                    {checked[item.id] && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1.5 5.5l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[13px] text-muted leading-relaxed">{item.text}</span>
                </label>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2}>
            <button
              onClick={() => setSubmitted(true)}
              className="w-full py-3 rounded-xl bg-accent text-white text-[14px] font-semibold
                         hover:bg-accent-dim transition-colors duration-200"
            >
              Check My Risk Level
            </button>
          </FadeIn>

          <AnimatePresence>
            {submitted && (
              <motion.div
                className={`mt-5 p-5 rounded-2xl border ${c.bg} ${c.border}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                    {risk.label}
                  </span>
                  <span className="text-[11px] text-faint">{count} of {RISK_ITEMS.length} indicators selected</span>
                </div>
                <p className={`text-[13px] font-medium leading-relaxed ${c.text}`}>{risk.message}</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-3 text-[11px] font-semibold text-muted hover:text-ink underline underline-offset-2 transition-colors"
                >
                  Reset
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ─── Page export ───────────────────────────────────────────────────────────── */
export default function ProtectPage() {
  return (
    <div id="protect" className="bg-white">
      {/* Page hero */}
      <div className="py-20 md:py-28 border-b border-black/[0.05]">
        <div className="container-wide">
          <FadeIn>
            <p className="section-label mb-3">Public Awareness</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-ink leading-tight mb-5 max-w-3xl">
              Protect Yourself from Money Mule Recruitment
            </h1>
            <p className="text-[16px] text-muted max-w-2xl leading-relaxed">
              Financial crime recruiters deliberately target ordinary people. Understanding the tactics, the legal consequences, and the right actions to take is the first line of defence.
            </p>
          </FadeIn>
        </div>
      </div>

      <WhatIsSection />
      <RedFlagsSection />
      <WhatToDoSection />
      <LegalSection />
      <SelfRiskCheck />
    </div>
  );
}
