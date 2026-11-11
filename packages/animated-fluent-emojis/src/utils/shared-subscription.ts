/**
 * Creates a subscribe function for `useSyncExternalStore` that fans one
 * underlying listener out to every subscriber. The listener is attached when
 * the first subscriber arrives and detached when the last one leaves.
 * @param attach - Attaches the single underlying listener and returns its detach function.
 * @returns A subscribe function that registers a callback and returns its unsubscribe.
 */
export const createSharedSubscription = (
  attach: (notify: () => void) => () => void,
): ((onChange: () => void) => () => void) => {
  const subscribers = new Set<() => void>();
  let detach: (() => void) | undefined;

  const notify = () => {
    for (const subscriber of subscribers) subscriber();
  };

  return (onChange) => {
    subscribers.add(onChange);
    detach ??= attach(notify);
    return () => {
      subscribers.delete(onChange);
      if (subscribers.size > 0) return;
      detach?.();
      detach = undefined;
    };
  };
};
