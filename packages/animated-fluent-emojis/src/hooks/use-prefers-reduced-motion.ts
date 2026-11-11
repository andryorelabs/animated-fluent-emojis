import { useSyncExternalStore } from "react";

import { getPrefersReducedMotion, subscribeToReducedMotion } from "../core/environment-signals.js";

const getServerSnapshot = (): boolean => false;

/**
 * Tracks the `prefers-reduced-motion: reduce` media query through one
 * lazily created `MediaQueryList` and one change listener shared by every emoji.
 * @returns Whether the user asked the system to reduce motion.
 */
export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(subscribeToReducedMotion, getPrefersReducedMotion, getServerSnapshot);
