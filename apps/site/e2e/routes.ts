import { docRoute } from "../src/docs/published";
import { localePath, LOCALES } from "../src/i18n/locales";

/**
 * Emoji slugs whose pages the specs sample.
 */
const SAMPLED_EMOJI_SLUGS = ["fire", "waving-hand"] as const;

/**
 * Routes sampled in every locale: landing, gallery, two emoji pages and five
 * docs pages.
 */
export const SAMPLED_PATHS = LOCALES.flatMap((locale) => [
  localePath(locale),
  localePath(locale, "/emojis/"),
  ...SAMPLED_EMOJI_SLUGS.map((slug) => localePath(locale, `/emojis/${slug}/`)),
  docRoute(locale, "usage.md"),
  docRoute(locale, "guide/frameworks.md"),
  docRoute(locale, "guide/behavior.md"),
  docRoute(locale, "troubleshooting.md"),
  docRoute(locale, "how-to/use-with-nextjs.md"),
]);
