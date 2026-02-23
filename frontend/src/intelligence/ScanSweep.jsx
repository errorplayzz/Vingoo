/**
 * intelligence/ScanSweep.jsx
 *
 * A horizontally-sweeping scan line that overlays the analysis loading state.
 * Communicates active system scanning without disrupting the underlying UI.
 *
 * Purely presentational — no state, no side-effects.
 * Renders null when `active` is false so it has zero cost outside upload.
 *
 * Usage:
 *   <div className="relative">
 *     <LoadingPanel ... />
 *     <ScanSweep active={isLoading} />
 *   </div>
 */

import { memo }   from 'react';
import { motion } from 'framer-motion';

const ScanSweep = memo(function ScanSweep({ active = false }) {
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
      aria-hidden
      style={{ zIndex: 5 }}
    >
      {/* Primary sweep line */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(29,78,216,0.18) 15%, rgba(29,78,216,0.55) 50%, rgba(29,78,216,0.18) 85%, transparent 100%)',
        }}
        initial={{ top: '0%' }}
        animate={{ top: '100%' }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: 'linear',
          repeatDelay: 0.5,
        }}
      />

      {/* Luminous glow trail below the sweep line */}
      <motion.div
        className="absolute left-0 right-0"
        style={{
          height: 64,
          background:
            'linear-gradient(180deg, rgba(29,78,216,0.06) 0%, transparent 100%)',
          marginTop: -64,
        }}
        initial={{ top: 0 }}
        animate={{ top: '100%' }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: 'linear',
          repeatDelay: 0.5,
        }}
      />

      {/* Corner scanner indicators — top-left and top-right L-brackets */}
      {[
        'top-3 left-3 border-t border-l',
        'top-3 right-3 border-t border-r',
        'bottom-3 left-3 border-b border-l',
        'bottom-3 right-3 border-b border-r',
      ].map((cls, i) => (
        <motion.div
          key={i}
          className={`absolute w-4 h-4 border-accent/40 ${cls}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
});

export default ScanSweep;
