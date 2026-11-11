import { LOCALES, SITE_ORIGIN, type Locale } from "../i18n/locales";

const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
  it: "it_IT",
  ja: "ja_JP",
  ko: "ko_KR",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  "zh-CN": "zh_CN",
};

/**
 * Dimensions and MIME type of every generated Open Graph card.
 */
const OG_IMAGE = {
  width: 1200,
  height: 630,
  type: "image/png",
} as const;

/**
 * Absolute URL of the generic site card used by every page that has no card
 * of its own.
 */
export const SITE_OG_IMAGE_URL = `${SITE_ORIGIN}/og-site.png`;

/**
 * Open Graph locale code (`language_TERRITORY`) for a site locale.
 * @param locale - A supported locale code.
 * @returns The code for `og:locale`, e.g. `pt_BR`.
 */
export function ogLocale(locale: Locale): string {
  return OG_LOCALES[locale];
}

/**
 * Open Graph codes of every locale except the given one, for
 * `og:locale:alternate`.
 * @param locale - The page's own locale.
 * @returns The other locales' codes, in site order.
 */
export function ogLocaleAlternates(locale: Locale): string[] {
  return LOCALES.filter((entry) => entry !== locale).map((entry) => ogLocale(entry));
}

/**
 * One `<meta>` tag, keyed by `property` (Open Graph) or `name` (Twitter).
 */
export interface SocialMetaTag {
  attribute: "property" | "name";
  key: string;
  content: string;
}

/**
 * Facts a page feeds into its social tags.
 */
export interface SocialMetaInput {
  locale: Locale;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

/**
 * The social tags a page needs beyond the basic Open Graph set: locale and
 * alternates, the card image with its size, type and alt text, and the full
 * Twitter card.
 * @param input - The page's locale, text and card image.
 * @returns The tags in render order.
 */
export function buildSocialMeta(input: SocialMetaInput): SocialMetaTag[] {
  const og = (key: string, content: string): SocialMetaTag => ({
    attribute: "property",
    key,
    content,
  });
  const twitter = (key: string, content: string): SocialMetaTag => ({
    attribute: "name",
    key,
    content,
  });
  return [
    og("og:locale", ogLocale(input.locale)),
    ...ogLocaleAlternates(input.locale).map((code) => og("og:locale:alternate", code)),
    og("og:image", input.image),
    og("og:image:type", OG_IMAGE.type),
    og("og:image:width", String(OG_IMAGE.width)),
    og("og:image:height", String(OG_IMAGE.height)),
    og("og:image:alt", input.imageAlt),
    twitter("twitter:card", "summary_large_image"),
    twitter("twitter:title", input.title),
    twitter("twitter:description", input.description),
    twitter("twitter:image", input.image),
    twitter("twitter:image:alt", input.imageAlt),
  ];
}
