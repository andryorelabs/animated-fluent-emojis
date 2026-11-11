import { observeVisibility } from "../utils/visibility-observer.js";

export interface ImageWiringHandlers {
  onLoad: () => void;
  onAnimationEnd: () => void;
  onVisibilityChange: (isVisible: boolean) => void;
}

/**
 * Wires an emoji image to the playback gate: `load`, `animationend` and
 * viewport visibility. An already-decoded image counts as loaded each time
 * visibility is reported, as the `load` event may have fired before wiring.
 * @param image - The image element.
 * @param handlers - Receives each signal.
 * @returns A function that removes every listener and stops observing.
 */
export const wireEmojiImage = (
  image: HTMLImageElement,
  handlers: ImageWiringHandlers,
): (() => void) => {
  image.addEventListener("animationend", handlers.onAnimationEnd);
  image.addEventListener("load", handlers.onLoad);
  const stopObserving = observeVisibility(image, (isVisible) => {
    handlers.onVisibilityChange(isVisible);
    if (image.complete && image.naturalWidth > 0) handlers.onLoad();
  });
  return () => {
    image.removeEventListener("animationend", handlers.onAnimationEnd);
    image.removeEventListener("load", handlers.onLoad);
    stopObserving();
  };
};
