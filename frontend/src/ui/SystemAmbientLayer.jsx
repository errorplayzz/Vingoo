/**
 * ui/SystemAmbientLayer.jsx
 *
 * Ambient intelligence background layer — rendered once at App root.
 * Produces the visual atmosphere of a live cyber command center.
 *
 * Elements (100% CSS + Framer Motion — NO WebGL, NO external libs):
 *   ① Dot-grid    — subtle SVG dot pattern across the viewport
 *   ② Scan beam A — slow top→bottom gradient wash (blue tint)
 *   ③ Scan beam B — counter-direction sweep (indigo tint, delayed)
 *   ④ Vignette    — radial-gradient edge darkening
 *   ⑤ Depth glow  — top-left corner soft blue accent (mission control)
 *
 * Rules:
 *   • pointer-events: none  (NEVER blocks UI interaction)
 *   • z-index: -1           (behind every rendered element)
 *   • position: fixed       (fills viewport; no scroll-height impact)
 *   • will-change: transform on beams only (GPU compositing, low cost)
 */

import { memo } from 'react';
import { motion } from 'framer-motion';

const SystemAmbientLayer = memo(function SystemAmbientLayer() {
  return (
    <div
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        -1,
        pointerEvents: 'none',
        overflow:      'hidden',
      }}
    >
      {/* ① Dot grid — very soft, 32 px pitch */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          inset:    0,
          width:    '100%',
          height:   '100%',
          opacity:  0.28,
        }}
      >
        <defs>
          <pattern
            id="ambient-dot-grid"
            x="0" y="0"
            width="32" height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.8" fill="#94A3B8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-dot-grid)" />
      </svg>

      {/* ② Scan beam A: top → bottom, 14 s cycle, 4 s pause */}
      <motion.div
        style={{
          position:   'absolute',
          left:       0,
          right:      0,
          height:     '260px',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(29,78,216,0.035) 40%, rgba(29,78,216,0.055) 50%, rgba(29,78,216,0.035) 60%, transparent 100%)',
          top:        0,
          willChange: 'transform',
        }}
        animate={{ y: ['-10%', '115%'] }}
        transition={{
          duration:    15,
          ease:        'linear',
          repeat:      Infinity,
          repeatDelay: 5,
        }}
      />

      {/* ③ Scan beam B: bottom → top, offset timing, indigo tint */}
      <motion.div
        style={{
          position:   'absolute',
          left:       0,
          right:      0,
          height:     '140px',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(99,102,241,0.025) 50%, transparent 100%)',
          bottom:     0,
          willChange: 'transform',
        }}
        animate={{ y: ['10%', '-115%'] }}
        transition={{
          duration:    20,
          ease:        'linear',
          repeat:      Infinity,
          repeatDelay: 8,
          delay:       8,
        }}
      />

      {/* ④ Edge vignette — darkens corners for focused center attention */}
      <div
        style={{
          position:   'absolute',
          inset:      0,
          background: 'radial-gradient(ellipse 110% 110% at 50% 50%, transparent 38%, rgba(0,0,0,0.08) 100%)',
        }}
      />

      {/* ⑤ Top-left depth accent — warm blue mission-control glow */}
      <div
        style={{
          position:     'absolute',
          top:          -120,
          left:         -120,
          width:        500,
          height:       500,
          borderRadius: '50%',
          background:   'radial-gradient(ellipse at center, rgba(29,78,216,0.07) 0%, transparent 68%)',
          filter:       'blur(48px)',
        }}
      />

      {/* ⑥ Bottom-right counter-glow — creates depth symmetry */}
      <div
        style={{
          position:     'absolute',
          bottom:       -160,
          right:        -160,
          width:        440,
          height:       440,
          borderRadius: '50%',
          background:   'radial-gradient(ellipse at center, rgba(99,102,241,0.04) 0%, transparent 68%)',
          filter:       'blur(56px)',
        }}
      />
    </div>
  );
});

export default SystemAmbientLayer;
