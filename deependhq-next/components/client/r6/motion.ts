// components/client/r6/motion.ts : shared motion gates for round 6 effects.
// Browser-only helpers. Call inside useEffect or event handlers, never at
// module scope or during render (they touch window.matchMedia).

export const R6_MOTION_OK = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

export const R6_POINTER_FINE = (): boolean =>
  window.matchMedia("(pointer: fine)").matches;
