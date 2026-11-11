import {
  getDocumentHidden,
  getPrefersReducedMotion,
  subscribeToDocumentHidden,
  subscribeToReducedMotion,
} from "../core/environment-signals.js";
import { wireEmojiImage } from "../core/image-wiring.js";
import { toCssLength } from "../core/normalize.js";
import {
  createPlaybackGateState,
  gateAnimationEnded,
  gateImageLoaded,
  gateVisibilityChanged,
  type PlaybackGateState,
} from "../core/playback-gate.js";
import {
  FALLBACK_SELECTOR,
  HOVER_CLASS,
  resolveImageView,
  ROOT_ATTRIBUTE,
  ROOT_SELECTOR,
  toStyleText,
  type EmojiRuntimeConfig,
} from "./markup.js";

const doNothing = (): void => {
  return;
};

const hydratedRoots = new WeakSet<Element>();

const readConfig = (root: Element): EmojiRuntimeConfig | null => {
  const text = root.getAttribute(ROOT_ATTRIBUTE);
  if (!text) return null;
  try {
    return JSON.parse(text) as EmojiRuntimeConfig;
  } catch {
    return null;
  }
};

const emit = (root: Element, type: string): void => {
  root.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
};

const buildGlyph = (config: EmojiRuntimeConfig): Node | null => {
  if (!config.unicode) return null;
  const cssSize = toCssLength(config.size);
  const glyph = document.createElement("span");
  glyph.setAttribute("role", "img");
  glyph.setAttribute("aria-label", config.label);
  glyph.style.fontSize =
    typeof config.size === "number"
      ? `${String(config.size * 0.75)}px`
      : `calc(${config.size} * 0.75)`;
  glyph.style.lineHeight = cssSize;
  glyph.textContent = config.unicode;
  return glyph;
};

const buildFallback = (root: Element, config: EmojiRuntimeConfig): Node | null => {
  const template = root.querySelector<HTMLTemplateElement>(FALLBACK_SELECTOR);
  return template ? template.content.cloneNode(true) : buildGlyph(config);
};

/**
 * Starts playback for one server-rendered emoji: it adopts the emitted image,
 * runs the shared playback gate against it and follows reduced motion, tab
 * visibility and later changes of the configuration attribute. A failed
 * image is replaced by the slotted fallback or the Unicode glyph.
 * @param root - The root span carrying the `data-fluent-emoji` attribute.
 * @returns A function that removes every listener and observer.
 */
export const hydrateEmoji = (root: HTMLElement): (() => void) => {
  let config = readConfig(root);
  const image = root.querySelector("img");
  if (!config || !image || hydratedRoots.has(root)) return doNothing;
  hydratedRoots.add(root);

  let gate: PlaybackGateState = createPlaybackGateState();
  let isFailed = false;

  const render = (): void => {
    if (!config || isFailed) return;
    const view = resolveImageView(config, gate, {
      prefersReducedMotion: getPrefersReducedMotion(),
      isDocumentHidden: getDocumentHidden(),
    });
    gate = view.state;
    image.setAttribute("style", toStyleText(view.style));
    root.classList.toggle(HOVER_CLASS, view.isInitialAnimationComplete && config.playOnHover);
  };

  const fail = (): void => {
    if (!config || isFailed) return;
    isFailed = true;
    unwire();
    const content = buildFallback(root, config);
    root.classList.remove(HOVER_CLASS);
    root.replaceChildren(...(content ? [content] : []));
    if (!content) root.setAttribute("aria-hidden", "true");
    emit(root, "emoji-error");
  };

  const unwire = wireEmojiImage(image, {
    onLoad: () => {
      emit(root, "emoji-load");
      const next = gateImageLoaded(gate);
      if (next === gate) return;
      gate = next;
      render();
    },
    onAnimationEnd: () => {
      if (!config) return;
      const finite = resolveImageView(config, gate, {
        prefersReducedMotion: getPrefersReducedMotion(),
        isDocumentHidden: getDocumentHidden(),
      }).isFiniteRun;
      const result = gateAnimationEnded(gate, finite);
      gate = result.state;
      render();
      if (result.shouldReportEnd) emit(root, "playback-end");
    },
    onVisibilityChange: (isVisible) => {
      const next = gateVisibilityChanged(gate, isVisible);
      if (next === gate) return;
      gate = next;
      render();
    },
  });
  image.addEventListener("error", fail);
  if (image.complete && image.naturalWidth === 0 && image.currentSrc) fail();

  const observer = new MutationObserver(() => {
    config = readConfig(root) ?? config;
    render();
  });
  observer.observe(root, {
    attributes: true,
    attributeFilter: [ROOT_ATTRIBUTE],
  });
  const unsubscribers = [subscribeToDocumentHidden(render), subscribeToReducedMotion(render)];
  render();

  return () => {
    unwire();
    image.removeEventListener("error", fail);
    observer.disconnect();
    for (const unsubscribe of unsubscribers) unsubscribe();
    hydratedRoots.delete(root);
  };
};

/**
 * Hydrates every server-rendered emoji under a scope that is not hydrated yet.
 * @param scope - Where to look; defaults to the whole document.
 * @returns A function that stops every emoji it started.
 */
export const hydrateEmojis = (scope: ParentNode = document): (() => void) => {
  const stops = Array.from(scope.querySelectorAll<HTMLElement>(ROOT_SELECTOR), (root) =>
    hydrateEmoji(root),
  );
  return () => {
    for (const stop of stops) stop();
  };
};

if (typeof document !== "undefined") {
  hydrateEmojis();
  document.addEventListener("astro:page-load", () => {
    hydrateEmojis();
  });
}
