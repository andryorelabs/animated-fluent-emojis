import {
  computed,
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type DefineSetupFnComponent,
  type PropType,
  type SlotsType,
  type VNode,
} from "vue";

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
} from "../core/playback-gate.js";
import {
  getManifestSnapshot,
  getServerManifestSnapshot,
  getSpriteSourceSet,
  getSpriteUrl,
  startManifestLoad,
  subscribeToManifest,
  type ManifestSnapshot,
} from "../utils/emoji-manifest.js";
import { isDevelopment } from "../utils/is-development.js";
import { createSharedSubscription } from "../utils/shared-subscription.js";
import type { EmojiManifest, SkinTone } from "../utils/types.js";

/**
 * Props of the Vue `Emoji`, matching the React props that apply to a
 * component. The fallback is the `fallback` slot, and the callbacks are the
 * `load`, `error` and `playbackEnd` events.
 */
export interface EmojiProps {
  /** The unique identifier of the emoji. */
  id: string;
  /** A number of pixels (default 100) or any CSS length. */
  size?: number | string;
  /** Whether to play the animation on hover. Default is false. */
  playOnHover?: boolean;
  /** The number of times to play the animation, or 'infinite'. Default is 2. */
  animationIterations?: number | "infinite";
  /** Whether to automatically play the animation. Default is true. */
  autoPlay?: boolean;
  /** `true` plays, overriding `autoPlay` and reduced motion; `false` pauses. */
  playing?: boolean;
  /** The skin tone, for emojis that support it. Default is 'default'. */
  skinTone?: SkinTone;
  /** Accessible text; an empty string marks the emoji as decorative. */
  alt?: string;
  /** Emitted when the image loads. */
  onLoad?: (event: Event) => void;
  /** Emitted when the image fails, and without an event when the manifest fails. */
  onError?: (event?: Event) => void;
  /** Emitted once when a finite run of `animationIterations` ends. */
  onPlaybackEnd?: () => void;
}

const DEFAULT_SIZE = 100;

const warnedMissingIds = new Set<string>();

const subscribeToOnline = createSharedSubscription((notify) => {
  globalThis.addEventListener("online", notify);
  return () => {
    globalThis.removeEventListener("online", notify);
  };
});

const buildGlyph = (
  emoji: EmojiManifest,
  size: number | string,
  cssSize: string,
  alt: string | undefined,
): VNode =>
  h(
    "span",
    {
      role: "img",
      "aria-label": alt ?? emoji.description,
      style: {
        fontSize: typeof size === "number" ? `${String(size * 0.75)}px` : `calc(${size} * 0.75)`,
        lineHeight: cssSize,
      },
    },
    emoji.unicode,
  );

/**
 * Vue 3 emoji component with the same props and `span > img` markup as the
 * React `Emoji`. Other attributes, including `class`, `style` and `data-*`, go
 * to the root span; `style` is applied after the sizing styles and wins over
 * them. The `fallback` slot replaces the image when it or the manifest fails or
 * the id is unknown, and defaults to the Unicode glyph when known. Events:
 * `load`, `error` (with an event for an image failure, without one for a
 * manifest failure) and `playbackEnd` (once, when a finite run ends). On the
 * server, and while hydrating, it renders an empty placeholder of the final size.
 */
export const Emoji: DefineSetupFnComponent<
  EmojiProps,
  ("load" | "error" | "playbackEnd")[],
  SlotsType<{ fallback?: () => VNode[] }>
> = defineComponent(
  (props: EmojiProps, { attrs, emit, slots }) => {
    const snapshot = shallowRef<ManifestSnapshot>(getServerManifestSnapshot());
    const gate = shallowRef<PlaybackGateState>(createPlaybackGateState());
    const failedSource = shallowRef<string | null>(null);
    const imageElement = shallowRef<HTMLImageElement | null>(null);
    const isDocumentHidden = shallowRef(false);
    const prefersReducedMotion = shallowRef(false);
    let lastSource: string | undefined;
    let hasObservedOwnAttempt = false;
    let hasReportedError = false;

    const emoji = computed(() =>
      snapshot.value.status === "ready" ? (snapshot.value.manifest[props.id] ?? null) : null,
    );
    const spriteSource = computed(() => {
      const entry = emoji.value;
      return entry ? getSpriteUrl(entry, props.skinTone ?? "default") : undefined;
    });
    const size = computed(() => normalizeSize(props.size ?? DEFAULT_SIZE));

    const view = computed(() => {
      const entry = emoji.value;
      if (!entry) return null;
      return resolvePlaybackGate(gate.value, {
        animation: entry.animation,
        playOnHover: props.playOnHover ?? false,
        animationIterations: props.animationIterations ?? 2,
        autoPlayRequested: props.autoPlay ?? true,
        playing: props.playing,
        prefersReducedMotion: prefersReducedMotion.value,
        isDocumentHidden: isDocumentHidden.value,
        size: typeof size.value === "number" ? size.value : "100%",
      });
    });

    watch(
      view,
      (next) => {
        if (next) gate.value = next.state;
      },
      { flush: "sync" },
    );

    const syncSnapshot = (): void => {
      const next = getManifestSnapshot();
      snapshot.value = next;
      if (next.status === "loading") hasObservedOwnAttempt = true;
      if (next.status !== "error") {
        hasReportedError = false;
      } else if (hasObservedOwnAttempt && !hasReportedError) {
        hasReportedError = true;
        emit("error");
      }
    };

    const syncEnvironment = (): void => {
      isDocumentHidden.value = getDocumentHidden();
      prefersReducedMotion.value = getPrefersReducedMotion();
    };

    const setImageElement = (element: unknown): void => {
      imageElement.value = element as HTMLImageElement | null;
    };

    watch(
      imageElement,
      (element, _previous, onCleanup) => {
        if (!element) return;
        const source = spriteSource.value;
        gate.value = lastSource === source ? gateRearmed(gate.value) : gateSourceChanged();
        lastSource = source;
        const unwire = wireEmojiImage(element, {
          onLoad: () => {
            gate.value = gateImageLoaded(gate.value);
          },
          onAnimationEnd: () => {
            const result = gateAnimationEnded(gate.value, view.value?.isFiniteRun ?? false);
            gate.value = result.state;
            if (result.shouldReportEnd) emit("playbackEnd");
          },
          onVisibilityChange: (isVisible) => {
            gate.value = gateVisibilityChanged(gate.value, isVisible);
          },
        });
        onCleanup(unwire);
      },
      { flush: "post" },
    );

    watch(
      () => [snapshot.value.status, props.id] as const,
      ([status, id]) => {
        if (status !== "ready" || emoji.value || !isDevelopment() || warnedMissingIds.has(id))
          return;
        warnedMissingIds.add(id);
        console.warn(`Unknown emoji id "${id}".`);
      },
    );

    const unsubscribers: (() => void)[] = [];
    onMounted(() => {
      syncSnapshot();
      syncEnvironment();
      unsubscribers.push(
        subscribeToManifest(syncSnapshot),
        subscribeToDocumentHidden(syncEnvironment),
        subscribeToReducedMotion(syncEnvironment),
        subscribeToOnline(() => {
          failedSource.value = null;
        }),
      );
      void startManifestLoad();
    });
    onBeforeUnmount(() => {
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
    });

    return (): VNode | null => {
      const cssSize = toCssLength(size.value);
      const rootProps = (className?: string, isHidden = false) =>
        mergeProps(
          {
            style: {
              width: cssSize,
              height: cssSize,
              display: "inline-block",
              overflow: "hidden",
            },
            class: className,
            "aria-hidden": isHidden ? "true" : undefined,
          },
          attrs,
        );

      if (snapshot.value.status !== "ready" && snapshot.value.status !== "error") {
        return h("span", rootProps(undefined, true));
      }

      const renderFallback = (children: VNode[] | VNode): VNode =>
        h("span", rootProps(undefined, props.alt === ""), children);

      const entry = emoji.value;
      const customFallback = slots.fallback;
      if (!entry) {
        return customFallback ? renderFallback(customFallback()) : null;
      }

      const source = spriteSource.value;
      if (source === undefined) return null;
      if (failedSource.value === source) {
        if (customFallback) return renderFallback(customFallback());
        return entry.unicode
          ? renderFallback(buildGlyph(entry, size.value, cssSize, props.alt))
          : null;
      }

      const skinTone = props.skinTone ?? "default";
      const currentView = view.value;
      const isHoverReady = currentView?.isInitialAnimationComplete === true && props.playOnHover;
      return h(
        "span",
        rootProps(isHoverReady ? styles.animateOnHover : undefined, props.alt === ""),
        [
          h("img", {
            key: source,
            ref: setImageElement,
            alt: props.alt ?? entry.description,
            loading: "lazy",
            decoding: "async",
            draggable: "false",
            src: source,
            srcset: getSpriteSourceSet(entry, skinTone),
            sizes: typeof size.value === "number" ? cssSize : undefined,
            style: currentView?.style,
            class: styles.emojiImage,
            onLoad: (event: Event) => {
              emit("load", event);
            },
            onError: (event: Event) => {
              failedSource.value = source;
              emit("error", event);
            },
          }),
        ],
      );
    };
  },
  {
    name: "Emoji",
    inheritAttrs: false,
    props: {
      id: { type: String, required: true },
      size: { type: [Number, String], default: undefined },
      playOnHover: { type: Boolean, default: undefined },
      animationIterations: {
        type: [Number, String] as PropType<number | "infinite">,
        default: undefined,
      },
      autoPlay: { type: Boolean, default: undefined },
      playing: { type: Boolean, default: undefined },
      skinTone: { type: String as PropType<SkinTone>, default: undefined },
      alt: { type: String, default: undefined },
    },
    emits: ["load", "error", "playbackEnd"],
    slots: {},
  },
);
