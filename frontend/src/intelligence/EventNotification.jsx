/**
 * intelligence/EventNotification.jsx
 *
 * Cyber console alert notifications — surfaces during the investigation.
 * Each phase transition emits a system-style event notification for 4 s,
 * then auto-dismisses. Appears top-right below the Navbar.
 *
 * Design language: Intelligence Operating System terminal alerts
 *   • Dark console background with colour-coded left border
 *   • Monospaced event codes (SYS·nnn / ALT·nnn / INF·nnn)
 *   • Slide-in from right edge, exit upward
 *   • Drain bar shows time remaining before auto-dismiss
 *
 * API (unchanged):
 *   <EventNotification phase={phase} />
 */

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence }   from 'framer-motion';
import { PHASE }                     from './useInvestigationPhase';

// ── Event catalogue ───────────────────────────────────────────────────────────
const EVENTS = {
  [PHASE.DATA_INGESTION]: {
    code:   'SYS·001',
    title:  'DATA STREAM ACTIVE',
    detail: 'Ingestion pipeline online',
    accent: '#3B82F6',
    dotCls: 'bg-blue-400',
  },
  [PHASE.ANALYSIS_RUNNING]: {
    code:   'SYS·002',
    title:  'ANALYSIS ENGINE ONLINE',
    detail: 'Graph traversal in progress',
    accent: '#64748B',
    dotCls: 'bg-slate-400',
  },
  [PHASE.PATTERN_DISCOVERY]: {
    code:   'ALT·001',
    title:  'PATTERN DETECTED',
    detail: 'Anomalous structure identified',
    accent: '#F59E0B',
    dotCls: 'bg-amber-400 animate-pulse',
  },
  [PHASE.THREAT_IDENTIFIED]: {
    code:   'ALT·002',
    title:  'THREAT IDENTIFIED',
    detail: 'Fraud ring confirmed — escalating',
    accent: '#EF4444',
    dotCls: 'bg-red-500 animate-pulse',
  },
  [PHASE.NETWORK_REVEALED]: {
    code:   'INF·001',
    title:  'NETWORK REVEALED',
    detail: 'Graph topology decrypted',
    accent: '#8B5CF6',
    dotCls: 'bg-violet-400',
  },
  [PHASE.INVESTIGATION_READY]: {
    code:   'INF·002',
    title:  'INVESTIGATION READY',
    detail: 'Analyst control enabled',
    accent: '#22C55E',
    dotCls: 'bg-green-400',
  },
};

const DISMISS_MS = 4_000;

// ─────────────────────────────────────────────────────────────────────────────

const EventNotification = memo(function EventNotification({ phase }) {
  const [visible,      setVisible]      = useState(false);
  const [displayPhase, setDisplayPhase] = useState(null);
  const [timestamp,    setTimestamp]    = useState('');

  useEffect(() => {
    if (!phase || phase === PHASE.IDLE) {
      setVisible(false);
      return;
    }
    const d = new Date();
    setTimestamp(d.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' }));
    setDisplayPhase(phase);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), DISMISS_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const ev = EVENTS[displayPhase];
  if (!ev) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={displayPhase}
          role="status"
          aria-live="polite"
          style={{
            position:             'fixed',
            top:                  '72px',
            right:                '12px',
            zIndex:               60,
            minWidth:             '272px',
            maxWidth:             '320px',
            background:           'rgba(10,18,38,0.94)',
            backdropFilter:       'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border:               '1px solid rgba(255,255,255,0.07)',
            borderLeft:           `3px solid ${ev.accent}`,
            borderRadius:         '8px',
            overflow:             'hidden',
            boxShadow:            '0 8px 32px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.03)',
          }}
          initial={{ opacity: 0, x: 56,  scale: 0.96 }}
          animate={{ opacity: 1, x: 0,   scale: 1    }}
          exit   ={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Scanline overlay — decorative */}
          <div
            style={{
              position:      'absolute',
              inset:         0,
              background:    'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.012) 4px)',
              pointerEvents: 'none',
            }}
          />

          {/* Content */}
          <div style={{ position: 'relative', padding: '10px 12px 9px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
              <span
                style={{
                  fontFamily:    'ui-monospace,SFMono-Regular,monospace',
                  fontSize:      '9.5px',
                  fontWeight:    700,
                  letterSpacing: '0.14em',
                  color:         ev.accent,
                }}
              >
                {ev.code}
              </span>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${ev.dotCls}`} />
              <span
                style={{
                  fontFamily:    'ui-monospace,SFMono-Regular,monospace',
                  fontSize:      '9px',
                  color:         'rgba(255,255,255,0.22)',
                  letterSpacing: '0.06em',
                  marginLeft:    'auto',
                  marginRight:   '4px',
                }}
              >
                {timestamp}Z
              </span>
              <button
                onClick={() => setVisible(false)}
                aria-label="Dismiss"
                style={{
                  color:      'rgba(255,255,255,0.28)',
                  fontSize:   '10px',
                  lineHeight: 1,
                  cursor:     'pointer',
                  background: 'none',
                  border:     'none',
                  padding:    '1px 2px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Event title */}
            <p
              style={{
                fontFamily:    'ui-monospace,SFMono-Regular,monospace',
                fontSize:      '11px',
                fontWeight:    700,
                letterSpacing: '0.09em',
                color:         '#F1F5F9',
                marginBottom:  '2px',
              }}
            >
              {ev.title}
            </p>

            {/* Detail */}
            <p
              style={{
                fontFamily: 'Inter,system-ui,sans-serif',
                fontSize:   '10.5px',
                color:      'rgba(255,255,255,0.38)',
                lineHeight: 1.45,
              }}
            >
              {ev.detail}
            </p>
          </div>

          {/* Drain progress bar */}
          <motion.div
            style={{
              position:        'absolute',
              bottom:          0,
              left:            0,
              height:          '2px',
              width:           '100%',
              background:      ev.accent,
              opacity:         0.45,
              transformOrigin: 'left',
            }}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: DISMISS_MS / 1000, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default EventNotification;
