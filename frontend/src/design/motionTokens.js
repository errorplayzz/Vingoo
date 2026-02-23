/**
 * design/motionTokens.js
 *
 * Centralised motion constants for the VINGOO intelligence frontend.
 * Import these instead of writing duplicated easing arrays and durations.
 *
 * Usage:
 *   import { EASE_SYSTEM, DURATION_MEDIUM } from '../design/motionTokens';
 *   transition={{ duration: DURATION_MEDIUM, ease: EASE_SYSTEM }}
 */

// ── Cubic-bezier easing curves ────────────────────────────────────────────────

/** Standard material-style ease — most UI transitions */
export const EASE_STANDARD    = [0.4, 0, 0.2, 1];

/** System decelerate — elements arriving / revealing on screen */
export const EASE_SYSTEM      = [0.22, 1, 0.36, 1];

/** Sharp — elements leaving or dismissing */
export const EASE_SHARP       = [0.4, 0, 0.6, 1];

/** Spring overshoot — interactive press feedback, badges, micro-bounces */
export const EASE_SPRING      = [0.34, 1.56, 0.64, 1];

/** Linear — loops, scanning animations, progress bars */
export const EASE_LINEAR      = 'linear';

// ── Duration constants (seconds) ──────────────────────────────────────────────

/** 0.18 s — micro-interactions (hover glow, button press, dot appear) */
export const DURATION_FAST       = 0.18;

/** 0.32 s — standard transitions (panel slide, fade, label swap) */
export const DURATION_MEDIUM     = 0.32;

/** 0.64 s — narrative reveals (section entry, blur lift, takeover banner) */
export const DURATION_SLOW       = 0.64;

/** 0.90 s — cinematic moments (graph reveal, investigation mode enter) */
export const DURATION_CINEMATIC  = 0.90;

/** 1.40 s — camera easing & auto-center zoom transitions */
export const DURATION_CAMERA     = 1.40;

// ── Pre-composed transition objects ──────────────────────────────────────────
// Drop these directly into a Framer Motion `transition` prop.

/** Standard cursor interaction */
export const T_FAST   = { duration: DURATION_FAST,   ease: EASE_STANDARD };

/** Panel / overlay enter / exit */
export const T_MEDIUM = { duration: DURATION_MEDIUM, ease: EASE_SYSTEM   };

/** Section reveal */
export const T_SLOW   = { duration: DURATION_SLOW,   ease: EASE_SYSTEM   };

/** Full-screen cinematic take-over */
export const T_CAMERA = { duration: DURATION_CAMERA, ease: EASE_STANDARD };
