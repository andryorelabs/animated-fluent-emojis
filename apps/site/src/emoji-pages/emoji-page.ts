import { fileUrl, type PublicEmoji, type SkinTone } from "../gallery/public-index";
import { fillTemplate } from "../gallery/template";
import { localeUrl, type Locale } from "../i18n/locales";
import { lastCommitDate } from "../seo/last-modified";
import type { SitemapSource } from "../seo/sitemap";

/**
 * How many related emojis an emoji page lists at most.
 */
const RELATED_LIMIT = 12;

const VARIATION_SELECTOR_16 = 0xfe_0f;

/**
 * Site path of an emoji page, without a locale prefix.
 * @param slug - The emoji's base slug.
 * @returns The path, with a trailing slash.
 */
export function emojiPagePath(slug: string): string {
  return `/emojis/${slug}/`;
}

/**
 * Site path of an emoji's Open Graph image. It is the same for every locale.
 * @param slug - The emoji's base slug.
 * @returns The path of the generated PNG.
 */
export function ogImagePath(slug: string): string {
  return `/og/${slug}.png`;
}

/**
 * Picks the emojis shown under an emoji page: the ones that follow it in its
 * category, wrapping around, so neighbouring pages link to different sets.
 * @param emoji - The emoji whose page is rendered.
 * @param all - The public index.
 * @param limit - Maximum number of related emojis.
 * @returns Up to `limit` emojis of the same category, never the emoji itself.
 */
export function relatedEmojis(
  emoji: PublicEmoji,
  all: readonly PublicEmoji[],
  limit: number = RELATED_LIMIT,
): PublicEmoji[] {
  const siblings = all.filter((candidate) => candidate.category === emoji.category);
  const position = siblings.findIndex((candidate) => candidate.slug === emoji.slug);
  return [...siblings.slice(position + 1), ...siblings.slice(0, Math.max(position, 0))].slice(
    0,
    limit,
  );
}

/**
 * Finds the emojis before and after an emoji in its category, wrapping around,
 * in the same order as `relatedEmojis`.
 * @param emoji - The emoji whose page is rendered.
 * @param all - The public index.
 * @returns The previous and next emoji, or undefined when the category has no other emoji.
 */
export function neighbourEmojis(
  emoji: PublicEmoji,
  all: readonly PublicEmoji[],
): { previous: PublicEmoji; next: PublicEmoji } | undefined {
  const siblings = all.filter((candidate) => candidate.category === emoji.category);
  const position = siblings.findIndex((candidate) => candidate.slug === emoji.slug);
  if (position === -1 || siblings.length < 2) return undefined;
  const previous = siblings.at(position - 1);
  const next = siblings[(position + 1) % siblings.length];
  return previous && next ? { previous, next } : undefined;
}

/**
 * Builds the schema.org `ImageObject` that describes the emoji's GIF.
 * @param emoji - The emoji whose GIF the object describes.
 * @param name - Its name in the page's locale.
 * @param locale - The page's locale.
 * @returns A JSON-LD object ready to serialise.
 */
export function imageObjectJsonLd(
  emoji: PublicEmoji,
  name: string,
  locale: Locale,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name,
    contentUrl: fileUrl(emoji.urls.gif),
    thumbnailUrl: fileUrl(emoji.urls.png),
    encodingFormat: "image/gif",
    url: localeUrl(locale, emojiPagePath(emoji.slug)),
    keywords: emoji.keywords.join(", "),
  };
}

/**
 * Fills the page title or description pattern with the emoji name.
 * @param pattern - A UI string containing `{name}`.
 * @param name - The emoji's name in the page's locale.
 * @returns The filled text.
 */
export function fillName(pattern: string, name: string): string {
  return fillTemplate(pattern, "name", name);
}

/**
 * Source files that change what an emoji page shows, relative to `apps/site`.
 */
const EMOJI_PAGE_SOURCES = [
  "src/components/EmojiPage.astro",
  "src/emoji-pages",
  "src/pages/emojis/[slug].astro",
] as const;

/**
 * Sitemap source with one localized route per emoji page, dated by the newest
 * emoji page source file. The public index carries no version date.
 * @param load - Loads the public index.
 * @returns A source that lists every base slug in every locale.
 */
export function createEmojiSitemapSource(
  load: () => Promise<readonly PublicEmoji[]>,
): SitemapSource {
  return async () => {
    const emojis = await load();
    const lastmod = lastCommitDate(EMOJI_PAGE_SOURCES);
    return emojis.map((emoji) => ({
      path: emojiPagePath(emoji.slug),
      localized: true,
      lastmod,
    }));
  };
}

/**
 * Formats an emoji's `unicode` as space-separated `U+XXXX` code points. The
 * variation selector U+FE0F is dropped.
 * @param unicode - The emoji sequence, for example a ZWJ sequence.
 * @returns The code points, such as `U+1F468 U+200D U+1F4BB`.
 */
export function formatCodePoint(unicode: string): string {
  return Array.from(unicode, (character) => character.codePointAt(0) ?? 0)
    .filter((codePoint) => codePoint !== VARIATION_SELECTOR_16)
    .map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
}

/**
 * Picks the glyph "Copy emoji" writes to the clipboard.
 * @param emoji - The emoji whose page is rendered.
 * @param tone - The applied skin tone, if any.
 * @returns The toned glyph when the tone's variant has its own unicode,
 * otherwise the base glyph.
 */
export function copyableGlyph(emoji: PublicEmoji, tone: SkinTone | undefined): string {
  const variant = tone ? emoji.tones.find((candidate) => candidate.tone === tone) : undefined;
  return variant?.unicode ?? emoji.unicode;
}
