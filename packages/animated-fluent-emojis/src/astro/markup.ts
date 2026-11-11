import { normalizeSize, toCssLength } from "../core/normalize.js";
import {
  createPlaybackGateState,
  resolvePlaybackGate,
  type PlaybackGateState,
  type PlaybackGateView,
} from "../core/playback-gate.js";

/** Class of the sprite image inside the root span. */
const IMAGE_CLASS = "afe-image";

/** Class added to the root span once on-hover playback takes over. */
export const HOVER_CLASS = "afe-hover";

/** Attribute that marks a root span and carries its JSON configuration. */
export const ROOT_ATTRIBUTE = "data-fluent-emoji";

/** Selects every root span that carries a configuration. */
export const ROOT_SELECTOR = "[data-fluent-emoji]";

/** Selects the inert fallback template inside a root span. */
export const FALLBACK_SELECTOR = "template[data-fluent-emoji-fallback]";

/** Marks the inert `<template>` holding the slotted fallback content. */
const FALLBACK_ATTRIBUTE = "data-fluent-emoji-fallback";

/** What the browser script needs to run playback for one emoji. */
export interface EmojiRuntimeConfig {
  playOnHover: boolean;
  animationIterations: number | "infinite";
  autoPlay: boolean;
  playing?: boolean | undefined;
  size: number | string;
  animation: { framesCount: number; fps: number; firstFrame: number };
  label: string;
  unicode?: string | undefined;
}

/** The environment facts the playback gate reads. */
export interface PlaybackEnvironment {
  prefersReducedMotion: boolean;
  isDocumentHidden: boolean;
}

/**
 * Resolves the playback gate for one emoji.
 * @param config - The emoji configuration.
 * @param state - The gate state tracked so far.
 * @param environment - Reduced-motion and document visibility.
 * @returns The settled view with the image style.
 */
export const resolveImageView = (
  config: EmojiRuntimeConfig,
  state: PlaybackGateState,
  environment: PlaybackEnvironment,
): PlaybackGateView =>
  resolvePlaybackGate(state, {
    animation: config.animation,
    playOnHover: config.playOnHover,
    animationIterations: config.animationIterations,
    autoPlayRequested: config.autoPlay,
    playing: config.playing,
    prefersReducedMotion: environment.prefersReducedMotion,
    isDocumentHidden: environment.isDocumentHidden,
    size: typeof config.size === "number" ? config.size : "100%",
  });

const toKebabCase = (name: string): string =>
  name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * Turns a plain style record into a CSS declaration string, reading a numeric
 * `width` as pixels.
 * @param style - Camel-case or kebab-case CSS properties.
 * @returns Declarations joined by semicolons.
 */
export const toStyleText = (style: Readonly<Record<string, string | number>>): string =>
  Object.entries(style)
    .map(([name, value]) => {
      const text =
        typeof value === "number" && name === "width" ? `${String(value)}px` : String(value);
      return `${toKebabCase(name)}:${text}`;
    })
    .join(";");

/**
 * Escapes text for an HTML attribute value or text node.
 * @param value - The raw text.
 * @returns The text with `&`, `<`, `>` and quotes escaped.
 */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Everything the root span needs besides its content. */
export interface RootOptions {
  size: number | string | undefined;
  alt: string | undefined;
  className: string | undefined;
  style: string | undefined;
  extraClass?: string | undefined;
  config?: EmojiRuntimeConfig | undefined;
}

const buildRoot = (options: RootOptions, content: string): string => {
  const cssSize = toCssLength(normalizeSize(options.size ?? 100));
  const style = [
    toStyleText({
      width: cssSize,
      height: cssSize,
      display: "inline-block",
      overflow: "hidden",
    }),
    options.style,
  ]
    .filter(Boolean)
    .join(";");
  const className = [options.className, options.extraClass].filter(Boolean).join(" ");
  const attributes = [
    options.config ? `${ROOT_ATTRIBUTE}="${escapeHtml(JSON.stringify(options.config))}"` : "",
    className ? `class="${escapeHtml(className)}"` : "",
    `style="${escapeHtml(style)}"`,
    options.alt === "" ? 'aria-hidden="true"' : "",
  ].filter(Boolean);
  return `<span ${attributes.join(" ")}>${content}</span>`;
};

/** The sprite image of a ready emoji. */
export interface ReadyImage {
  source: string;
  sourceSet?: string | undefined;
  alt: string;
}

/**
 * Builds the HTML of a ready emoji: a sized root span holding the sprite
 * image, in the state the playback gate has before the image loads, plus an
 * inert template with the slotted fallback when there is one.
 * @param options - Root attributes, including the runtime configuration.
 * @param image - The sprite source and alternative text.
 * @param fallbackHtml - Rendered `fallback` slot content, or an empty string.
 * @returns The HTML string.
 */
export const buildReadyHtml = (
  options: RootOptions & { config: EmojiRuntimeConfig },
  image: ReadyImage,
  fallbackHtml: string,
): string => {
  const view = resolveImageView(options.config, createPlaybackGateState(), {
    prefersReducedMotion: false,
    isDocumentHidden: false,
  });
  const sizes = typeof options.config.size === "number" ? toCssLength(options.config.size) : "";
  const attributes = [
    `class="${IMAGE_CLASS}"`,
    `alt="${escapeHtml(image.alt)}"`,
    `src="${escapeHtml(image.source)}"`,
    image.sourceSet ? `srcset="${escapeHtml(image.sourceSet)}"` : "",
    sizes ? `sizes="${escapeHtml(sizes)}"` : "",
    'loading="lazy"',
    'decoding="async"',
    'draggable="false"',
    `style="${escapeHtml(toStyleText(view.style))}"`,
  ].filter(Boolean);
  const template = fallbackHtml ? `<template ${FALLBACK_ATTRIBUTE}>${fallbackHtml}</template>` : "";
  return buildRoot(
    {
      ...options,
      extraClass:
        view.isInitialAnimationComplete && options.config.playOnHover ? HOVER_CLASS : undefined,
    },
    `<img ${attributes.join(" ")}>${template}`,
  );
};

/**
 * Builds the HTML shown when the id is unknown or the manifest failed: the
 * slotted fallback inside a sized span, or nothing without one.
 * @param options - Root attributes.
 * @param fallbackHtml - Rendered `fallback` slot content, or an empty string.
 * @returns The HTML string, empty when there is no fallback.
 */
export const buildFallbackHtml = (options: RootOptions, fallbackHtml: string): string =>
  fallbackHtml ? buildRoot(options, fallbackHtml) : "";
