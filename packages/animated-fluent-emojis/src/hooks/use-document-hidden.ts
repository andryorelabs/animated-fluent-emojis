import { useSyncExternalStore } from "react";

import { getDocumentHidden, subscribeToDocumentHidden } from "../core/environment-signals.js";

const noopSubscribe = (): (() => void) => Function.prototype as () => void;
const getNeverHidden = (): boolean => false;

/**
 * Tracks `document.hidden` through one `visibilitychange` listener shared by
 * every emoji. The server snapshot is always `false`.
 * @param isActive - When false the hook stays unsubscribed, reports `false` and never re-renders on tab switches.
 * @returns Whether the document is hidden.
 */
export const useDocumentHidden = (isActive: boolean): boolean =>
  useSyncExternalStore(
    isActive ? subscribeToDocumentHidden : noopSubscribe,
    isActive ? getDocumentHidden : getNeverHidden,
    getNeverHidden,
  );
