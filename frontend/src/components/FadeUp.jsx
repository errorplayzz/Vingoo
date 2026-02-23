import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

/**
 * FadeUp — wraps children with a scroll-triggered fade-up animation.
 * Props:
 *   delay  — animation delay in seconds (default 0)
 *   once   — only animate once (default true)
 *   className — extra classes on the wrapper
 */
export default function FadeUp({ children, delay = 0, once = true, className = '' }) {
  const { ref, inView } = useInView({ triggerOnce: once, threshold: 0.15 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
