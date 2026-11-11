import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

import { splitLocalePath } from "../i18n/locales";
import { getUi } from "../i18n/ui";
import { buildSocialMeta, SITE_OG_IMAGE_URL } from "../seo/open-graph";
import { buildStructuredData, serializeJsonLd } from "../seo/structured-data";

const REPLACED_KEYS = new Set(["og:locale", "twitter:card"]);

/**
 * Adds the site's social tags and JSON-LD graph to every Starlight docs page,
 * replacing Starlight's own `og:locale`, which is not an Open Graph code, and
 * its `twitter:card`, which the social tags repeat.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { locale, path } = splitLocalePath(context.url.pathname);
  const { meta } = getUi(locale);
  const title = route.entry.data.title;
  const description = route.entry.data.description ?? meta.description;
  const social = buildSocialMeta({
    locale,
    title,
    description,
    image: SITE_OG_IMAGE_URL,
    imageAlt: title,
  }).map(({ attribute, key, content }) => ({
    tag: "meta" as const,
    attrs: { [attribute]: key, content },
  }));
  const structuredData = buildStructuredData({
    locale,
    siteName: meta.siteName,
    title,
    description,
    path,
    trail: [{ name: title, path }],
  });
  route.head = [
    ...route.head.filter(
      ({ attrs }) => !REPLACED_KEYS.has(String(attrs?.property ?? attrs?.name ?? "")),
    ),
    ...social,
    {
      tag: "script",
      attrs: { type: "application/ld+json" },
      content: serializeJsonLd(structuredData),
    },
  ];
});
