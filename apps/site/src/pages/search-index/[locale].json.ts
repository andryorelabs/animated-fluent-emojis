import type { APIRoute } from "astro";

import { loadAnnotations } from "../../gallery/annotations";
import { loadPublicIndex } from "../../gallery/public-index";
import { buildSearchIndex } from "../../gallery/search";
import { localeFromSegment, LOCALES, localeSegment } from "../../i18n/locales";

export function getStaticPaths() {
  return LOCALES.map((locale) => ({
    params: { locale: localeSegment(locale) },
  }));
}

export const GET: APIRoute = async ({ params }) => {
  const locale = localeFromSegment(params.locale);
  if (!locale) throw new Error(`Unknown locale "${String(params.locale)}"`);
  const [emojis, annotations] = await Promise.all([loadPublicIndex(), loadAnnotations(locale)]);
  return Response.json(buildSearchIndex(emojis, annotations));
};
