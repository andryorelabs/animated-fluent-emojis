import { readFileSync } from "node:fs";

import { LOCALES, localeSegment } from "../i18n/locales";
import type { DocumentPage } from "./catalog";
import { githubEditUrl } from "./published";
import { parseChangelog, renderReleaseNotesMarkdown } from "./release-notes";
import { hashSource } from "./translations";

/**
 * Route slug of the changelog page in English.
 */
export const CHANGELOG_SLUG = "changelog";

/**
 * Builds the changelog page for every locale from `CHANGELOG.md`. The release
 * notes are not translated, so every other locale carries the English text
 * with the `missing` translation notice.
 * @param changelogFile - Absolute path of `CHANGELOG.md`.
 * @returns One page per locale.
 * @throws {Error} When `CHANGELOG.md` does not parse, which fails the build.
 */
export function loadChangelogPages(changelogFile: string): DocumentPage[] {
  const source = readFileSync(changelogFile, "utf8");
  const body = renderReleaseNotesMarkdown(parseChangelog(source));
  const englishHash = hashSource(source);
  return LOCALES.map((locale) => ({
    id: locale === "en" ? CHANGELOG_SLUG : `${localeSegment(locale)}/${CHANGELOG_SLUG}`,
    locale,
    docPath: "../CHANGELOG.md",
    title: "Changelog",
    description: "Release notes for Animated Fluent Emojis: what changed in every version.",
    body,
    status: locale === "en" ? "translated" : "missing",
    englishHash,
    editUrl: githubEditUrl("CHANGELOG.md"),
  }));
}
