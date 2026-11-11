import type { PublicEmoji, SkinTone } from "../gallery/public-index";
import {
  generateSnippet,
  type PlayMode,
  type SnippetKind,
  type SnippetOptions,
} from "../gallery/snippets";

export const SNIPPET_SLOTS = ["id", "size", "tone", "unicode"] as const;

export type SnippetSlot = (typeof SNIPPET_SLOTS)[number];

export type SnippetSlotValues = Record<SnippetSlot, string>;

export const TEMPLATE_KINDS = [
  "react",
  "vue",
  "svelte",
  "astro",
  "element",
] as const satisfies readonly SnippetKind[];

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/**
 * The text each slot holds in a template. They are alphanumeric so every
 * grammar scans them as one word or number inside a string or number literal.
 */
export const SLOT_SENTINELS: SnippetSlotValues = {
  id: "EMOJIID",
  size: "99999",
  tone: "TONEX",
  unicode: "UNICODEX",
};

export const TEMPLATE_LANGUAGES: Record<TemplateKind, string> = {
  react: "tsx",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  element: "html",
};

const EMPTY_URLS = { gif: "", webp: "", png: "" };

const SENTINEL_EMOJI: PublicEmoji = {
  slug: "sentinel",
  id: SLOT_SENTINELS.id,
  description: "sentinel",
  unicode: SLOT_SENTINELS.unicode,
  category: "sentinel",
  keywords: [],
  urls: EMPTY_URLS,
  tones: [
    {
      tone: SLOT_SENTINELS.tone as SkinTone,
      slug: "sentinel-tone",
      urls: EMPTY_URLS,
    },
  ],
};

/**
 * Builds the plain text of a snippet template by running `generateSnippet` on a
 * sentinel emoji, so the structure can never drift from the copied text.
 * @param kind - The adapter to template.
 * @param withTone - Whether the structural variant includes the tone attribute.
 * @param play - The play mode variant; `'load'` adds no attributes.
 * @returns The template text with each slot holding its sentinel.
 */
export function snippetTemplateText(
  kind: TemplateKind,
  withTone: boolean,
  play: PlayMode = "load",
): string {
  const options: SnippetOptions = {
    size: Number(SLOT_SENTINELS.size),
    play,
    ...(withTone && { tone: SLOT_SENTINELS.tone as SkinTone }),
  };
  return generateSnippet(SENTINEL_EMOJI, kind, options);
}
