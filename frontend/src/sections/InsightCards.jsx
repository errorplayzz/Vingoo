import FadeUp from '../components/FadeUp';

const insights = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12a8 8 0 0116 0A8 8 0 014 12z" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    label: 'Pattern A',
    title: 'Circular Routing',
    description:
      'A → B → C → A. Funds flow in a closed loop as accounts pass money in sequence to obscure origin and make tracing difficult.',
    badge: 'cycle_length_3',
    badgeColor: 'bg-red-50 text-red-600 border-red-100',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 12H7M7 12l5-5M7 12l5 5" />
        <circle cx="20" cy="12" r="2" />
        <circle cx="4" cy="6" r="2" />
        <circle cx="4" cy="12" r="2" />
        <circle cx="4" cy="18" r="2" />
      </svg>
    ),
    label: 'Pattern B',
    title: 'Smurfing Pattern',
    description:
      'Multiple accounts send small, sub-threshold amounts that converge into a single collector, evading automated AML monitoring limits.',
    badge: 'fan_in',
    badgeColor: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h4v4H4zM10 10h4v4h-4zM16 16h4v4h-4z" />
        <path d="M8 6h2a2 2 0 012 2v2M14 12h2a2 2 0 012 2v2" />
      </svg>
    ),
    label: 'Pattern C',
    title: 'Layered Shell Accounts',
    description:
      'Funds pass through a chain of shell accounts with minimal activity, adding layers of indirection before reaching the true beneficiary.',
    badge: 'shell_chain',
    badgeColor: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    label: 'Pattern D',
    title: 'High Velocity Transfers',
    description:
      'An account executes 20 or more transactions within a 24-hour window — a burst pattern inconsistent with normal consumer behavior.',
    badge: 'high_velocity',
    badgeColor: 'bg-orange-50 text-orange-600 border-orange-100',
  },
];

export default function InsightCards() {
  return (
    <section id="insights" className="section-padding bg-[#FAFAFA] border-t border-border">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeUp>
          <div className="max-w-2xl mb-14">
            <p className="text-[12px] font-semibold text-accent tracking-widest uppercase mb-3">
              Pattern Insights
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight leading-tight">
              Four methods.
              <br />
              One detection engine.
            </h2>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {insights.map((item, i) => (
            <FadeUp key={item.title} delay={i * 0.1}>
              <div className="bg-white border border-border rounded-xl p-6 h-full flex flex-col hover:border-accent/30 hover:shadow-sm transition-all duration-300 group">
                {/* Label */}
                <div className="text-[10px] font-semibold text-secondary/50 tracking-widest uppercase mb-4">
                  {item.label}
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent mb-5 group-hover:bg-accent group-hover:text-white transition-colors duration-300">
                  {item.icon}
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-primary mb-3">
                  {item.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-secondary leading-relaxed flex-1 mb-5">
                  {item.description}
                </p>

                {/* Pattern badge */}
                <span className={`inline-flex self-start px-2.5 py-1 border rounded text-[10px] font-mono font-medium ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
