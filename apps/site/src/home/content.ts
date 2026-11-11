import type { CodeBlockTab } from "../components/CodeBlock";
import type { PublicEmoji, SkinTone } from "../gallery/public-index";
import {
  generateSnippet,
  type PlayMode,
  type SnippetKind,
  type SnippetOptions,
} from "../gallery/snippets";
import { fillSnippetSlots } from "../highlight/snippet-html";
import {
  createSnippetRenderer,
  type RenderedSnippet,
  type SnippetRenderer,
} from "../highlight/snippet-render";
import { TEMPLATE_KINDS, type TemplateKind } from "../highlight/snippet-template";
import { installCommand, PACKAGE_MANAGERS, type PackageManager } from "../lib/package-manager";

export interface SnippetTab {
  kind: SnippetKind;
  label: string;
}

export interface SnippetTabContent extends SnippetTab {
  code: string;
}

export const SNIPPET_TABS: readonly SnippetTab[] = [
  { kind: "react", label: "React" },
  { kind: "vue", label: "Vue" },
  { kind: "svelte", label: "Svelte" },
  { kind: "astro", label: "Astro" },
  { kind: "element", label: "HTML" },
];

/**
 * Builds the landing page snippet tabs from the snippet generator.
 * @param emoji - The emoji shown in every snippet.
 * @param options - Size, skin tone and play mode passed to the generator.
 * @returns One entry per tab with its code.
 */
export function buildSnippetTabs(
  emoji: PublicEmoji,
  options: SnippetOptions = {},
): SnippetTabContent[] {
  return SNIPPET_TABS.map((tab) => ({
    ...tab,
    code: generateSnippet(emoji, tab.kind, options),
  }));
}

const SHOWN_SIZE = 64;

const rendererCache = new Map<"shared", Promise<SnippetRenderer>>();

function sharedRenderer(): Promise<SnippetRenderer> {
  const cached = rendererCache.get("shared");
  if (cached) return cached;
  const created = createSnippetRenderer();
  rendererCache.set("shared", created);
  return created;
}

const templateCache = new Map<string, Promise<RenderedSnippet>>();

async function highlightTemplate(
  kind: TemplateKind,
  withTone: boolean,
  play: PlayMode,
): Promise<RenderedSnippet> {
  const renderer = await sharedRenderer();
  return renderer.render(kind, withTone, play);
}

function renderTemplate(
  kind: TemplateKind,
  withTone: boolean,
  play: PlayMode,
): Promise<RenderedSnippet> {
  const key = `${kind}:${String(withTone)}:${play}`;
  const cached = templateCache.get(key);
  if (cached) return cached;
  const created = highlightTemplate(kind, withTone, play);
  templateCache.set(key, created);
  return created;
}

/**
 * Builds the highlighted code block tabs of the landing page. Each template is
 * highlighted once and its placeholders are filled with the emoji at build
 * time, so the HTML needs no client work to show the right snippet.
 * @param emoji - The emoji shown in every snippet.
 * @param tone - A skin tone to include in every snippet; none by default.
 * @param size - The size shown in every snippet.
 * @param play - The play mode the snippets express; `'load'` by default.
 * @returns One code block tab per framework.
 */
export async function buildCodeBlockTabs(
  emoji: PublicEmoji,
  tone?: SkinTone,
  size: number = SHOWN_SIZE,
  play: PlayMode = "load",
): Promise<CodeBlockTab[]> {
  return Promise.all(
    buildSnippetTabs(emoji, { size, play, ...(tone && { tone }) }).map(async (tab) => {
      const templated = TEMPLATE_KINDS.find((kind) => kind === tab.kind);
      if (!templated) throw new Error(`no template for ${tab.kind}`);
      const rendered = await renderTemplate(templated, tone !== undefined, play);
      return {
        id: tab.kind,
        label: tab.label,
        code: tab.code,
        html: fillSnippetSlots(rendered.html, {
          id: emoji.id,
          size: String(size),
          unicode: emoji.unicode,
          ...(tone && { tone }),
        }),
      };
    }),
  );
}

export interface EmojiPageTabs {
  plain: CodeBlockTab[];
  toned: CodeBlockTab[];
}

/**
 * Builds the highlighted snippet tabs of an emoji page: one set without a tone
 * attribute and, for an emoji that has skin tones, one with it. The templates
 * are highlighted once per build and shared by every page; only the cheap slot
 * fill runs per emoji.
 * @param emoji - The emoji the page shows.
 * @param size - The size shown in the snippets.
 * @returns The plain tabs and the toned tabs, which are empty without tones.
 */
export async function buildEmojiPageTabs(emoji: PublicEmoji, size: number): Promise<EmojiPageTabs> {
  const firstTone = emoji.tones[0]?.tone;
  return {
    plain: await buildCodeBlockTabs(emoji, undefined, size),
    toned: firstTone ? await buildCodeBlockTabs(emoji, firstTone, size) : [],
  };
}

/**
 * Highlights the install command of every package manager at build time.
 * @returns The highlighted shell markup per package manager.
 */
export async function buildInstallHtml(): Promise<Record<PackageManager, string>> {
  const renderer = await sharedRenderer();
  const entries = await Promise.all(
    PACKAGE_MANAGERS.map(async (manager) => {
      const rendered = await renderer.renderCode(installCommand(manager), "bash");
      return [manager, rendered.html] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<PackageManager, string>;
}

const CODE_POINT_PREFIX = /^[\da-f]+(?:_[\da-f]+)*_/;

/**
 * Finds the emoji a shortcode names: its full id, or its id without the
 * code-point prefix. There are no aliases. It throws when nothing matches or
 * when two ids would answer to the same shortcode, so the build fails instead
 * of showing a demo that does not resolve.
 * @param emojis - The public index.
 * @param shortcode - The code between the colons, such as `fire`.
 * @returns The single matching emoji.
 */
export function resolveShortcodeEmoji(
  emojis: readonly PublicEmoji[],
  shortcode: string,
): PublicEmoji {
  const matches = emojis.filter(
    (emoji) => emoji.id === shortcode || emoji.id.replace(CODE_POINT_PREFIX, "") === shortcode,
  );
  const [match] = matches;
  if (!match) {
    throw new Error(`The public index has no emoji for :${shortcode}:`);
  }
  if (matches.length > 1) {
    throw new Error(`The shortcode :${shortcode}: is ambiguous`);
  }
  return match;
}

/**
 * Checks that every shortcode of a static demo still resolves to the id the
 * demo renders, so a renamed or removed emoji fails the build instead of
 * leaving a stale demo.
 * @param emojis - The public index.
 * @param demo - The shortcodes shown and the full id each one renders.
 */
export function verifyShortcodeDemo(
  emojis: readonly PublicEmoji[],
  demo: readonly { code: string; id: string }[],
): void {
  for (const { code, id } of demo) {
    const resolved = resolveShortcodeEmoji(emojis, code).id;
    if (resolved !== id) {
      throw new Error(`:${code}: resolves to ${resolved}, the demo shows ${id}`);
    }
  }
}

export interface TeaserEmoji {
  id: string;
  hue: number;
}

/**
 * The emojis of the landing gallery teaser, in display order, each with the
 * HSL hue of its glow.
 */
export const TEASER_EMOJIS: readonly TeaserEmoji[] = [
  { id: "fire", hue: 40 },
  { id: "1f4a7_droplet", hue: 235 },
  { id: "1f33f_herb", hue: 145 },
  { id: "heart", hue: 20 },
  { id: "star", hue: 90 },
  { id: "1f52e_crystalball", hue: 305 },
];

export interface PickedTeaserEmoji {
  emoji: PublicEmoji;
  hue: number;
}

/**
 * Picks the emojis of the gallery teaser grid by id. It throws when one is
 * missing, so a renamed or removed emoji fails the build instead of leaving a
 * hole in the grid.
 * @param emojis - The full public index.
 * @param allowMissing - Skip absent emojis instead of throwing, for builds
 * that run on a filtered index.
 * @returns The teaser emojis in display order, each with its glow hue.
 */
export function pickTeaserEmojis(
  emojis: readonly PublicEmoji[],
  allowMissing = false,
): PickedTeaserEmoji[] {
  const byId = new Map(emojis.map((emoji) => [emoji.id, emoji]));
  const picked: PickedTeaserEmoji[] = [];
  for (const { id, hue } of TEASER_EMOJIS) {
    const emoji = byId.get(id);
    if (emoji) picked.push({ emoji, hue });
    else if (!allowMissing) {
      throw new Error(`The public index has no teaser emoji ${id}`);
    }
  }
  return picked;
}

/**
 * Spreads a pick evenly over the index so a fallback shows variety and stays
 * stable between builds.
 * @param emojis - The full public index.
 * @param count - How many emojis to pick.
 * @returns At most `count` distinct emojis.
 */
function spreadEmojis(emojis: readonly PublicEmoji[], count: number): PublicEmoji[] {
  if (emojis.length <= count) return [...emojis];
  const step = emojis.length / count;
  return Array.from({ length: count }, (_, index) => {
    const emoji = emojis[Math.floor(index * step)];
    if (!emoji) throw new Error("spread index out of range");
    return emoji;
  });
}

export interface HomeStat {
  id: "emojis" | "adapters" | "languages" | "license";
  value: string;
}

/**
 * Builds the stats bar entries from real facts. The adapter count is the
 * number of framework snippet tabs, so it follows the adapters the site
 * documents instead of a hardcoded number.
 * @param facts - The real facts the stats show.
 * @param facts.emojiCount - How many emojis the public index holds.
 * @param facts.localeCount - How many languages the site ships.
 * @param facts.license - The license id of the library.
 * @returns The four stats in display order.
 */
export function buildHomeStats(facts: {
  emojiCount: number;
  localeCount: number;
  license: string;
}): HomeStat[] {
  return [
    { id: "emojis", value: String(facts.emojiCount) },
    { id: "adapters", value: String(SNIPPET_TABS.length) },
    { id: "languages", value: String(facts.localeCount) },
    { id: "license", value: facts.license },
  ];
}

/**
 * Single-frame emojis the marquee prefers. The marquee never plays its
 * emojis, so a still sprite looks the same as the first frame of an animated
 * one while weighing a few kilobytes instead of hundreds, which keeps the
 * landing page inside its Lighthouse performance budget.
 */
export const MARQUEE_EMOJI_IDS: readonly string[] = [
  "salute",
  "1f4ab_dizzysymbol",
  "wiltedflower",
  "deciduoustree",
  "1f33a_hibiscus",
  "1f33f_herb",
  "watermelon",
  "1f350_pear",
  "1f35e_bread",
  "1f368_icecream",
  "bubbletea",
  "1f32e_taco",
  "1f356_meatonbone",
  "1f30f_earthglobeasiaaustralia",
  "1f3d6_beachwithumbrella",
  "1f3aa_circustent",
  "1f68d_oncomingbus",
  "1f3a9_tophat",
  "1f511_key",
  "1f4dd_memo",
  "1fa89_harp",
  "1f4c8_chartwithupwardstrend",
  "computer",
  "1f393_graduationcap",
];

/**
 * Picks the emojis of the marquee row. The still emojis of
 * `MARQUEE_EMOJI_IDS` come first; when the index lacks some of them, the rest
 * is filled with emojis spread evenly over the index.
 * @param emojis - The full public index.
 * @param count - How many emojis the row holds.
 * @returns The distinct emojis of the row, fewer when the index is small.
 */
export function pickMarqueeEmojis(emojis: readonly PublicEmoji[], count: number): PublicEmoji[] {
  const byId = new Map(emojis.map((emoji) => [emoji.id, emoji]));
  const preferred = MARQUEE_EMOJI_IDS.flatMap((id) => {
    const emoji = byId.get(id);
    return emoji ? [emoji] : [];
  }).slice(0, count);
  const taken = new Set(preferred.map((emoji) => emoji.id));
  const filler = spreadEmojis(emojis, count + taken.size).filter((emoji) => !taken.has(emoji.id));
  return [...preferred, ...filler].slice(0, count);
}

/**
 * Repeats the picked emojis until one half of the marquee track is wider than
 * `minWidth`, so the loop has no gap and no jump at its seam.
 * @param emojis - The picked emojis of the row.
 * @param itemWidth - The width of one emoji including its gap, in pixels.
 * @param minWidth - The width a half must exceed, in pixels.
 * @returns The emojis of one half, the picked ones repeated whole times.
 */
export function repeatMarqueeEmojis(
  emojis: readonly PublicEmoji[],
  itemWidth: number,
  minWidth: number,
): PublicEmoji[] {
  if (emojis.length === 0) return [];
  const repeats = Math.floor(minWidth / (emojis.length * itemWidth)) + 1;
  return Array.from({ length: repeats }, () => emojis).flat();
}

/** The marquee scroll speed of the landing canvas, in pixels per second. */
export const MARQUEE_SPEED = 47;

/**
 * Computes how long one loop of the marquee takes so the track moves at
 * `MARQUEE_SPEED` whatever the width of one half.
 * @param halfWidth - The width of one half of the track, in pixels.
 * @returns The loop duration in seconds.
 * @throws {RangeError} When `halfWidth` is not a positive finite number.
 */
export function marqueeDurationSeconds(halfWidth: number): number {
  if (!Number.isFinite(halfWidth) || halfWidth <= 0) {
    throw new RangeError("The marquee half width must be positive.");
  }
  return halfWidth / MARQUEE_SPEED;
}
