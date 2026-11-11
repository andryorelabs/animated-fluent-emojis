import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { LOCALES, localeSegment, type Locale } from "../i18n/locales";
import { docSlug, githubEditUrl, PUBLISHED_DOCS } from "./published";
import {
  classifyTranslation,
  hashSource,
  parseTranslation,
  type ParsedTranslation,
  type TranslationStatus,
} from "./translations";

/**
 * Directories the catalog reads from.
 */
export interface CatalogSources {
  docsDirectory: string;
  translationsDirectory: string;
}

/**
 * One page of the docs in one locale. Missing and stale translations carry the
 * English text, so every locale has every published page.
 */
export interface DocumentPage {
  id: string;
  locale: Locale;
  docPath: string;
  title: string;
  description?: string;
  body: string;
  status: TranslationStatus;
  englishHash: string;
  editUrl: string;
}

/**
 * Repository-relative location of the site content translations.
 */
const TRANSLATIONS_REPOSITORY_PATH = "apps/site/src/content/translations";

/**
 * Splits the leading `# Title` off an English doc.
 * @param source - The English Markdown.
 * @param label - The file name, used in the error message.
 * @returns The title and the body without its heading.
 */
export function splitEnglishTitle(source: string, label: string): { title: string; body: string } {
  const match = /^#\s+(.+?)\s*\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${label}: expected a leading "# Title" heading`);
  return { title: match[1] ?? "", body: (match[2] ?? "").replace(/^\s*\n/, "") };
}

function pageId(locale: Locale, docPath: string): string {
  return locale === "en" ? docSlug(docPath) : `${localeSegment(locale)}/${docSlug(docPath)}`;
}

function readTranslation(
  translationsDirectory: string,
  locale: Locale,
  docPath: string,
): ParsedTranslation | undefined {
  const file = path.join(translationsDirectory, localeSegment(locale), docPath);
  return existsSync(file)
    ? parseTranslation(readFileSync(file, "utf8"), `${localeSegment(locale)}/${docPath}`)
    : undefined;
}

/**
 * Builds every page for every locale from the English docs and the site's
 * translation files.
 * @param sources - The docs and translations directories.
 * @returns One page per locale and published doc.
 * @throws {MalformedTranslationError} When a translation has bad frontmatter.
 */
export function loadCatalog(sources: CatalogSources): DocumentPage[] {
  return PUBLISHED_DOCS.flatMap((docPath) => {
    const source = readFileSync(path.join(sources.docsDirectory, docPath), "utf8");
    const english = splitEnglishTitle(source, docPath);
    const englishHash = hashSource(source);
    const englishEdit = githubEditUrl(`docs/${docPath}`);
    return LOCALES.map((locale): DocumentPage => {
      const translation =
        locale === "en"
          ? undefined
          : readTranslation(sources.translationsDirectory, locale, docPath);
      const status = locale === "en" ? "translated" : classifyTranslation(translation, englishHash);
      if (translation && status === "translated") {
        return {
          id: pageId(locale, docPath),
          locale,
          docPath,
          title: translation.title,
          ...(translation.description && {
            description: translation.description,
          }),
          body: translation.body,
          status,
          englishHash,
          editUrl: githubEditUrl(
            `${TRANSLATIONS_REPOSITORY_PATH}/${localeSegment(locale)}/${docPath}`,
          ),
        };
      }
      return {
        id: pageId(locale, docPath),
        locale,
        docPath,
        title: english.title,
        body: english.body,
        status,
        englishHash,
        editUrl: englishEdit,
      };
    });
  });
}
