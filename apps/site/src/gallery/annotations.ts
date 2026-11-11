import type { Locale } from "../i18n/locales";
import type { PublicEmoji } from "./public-index";

interface Annotation {
  name: string;
  keywords: string[];
}

export type AnnotationTable = ReadonlyMap<string, Annotation>;

export interface LocalizedEmoji {
  slug: string;
  name: string;
  keywords: string[];
  fellBack: boolean;
}

const CLDR_VERSION = "48.2.0";

/**
 * Unicode CLDR data file that backs each site locale. English comes from the
 * index itself, so it has no entry.
 */
const CLDR_LANGUAGE: Record<Exclude<Locale, "en">, string> = {
  es: "es",
  de: "de",
  fr: "fr",
  it: "it",
  ja: "ja",
  ko: "ko",
  "pt-BR": "pt",
  ru: "ru",
  "zh-CN": "zh",
};

/**
 * Strips emoji presentation selectors so index and CLDR keys compare equal.
 * @param unicode - An emoji sequence.
 * @returns The sequence without `U+FE0F`.
 */
function normalizeUnicode(unicode: string): string {
  return unicode.replaceAll("️", "");
}

/**
 * Reads a CLDR `annotations.json` document into a table keyed by emoji.
 * @param raw - The parsed JSON document.
 * @returns The annotations by emoji.
 * @throws {Error} When the document lacks the CLDR annotations structure.
 */
export function parseCldrAnnotations(raw: unknown): AnnotationTable {
  const document = raw as {
    annotations?: { annotations?: Record<string, unknown> };
  } | null;
  const entries = document?.annotations?.annotations;
  if (!entries) {
    throw new Error("CLDR annotations: unexpected document structure");
  }
  const table = new Map<string, Annotation>();
  for (const [unicode, value] of Object.entries(entries)) {
    const { default: keywords, tts } = value as {
      default?: string[];
      tts?: string[];
    };
    const name = tts?.[0];
    if (name !== undefined && Array.isArray(keywords)) {
      table.set(normalizeUnicode(unicode), { name, keywords });
    }
  }
  return table;
}

const tables = new Map<Locale, Promise<AnnotationTable>>();

async function downloadAnnotations(
  url: string,
  fetcher: (url: string) => Promise<Response>,
): Promise<AnnotationTable> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`CLDR annotations: ${url} answered ${String(response.status)}`);
  }
  return parseCldrAnnotations(await response.json());
}

/**
 * Fetches a locale's CLDR annotations once per build. English resolves to an
 * empty table; a failed download rejects so the build stops.
 * @param locale - The site locale.
 * @param fetcher - Defaults to the global `fetch`; tests inject a stub.
 * @returns The annotation table.
 */
export function loadAnnotations(
  locale: Locale,
  fetcher: (url: string) => Promise<Response> = fetch,
): Promise<AnnotationTable> {
  if (locale === "en") {
    return Promise.resolve(new Map());
  }
  let table = tables.get(locale);
  if (!table) {
    table = downloadAnnotations(
      `https://cdn.jsdelivr.net/npm/cldr-annotations-full@${CLDR_VERSION}/annotations/${CLDR_LANGUAGE[locale]}/annotations.json`,
      fetcher,
    );
    tables.set(locale, table);
  }
  return table;
}

/**
 * Joins annotations to emojis by `unicode`. An emoji without an annotation
 * keeps its English description and keywords.
 * @param emojis - The public index.
 * @param annotations - The locale's annotation table.
 * @returns One localized entry per emoji, in index order.
 */
export function localizeEmojis(
  emojis: readonly PublicEmoji[],
  annotations: AnnotationTable,
): LocalizedEmoji[] {
  return emojis.map((emoji) => {
    const annotation = annotations.get(normalizeUnicode(emoji.unicode));
    return annotation
      ? {
          slug: emoji.slug,
          name: annotation.name,
          keywords: annotation.keywords,
          fellBack: false,
        }
      : {
          slug: emoji.slug,
          name: emoji.description,
          keywords: emoji.keywords,
          fellBack: true,
        };
  });
}
