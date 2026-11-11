/**
 * Supported locale codes, as BCP 47 tags with the canonical casing.
 */
export const LOCALES = ["en", "es", "de", "fr", "it", "ja", "ko", "pt-BR", "ru", "zh-CN"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English is served at the site root; every other locale gets a path prefix.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * The site origin, used to build absolute `hreflang` and canonical URLs.
 */
export const SITE_ORIGIN = "https://animated-fluent-emojis.andryore.dev";

/**
 * Each locale's name in its own language, shown by the language switcher.
 * Never translated, so a visitor can find their language from any page.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
  "zh-CN": "简体中文",
};

/**
 * A font subset worth preloading for a locale's first paint.
 */
export type FontPreload = "figtree-latin";

const LATIN_PRELOAD: readonly FontPreload[] = ["figtree-latin"];

/**
 * Per-locale font subsets to preload. Latin locales preload Figtree latin;
 * Russian and the CJK locales render mostly in fallback faces, so they
 * preload nothing.
 */
export const LOCALE_CONFIG: Record<Locale, { preloadFonts: readonly FontPreload[] }> = {
  en: { preloadFonts: LATIN_PRELOAD },
  es: { preloadFonts: LATIN_PRELOAD },
  de: { preloadFonts: LATIN_PRELOAD },
  fr: { preloadFonts: LATIN_PRELOAD },
  it: { preloadFonts: LATIN_PRELOAD },
  ja: { preloadFonts: [] },
  ko: { preloadFonts: [] },
  "pt-BR": { preloadFonts: LATIN_PRELOAD },
  ru: { preloadFonts: [] },
  "zh-CN": { preloadFonts: [] },
};

/**
 * Lowercase URL segment for a locale (`pt-BR` becomes `pt-br`).
 * @param locale - A supported locale.
 * @returns The path segment, without slashes.
 */
export function localeSegment(locale: Locale): string {
  return locale.toLowerCase();
}

/**
 * Resolves a URL segment back to its locale.
 * @param segment - A path segment such as `pt-br`.
 * @returns The locale, or `undefined` when the segment is not a locale.
 */
export function localeFromSegment(segment: string | undefined): Locale | undefined {
  return LOCALES.find((locale) => localeSegment(locale) === segment);
}

/**
 * Site-relative path for a page in a locale, always with a trailing slash.
 * English is the root; the others use the lowercase tag (`/pt-br/`).
 * @param locale - A supported locale.
 * @param path - Locale-independent page path, e.g. `/` or `/gallery/`.
 * @returns The localized path, e.g. `/es/gallery/`.
 */
export function localePath(locale: Locale, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? normalized : `/${localeSegment(locale)}${normalized}`;
}

/**
 * Absolute URL of a localized page.
 * @param locale - A supported locale.
 * @param path - Locale-independent page path.
 * @returns The canonical URL.
 */
export function localeUrl(locale: Locale, path = "/"): string {
  return `${SITE_ORIGIN}${localePath(locale, path)}`;
}

/**
 * Splits a site path into its locale and the locale-independent remainder.
 * @param pathname - A site-relative path such as `/es/gallery/`.
 * @returns The locale and the remaining path.
 */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  const [, first = "", ...rest] = pathname.split("/");
  const locale = localeFromSegment(first);
  return !locale || locale === DEFAULT_LOCALE
    ? { locale: DEFAULT_LOCALE, path: pathname }
    : { locale, path: `/${rest.join("/")}` };
}

/**
 * One `<link rel="alternate" hreflang>` entry.
 */
export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

/**
 * Alternates for every locale plus `x-default`, which points at the English
 * version of the page.
 * @param path - Locale-independent page path.
 * @returns The alternates in locale order, `x-default` last.
 */
export function hreflangAlternates(path = "/"): HreflangAlternate[] {
  return [
    ...LOCALES.map((locale) => ({
      hreflang: locale,
      href: localeUrl(locale, path),
    })),
    { hreflang: "x-default", href: localeUrl(DEFAULT_LOCALE, path) },
  ];
}
