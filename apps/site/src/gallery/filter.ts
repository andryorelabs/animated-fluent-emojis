import type { FileUrls, PublicEmoji, SkinTone } from "./public-index";
import { searchEmojis, type SearchEntry } from "./search";

/**
 * Distinct categories in first-seen order.
 * @param emojis - The public index.
 * @returns The category names.
 */
export function listCategories(emojis: readonly PublicEmoji[]): string[] {
  return [...new Set(emojis.map((emoji) => emoji.category))];
}

/**
 * Applies the search and category filters. A blank query keeps index order;
 * otherwise results are ranked by the search index.
 * @param emojis - The public index.
 * @param searchIndex - The locale's search index.
 * @param filters - What the visitor chose.
 * @param filters.query - Search text.
 * @param filters.category - Category name, or none for all.
 * @returns The matching emojis.
 */
export function filterEmojis(
  emojis: readonly PublicEmoji[],
  searchIndex: readonly SearchEntry[],
  filters: { query: string; category: string | undefined },
): PublicEmoji[] {
  const inCategory = (emoji: PublicEmoji) =>
    filters.category === undefined || emoji.category === filters.category;
  if (filters.query.trim() === "") {
    return emojis.filter((emoji) => inCategory(emoji));
  }
  const bySlug = new Map(emojis.map((emoji) => [emoji.slug, emoji]));
  return searchEmojis(searchIndex, filters.query).flatMap((slug) => {
    const emoji = bySlug.get(slug);
    return emoji && inCategory(emoji) ? [emoji] : [];
  });
}

/**
 * Resolves the tone that applies to an emoji.
 * @param emoji - The emoji to check.
 * @param tone - The global tone, if any.
 * @returns The tone when the emoji has that variant, otherwise none.
 */
export function effectiveTone(
  emoji: PublicEmoji,
  tone: SkinTone | undefined,
): SkinTone | undefined {
  return tone !== undefined && emoji.tones.some((variant) => variant.tone === tone)
    ? tone
    : undefined;
}

/**
 * Picks the public file URLs that match the tone applied to an emoji.
 * @param emoji - The emoji whose files are needed.
 * @param tone - The global tone, if any.
 * @returns The URLs of the tone variant, or of the base emoji when it has none.
 */
export function urlsForTone(emoji: PublicEmoji, tone: SkinTone | undefined): FileUrls {
  const appliedTone = effectiveTone(emoji, tone);
  return emoji.tones.find((variant) => variant.tone === appliedTone)?.urls ?? emoji.urls;
}
