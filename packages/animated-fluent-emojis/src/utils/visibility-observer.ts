type VisibilityCallback = (isVisible: boolean) => void;

const callbacks = new WeakMap<Element, VisibilityCallback>();
const shared: { observer?: IntersectionObserver } = {};

const getSharedObserver = (): IntersectionObserver | undefined => {
  if (typeof IntersectionObserver === "undefined") return;
  shared.observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      callbacks.get(entry.target)?.(entry.isIntersecting);
    }
  });
  return shared.observer;
};

/**
 * Reports whether an element intersects the viewport through one
 * IntersectionObserver shared by every emoji, created on first use.
 * Where IntersectionObserver is unavailable (server, old browsers) the element
 * is reported visible once so playback is never blocked.
 * @param element - The element to watch.
 * @param callback - Called with the current visibility, first on the initial observation and then on every change.
 * @returns A function that stops watching the element.
 */
export const observeVisibility = (element: Element, callback: VisibilityCallback): (() => void) => {
  const observer = getSharedObserver();
  callbacks.set(element, callback);
  if (observer) observer.observe(element);
  else callback(true);
  return () => {
    callbacks.delete(element);
    observer?.unobserve(element);
  };
};
