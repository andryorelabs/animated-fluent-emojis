import { createSharedSubscription } from "../utils/shared-subscription.js";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const shared: { query?: MediaQueryList } = {};

const getSharedQuery = (): MediaQueryList | undefined => {
  if (typeof globalThis.matchMedia !== "function") return undefined;
  shared.query ??= globalThis.matchMedia(REDUCED_MOTION_QUERY);
  return shared.query;
};

/**
 * Subscribes to `visibilitychange` through one listener shared by every emoji.
 */
export const subscribeToDocumentHidden: (onChange: () => void) => () => void =
  createSharedSubscription((notify) => {
    document.addEventListener("visibilitychange", notify);
    return () => {
      document.removeEventListener("visibilitychange", notify);
    };
  });

export const getDocumentHidden = (): boolean => typeof document !== "undefined" && document.hidden;

/**
 * Subscribes to `prefers-reduced-motion` changes through one lazily created
 * `MediaQueryList` and one listener shared by every emoji.
 */
export const subscribeToReducedMotion: (onChange: () => void) => () => void =
  createSharedSubscription((notify) => {
    const query = getSharedQuery();
    query?.addEventListener("change", notify);
    return () => {
      query?.removeEventListener("change", notify);
    };
  });

export const getPrefersReducedMotion = (): boolean => getSharedQuery()?.matches ?? false;
