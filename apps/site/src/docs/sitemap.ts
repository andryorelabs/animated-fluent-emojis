import { lastCommitDate } from "../seo/last-modified";
import type { SitemapSource } from "../seo/sitemap";
import { CHANGELOG_SLUG } from "./changelog-pages";
import { docSlug, PUBLISHED_DOCS } from "./published";

/**
 * Sitemap routes for every published doc and the changelog, listed in every
 * locale because untranslated pages still render the English text. Each route
 * carries the commit date of its source file.
 * @returns The docs routes.
 */
export const docsSitemapSource: SitemapSource = () => [
  ...PUBLISHED_DOCS.map((docPath) => ({
    path: `/${docSlug(docPath)}/`,
    localized: true,
    lastmod: lastCommitDate([`../../docs/${docPath}`]),
  })),
  {
    path: `/${CHANGELOG_SLUG}/`,
    localized: true,
    lastmod: lastCommitDate(["../../CHANGELOG.md"]),
  },
];
