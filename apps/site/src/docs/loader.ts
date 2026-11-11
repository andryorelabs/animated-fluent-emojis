import type { Loader, LoaderContext } from "astro/loaders";

import type { Locale } from "../i18n/locales";
import { loadCatalog } from "./catalog";
import { loadChangelogPages } from "./changelog-pages";
import { markExternalLinks } from "./external-links";
import { transformInstallBlocks } from "./install-block";
import { rewriteMarkdownLinks } from "./markdown";
import { CHANGELOG_FILE, DOCS_DIR, TRANSLATIONS_DIR } from "./paths";

async function renderDocument(context: LoaderContext, body: string, locale: Locale) {
  const rendered = await context.renderMarkdown(body);
  return { ...rendered, html: markExternalLinks(rendered.html, locale) };
}

async function loadPages(context: LoaderContext): Promise<void> {
  context.store.clear();
  const pages = [
    ...loadCatalog({
      docsDirectory: DOCS_DIR,
      translationsDirectory: TRANSLATIONS_DIR,
    }),
    ...loadChangelogPages(CHANGELOG_FILE),
  ];
  for (const page of pages) {
    const data = await context.parseData({
      id: page.id,
      data: {
        title: page.title,
        ...(page.description && { description: page.description }),
        editUrl: page.editUrl,
        translationStatus: page.status,
      },
    });
    const body = transformInstallBlocks(rewriteMarkdownLinks(page.body, page), page.locale);
    context.store.set({
      id: page.id,
      data,
      body: page.body,
      digest: context.generateDigest(`${page.status}\n${page.body}`),
      rendered: await renderDocument(context, body, page.locale),
    });
  }
}

/**
 * Content loader for the Starlight `docs` collection. It emits one entry per
 * published doc and locale from the repository `docs/` folder and the site's
 * translation files, plus the changelog page from `CHANGELOG.md`, and records each entry's translation status for the
 * notice.
 * @returns A loader that fills the store on every build and file change.
 */
export function docsCatalogLoader(): Loader {
  return {
    name: "docs-catalog-loader",
    async load(context) {
      await loadPages(context);
      context.watcher?.add([DOCS_DIR, TRANSLATIONS_DIR, CHANGELOG_FILE]);
      context.watcher?.on("change", (file) => {
        if (
          file === CHANGELOG_FILE ||
          file.startsWith(DOCS_DIR) ||
          file.startsWith(TRANSLATIONS_DIR)
        ) {
          void loadPages(context);
        }
      });
    },
  };
}
