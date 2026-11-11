import { loadAnnotations, localizeEmojis, type LocalizedEmoji } from "../gallery/annotations";
import { loadPublicIndex, type PublicEmoji } from "../gallery/public-index";
import type { Locale } from "../i18n/locales";

/**
 * Everything an emoji page needs for one locale.
 */
export interface EmojiPageData {
  emojis: PublicEmoji[];
  names: ReadonlyMap<string, LocalizedEmoji>;
}

const cache = new Map<Locale, Promise<EmojiPageData>>();

async function build(locale: Locale): Promise<EmojiPageData> {
  const [emojis, annotations] = await Promise.all([loadPublicIndex(), loadAnnotations(locale)]);
  return {
    emojis,
    names: new Map(localizeEmojis(emojis, annotations).map((entry) => [entry.slug, entry])),
  };
}

/**
 * Loads the index and a locale's localized names once per build, so every
 * emoji page of that locale shares one lookup table.
 * @param locale - The locale whose names to load.
 * @returns The index and the localized entries by slug.
 */
export function loadEmojiPageData(locale: Locale): Promise<EmojiPageData> {
  let data = cache.get(locale);
  if (!data) {
    data = build(locale);
    cache.set(locale, data);
  }
  return data;
}
