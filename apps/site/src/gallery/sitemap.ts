import { lastCommitDate } from "../seo/last-modified";
import type { SitemapSource } from "../seo/sitemap";

/**
 * Source files that change what the gallery page shows, relative to
 * `apps/site`.
 */
const GALLERY_SOURCES = [
  "src/components/GalleryPage.astro",
  "src/components/gallery",
  "src/gallery",
  "src/pages/emojis/index.astro",
] as const;

/**
 * Sitemap source for the gallery page, in every locale, dated by the newest
 * gallery source file.
 * @returns The gallery route.
 */
export const gallerySitemapSource: SitemapSource = () => [
  {
    path: "/emojis/",
    localized: true,
    lastmod: lastCommitDate(GALLERY_SOURCES),
  },
];
