import { localePath, type Locale } from "../i18n/locales";
import { REPOSITORY_URL } from "../site-links";

/**
 * Docs published on the site, as paths relative to the repository `docs/`
 * folder, in sidebar order. Everything else in `docs/` (ADRs, brand,
 * maintainer guides, emoji lists) stays on GitHub.
 */
export const PUBLISHED_DOCS = [
  "usage.md",
  "guide/frameworks.md",
  "guide/props.md",
  "guide/behavior.md",
  "guide/assets.md",
  "guide/lookup.md",
  "guide/types.md",
  "troubleshooting.md",
  "how-to/use-with-angular.md",
  "how-to/use-with-nextjs.md",
  "how-to/use-with-preact.md",
  "how-to/use-with-solid.md",
  "how-to/preload-for-a-picker.md",
  "how-to/self-host-the-assets.md",
  "how-to/use-without-code.md",
] as const;

export type PublishedDocument = (typeof PUBLISHED_DOCS)[number];

/**
 * Whether a docs-relative path is on the published allowlist.
 * @param docPath - A path relative to `docs/`, such as `usage.md`.
 * @returns True when the doc is rendered on the site.
 */
export function isPublishedDocument(docPath: string): docPath is PublishedDocument {
  return (PUBLISHED_DOCS as readonly string[]).includes(docPath);
}

/**
 * Locale-independent content slug of a published doc. `usage.md` is the docs
 * home, so it takes the bare `docs` slug.
 * @param docPath - A published doc path relative to `docs/`.
 * @returns The slug, such as `docs` or `docs/how-to/use-with-solid`.
 */
export function docSlug(docPath: string): string {
  return docPath === "usage.md" ? "docs" : `docs/${docPath.replace(/\.md$/, "")}`;
}

/**
 * Site route of a published doc in a locale.
 * @param locale - A supported locale.
 * @param docPath - A published doc path relative to `docs/`.
 * @returns The route with a trailing slash, such as `/es/docs/troubleshooting/`.
 */
export function docRoute(locale: Locale, docPath: string): string {
  return localePath(locale, `/${docSlug(docPath)}/`);
}

/**
 * GitHub blob URL on `main` for a repository file.
 * @param repositoryPath - A path relative to the repository root.
 * @returns The absolute URL.
 */
export function githubBlobUrl(repositoryPath: string): string {
  return `${REPOSITORY_URL}/blob/main/${repositoryPath}`;
}

/**
 * GitHub edit URL on `main` for a repository file.
 * @param repositoryPath - A path relative to the repository root.
 * @returns The absolute URL.
 */
export function githubEditUrl(repositoryPath: string): string {
  return `${REPOSITORY_URL}/edit/main/${repositoryPath}`;
}
