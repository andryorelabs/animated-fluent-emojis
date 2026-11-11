import styles from "../components/Emoji.module.css";
import {
  getDocumentHidden,
  getPrefersReducedMotion,
  subscribeToDocumentHidden,
  subscribeToReducedMotion,
} from "../core/environment-signals.js";
import { wireEmojiImage } from "../core/image-wiring.js";
import { normalizeSize, toCssLength } from "../core/normalize.js";
import {
  createPlaybackGateState,
  gateAnimationEnded,
  gateImageLoaded,
  gateRearmed,
  gateSourceChanged,
  gateVisibilityChanged,
  resolvePlaybackGate,
  type PlaybackGateState,
  type PlaybackGateView,
} from "../core/playback-gate.js";
import {
  getManifestSnapshot,
  getSpriteSourceSet,
  getSpriteUrl,
  startManifestLoad,
  subscribeToManifest,
} from "../utils/emoji-manifest.js";
import { isDevelopment } from "../utils/is-development.js";
import { createSharedSubscription } from "../utils/shared-subscription.js";
import type { EmojiManifest, SkinTone } from "../utils/types.js";

/**
 * What to render in place of the image when it, or the manifest, fails, or the
 * id is unknown: a DOM node, a function that returns one, or `null` for nothing.
 */
export type EmojiFallback = Node | (() => Node) | null;

/**
 * Options of {@link createEmoji}, matching the React `Emoji` props.
 */
export interface EmojiOptions {
  /** The unique identifier of the emoji. */
  id: string;
  /** A number of pixels (default 100) or any CSS length. */
  size?: number | string | undefined;
  /** Whether to play the animation on hover. Default is false. */
  playOnHover?: boolean | undefined;
  /** The number of times to play the animation, or 'infinite'. Default is 2. */
  animationIterations?: number | "infinite" | undefined;
  /** Whether to automatically play the animation. Default is true. */
  autoPlay?: boolean | undefined;
  /** `true` plays, overriding `autoPlay` and reduced motion; `false` pauses. */
  playing?: boolean | undefined;
  /** Called once when a finite run of `animationIterations` ends. */
  onPlaybackEnd?: (() => void) | undefined;
  /** The skin tone, for emojis that support it. Default is 'default'. */
  skinTone?: SkinTone | undefined;
  /** Accessible text; an empty string marks the emoji as decorative. */
  alt?: string | undefined;
  /** Rendered on failure or unknown id. Defaults to the Unicode glyph; `null` renders nothing. */
  fallback?: EmojiFallback | undefined;
  /** Called when the image loads. */
  onLoad?: ((event: Event) => void) | undefined;
  /** Called when the image fails, and without an event when the manifest fails. */
  onError?: ((event?: Event) => void) | undefined;
  /** Class names for the root span. */
  className?: string | undefined;
  /** Inline styles for the root span, applied after the sizing styles. Keys are CSS property names or camelCase. */
  style?: Readonly<Record<string, string>> | undefined;
  /** Extra attributes for the root span, such as `data-*`. */
  attributes?: Readonly<Record<string, string>> | undefined;
}

/**
 * The handle returned by {@link createEmoji}.
 */
export interface EmojiController {
  /** Merges new options and re-renders. Ignored after `destroy`. */
  update: (options: Partial<EmojiOptions>) => void;
  /** Removes the emoji from the host and releases every listener and observer. */
  destroy: () => void;
}

const DEFAULT_SIZE = 100;

const warnedMissingIds = new Set<string>();

const subscribeToOnline = createSharedSubscription((notify) => {
  globalThis.addEventListener("online", notify);
  return () => {
    globalThis.removeEventListener("online", notify);
  };
});

const applyStyle = (
  element: HTMLElement,
  style: Readonly<Record<string, string | number>>,
): void => {
  for (const [name, value] of Object.entries(style)) {
    const text =
      typeof value === "number" ? (name === "width" ? `${String(value)}px` : String(value)) : value;
    if (name.includes("-")) element.style.setProperty(name, text);
    else element.style.setProperty(toKebabCase(name), text);
  }
};

const toKebabCase = (name: string): string =>
  name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const resolveFallback = (fallback: Node | (() => Node)): Node =>
  typeof fallback === "function" ? fallback() : fallback;

/**
 * Renders an animated emoji into a DOM element, with the same `span > img`
 * structure and options as the React `Emoji`. It follows the shared manifest
 * store, shows a sized placeholder while the manifest loads and plays through
 * the framework-free playback core. Importing this module touches no DOM.
 * @param host - The element, document fragment or shadow root the emoji is appended to.
 * @param options - Id, size, playback, accessibility and fallback settings.
 * @returns A controller: `update` merges new options, `destroy` removes the emoji and releases every subscription.
 */
export const createEmoji = (host: ParentNode, options: EmojiOptions): EmojiController => {
  type ContentKind = "placeholder" | "image" | "fallback";

  let current: EmojiOptions = options;
  let isDestroyed = false;
  let root: HTMLSpanElement | null = null;
  let appliedAttributes: string[] = [];
  let contentKind: ContentKind | null = null;
  let image: HTMLImageElement | null = null;
  let imageSource: string | undefined;
  let lastSource: string | undefined;
  let unwireImage: (() => void) | undefined;
  let gate: PlaybackGateState = createPlaybackGateState();
  let view: PlaybackGateView | null = null;
  let failedSource: string | null = null;
  let renderedFallback: EmojiFallback | undefined;
  let hasObservedOwnAttempt = false;
  let hasReportedError = false;

  const detachImage = (): void => {
    unwireImage?.();
    unwireImage = undefined;
    image = null;
    imageSource = undefined;
  };

  const removeRoot = (): void => {
    detachImage();
    root?.remove();
    root = null;
    contentKind = null;
    renderedFallback = undefined;
  };

  const ensureRoot = (): HTMLSpanElement => {
    if (!root) {
      root = document.createElement("span");
      host.append(root);
    }
    return root;
  };

  const styleRoot = (element: HTMLSpanElement, cssSize: string, isPlaceholder: boolean): void => {
    const isDecorative = current.alt === "";
    element.removeAttribute("style");
    for (const name of appliedAttributes) element.removeAttribute(name);
    appliedAttributes = Object.keys(current.attributes ?? {});
    const attributeEntries = Object.entries(current.attributes ?? {});
    for (const [name, value] of attributeEntries) {
      element.setAttribute(name, value);
    }
    applyStyle(element, {
      width: cssSize,
      height: cssSize,
      display: "inline-block",
      overflow: "hidden",
      ...current.style,
    });
    element.ariaHidden = isPlaceholder || isDecorative ? "true" : null;
  };

  const setRootClass = (element: HTMLSpanElement, extra?: string): void => {
    const className = [current.className, extra].filter(Boolean).join(" ");
    element.className = className;
  };

  const showPlaceholder = (cssSize: string): void => {
    const element = ensureRoot();
    styleRoot(element, cssSize, true);
    setRootClass(element);
    if (contentKind === "placeholder") {
      return;
    }

    detachImage();
    element.replaceChildren();
    contentKind = "placeholder";
  };

  const showFallbackContent = (
    cssSize: string,
    build: () => Node | null,
    cacheKey: EmojiFallback | undefined,
  ): void => {
    const element = ensureRoot();
    styleRoot(element, cssSize, false);
    setRootClass(element);
    if (contentKind === "fallback" && renderedFallback === cacheKey) return;
    detachImage();
    const content = build();
    element.replaceChildren(...(content ? [content] : []));
    contentKind = "fallback";
    renderedFallback = cacheKey;
  };

  const buildGlyph = (
    emoji: EmojiManifest,
    size: number | string,
    cssSize: string,
  ): Node | null => {
    if (!emoji.unicode) return null;
    const glyph = document.createElement("span");
    glyph.setAttribute("role", "img");
    glyph.setAttribute("aria-label", current.alt ?? emoji.description);
    glyph.style.fontSize =
      typeof size === "number" ? `${String(size * 0.75)}px` : `calc(${size} * 0.75)`;
    glyph.style.lineHeight = cssSize;
    glyph.textContent = emoji.unicode;
    return glyph;
  };

  const reportEnd = (): void => {
    const result = gateAnimationEnded(gate, view?.isFiniteRun ?? false);
    gate = result.state;
    render();
    if (result.shouldReportEnd) current.onPlaybackEnd?.();
  };

  const createImage = (emoji: EmojiManifest, source: string): HTMLImageElement => {
    const element = document.createElement("img");
    element.loading = "lazy";
    element.decoding = "async";
    element.draggable = false;
    element.className = styles.emojiImage ?? "";
    element.addEventListener("load", (event) => {
      if (element !== image) return;
      current.onLoad?.(event);
    });
    element.addEventListener("error", (event) => {
      if (element !== image) return;
      failedSource = source;
      render();
      current.onError?.(event);
    });
    element.alt = current.alt ?? emoji.description;
    return element;
  };

  const showImage = (
    emoji: EmojiManifest,
    source: string,
    size: number | string,
    cssSize: string,
  ): void => {
    const element = ensureRoot();
    const isNewImage = !image || imageSource !== source;
    if (isNewImage) {
      gate = lastSource === source ? gateRearmed(gate) : gateSourceChanged();
      lastSource = source;
      detachImage();
      image = createImage(emoji, source);
      imageSource = source;
      contentKind = "image";
      element.replaceChildren(image);
    }
    const currentImage = image;
    if (!currentImage) return;
    currentImage.alt = current.alt ?? emoji.description;
    const sourceSet = getSpriteSourceSet(emoji, current.skinTone);
    const nextSizes = typeof size === "number" ? cssSize : null;
    if (currentImage.srcset !== (sourceSet ?? "")) {
      currentImage.srcset = sourceSet ?? "";
    }
    if (currentImage.getAttribute("sizes") !== nextSizes) {
      if (nextSizes === null) currentImage.removeAttribute("sizes");
      else currentImage.sizes = nextSizes;
    }
    if (isNewImage) currentImage.src = source;

    view = resolvePlaybackGate(gate, {
      animation: emoji.animation,
      playOnHover: current.playOnHover ?? false,
      animationIterations: current.animationIterations ?? 2,
      autoPlayRequested: current.autoPlay ?? true,
      playing: current.playing,
      prefersReducedMotion: getPrefersReducedMotion(),
      isDocumentHidden: getDocumentHidden(),
      size: typeof size === "number" ? size : "100%",
    });
    gate = view.state;
    currentImage.removeAttribute("style");
    applyStyle(currentImage, view.style);

    styleRoot(element, cssSize, false);
    setRootClass(
      element,
      view.isInitialAnimationComplete && current.playOnHover ? styles.animateOnHover : undefined,
    );

    if (isNewImage) {
      unwireImage = wireEmojiImage(currentImage, {
        onLoad: () => {
          const next = gateImageLoaded(gate);
          if (next === gate) return;
          gate = next;
          render();
        },
        onAnimationEnd: reportEnd,
        onVisibilityChange: (isVisible) => {
          const next = gateVisibilityChanged(gate, isVisible);
          if (next === gate) return;
          gate = next;
          render();
        },
      });
    }
  };

  function render(): void {
    if (isDestroyed) return;
    const size = normalizeSize(current.size ?? DEFAULT_SIZE);
    const cssSize = toCssLength(size);
    const snapshot = getManifestSnapshot();

    if (snapshot.status === "loading") hasObservedOwnAttempt = true;
    if (snapshot.status !== "error") hasReportedError = false;
    else if (hasObservedOwnAttempt && !hasReportedError) {
      hasReportedError = true;
      current.onError?.();
    }

    if (snapshot.status !== "ready") {
      if (snapshot.status === "error") {
        renderFallbackOrNothing(cssSize);
      } else {
        showPlaceholder(cssSize);
      }
      return;
    }

    const emoji = snapshot.manifest[current.id];
    if (!emoji) {
      if (isDevelopment() && !warnedMissingIds.has(current.id)) {
        warnedMissingIds.add(current.id);
        console.warn(`Unknown emoji id "${current.id}".`);
      }
      renderFallbackOrNothing(cssSize);
      return;
    }

    const source = getSpriteUrl(emoji, current.skinTone);
    if (failedSource === source) {
      const { fallback } = current;
      if (fallback === null) {
        removeRoot();
      } else if (fallback === undefined) {
        if (emoji.unicode) {
          showFallbackContent(cssSize, () => buildGlyph(emoji, size, cssSize), undefined);
        } else {
          removeRoot();
        }
      } else {
        showFallbackContent(cssSize, () => resolveFallback(fallback), fallback);
      }
      return;
    }
    showImage(emoji, source, size, cssSize);
  }

  function renderFallbackOrNothing(cssSize: string): void {
    const { fallback } = current;
    if (fallback === undefined || fallback === null) {
      removeRoot();
      return;
    }
    showFallbackContent(cssSize, () => resolveFallback(fallback), fallback);
  }

  const unsubscribers = [
    subscribeToManifest(render),
    subscribeToDocumentHidden(render),
    subscribeToReducedMotion(render),
    subscribeToOnline(() => {
      if (failedSource === null) return;
      failedSource = null;
      render();
    }),
  ];

  render();
  void startManifestLoad();

  return {
    update: (next) => {
      if (isDestroyed) return;
      current = { ...current, ...next };
      render();
    },
    destroy: () => {
      if (isDestroyed) return;
      isDestroyed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
      removeRoot();
    },
  };
};
