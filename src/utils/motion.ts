/**
 * True when the reader has asked their system for less motion.
 *
 * Read at the moment a gesture starts rather than subscribed to: every caller
 * is deciding whether to animate one thing that is about to happen, and a
 * setting that changes mid-animation is not worth a listener for.
 *
 * Guarded on both `window` and `matchMedia` because neither exists everywhere
 * this runs — jsdom supplies a `window` without the method.
 */
export const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
