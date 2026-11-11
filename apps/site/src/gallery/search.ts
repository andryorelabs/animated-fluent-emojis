import { localizeEmojis, type AnnotationTable } from "./annotations";
import type { PublicEmoji } from "./public-index";

/**
 * One row of the client search index. The English fields are present only
 * when they differ from the localized ones.
 */
export interface SearchEntry {
  slug: string;
  name: string;
  keywords: string[];
  englishName?: string;
  englishKeywords?: string[];
}

/**
 * Normalizes text for matching: lowercase, NFC and without Latin accents.
 * @param text - Text to normalize.
 * @returns The comparable form.
 */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replaceAll(/[̀-ͯ]/g, "").normalize("NFC").toLocaleLowerCase().trim();
}

/**
 * Builds the compact search index for one locale.
 * @param emojis - The public index.
 * @param annotations - The locale's annotations; empty for English or a
 * locale with none.
 * @returns One row per emoji, in index order.
 */
export function buildSearchIndex(
  emojis: readonly PublicEmoji[],
  annotations: AnnotationTable,
): SearchEntry[] {
  const localized = localizeEmojis(emojis, annotations);
  return localized.map((entry, position) => {
    const source = emojis[position];
    const row: SearchEntry = {
      slug: entry.slug,
      name: entry.name,
      keywords: entry.keywords,
    };
    if (source && !entry.fellBack) {
      row.englishName = source.description;
      row.englishKeywords = source.keywords;
    }
    return row;
  });
}

const SCORES = {
  exactName: 100,
  exactEnglishName: 90,
  prefixName: 80,
  prefixEnglishName: 70,
  exactKeyword: 60,
  exactEnglishKeyword: 50,
  prefixKeyword: 40,
  prefixEnglishKeyword: 30,
  containsName: 20,
} as const;

function scoreEntry(entry: SearchEntry, query: string): number {
  const name = normalizeText(entry.name);
  const englishName = normalizeText(entry.englishName ?? "");
  const keywords = entry.keywords.map((keyword) => normalizeText(keyword));
  const englishKeywords = (entry.englishKeywords ?? []).map((keyword) => normalizeText(keyword));
  const candidates: number[] = [0];
  if (name === query) candidates.push(SCORES.exactName);
  if (englishName === query) candidates.push(SCORES.exactEnglishName);
  if (name.startsWith(query)) candidates.push(SCORES.prefixName);
  if (englishName.startsWith(query)) candidates.push(SCORES.prefixEnglishName);
  if (keywords.includes(query)) candidates.push(SCORES.exactKeyword);
  if (englishKeywords.includes(query)) {
    candidates.push(SCORES.exactEnglishKeyword);
  }
  if (keywords.some((keyword) => keyword.startsWith(query))) {
    candidates.push(SCORES.prefixKeyword);
  }
  if (englishKeywords.some((keyword) => keyword.startsWith(query))) {
    candidates.push(SCORES.prefixEnglishKeyword);
  }
  if (name.includes(query) || englishName.includes(query)) {
    candidates.push(SCORES.containsName);
  }
  return Math.max(...candidates);
}

/**
 * Ranks entries against a query: exact name, prefix, keyword, with the
 * localized text ahead of the English one at each tier. Ties keep index order.
 * @param index - A locale's search index.
 * @param query - What the visitor typed.
 * @param limit - Maximum number of results.
 * @returns Matching slugs, best first; empty for a blank query.
 */
export function searchEmojis(
  index: readonly SearchEntry[],
  query: string,
  limit = Infinity,
): string[] {
  const needle = normalizeText(query);
  if (needle === "") {
    return [];
  }
  return index
    .map((entry, position) => ({
      slug: entry.slug,
      position,
      score: scoreEntry(entry, needle),
    }))
    .filter((hit) => hit.score > 0)
    .toSorted((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map((hit) => hit.slug);
}
