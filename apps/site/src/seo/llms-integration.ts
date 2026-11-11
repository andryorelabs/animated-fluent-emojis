import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

import { docRoute, PUBLISHED_DOCS } from "../docs/published";
import { emojiPagePath } from "../emoji-pages/emoji-page";
import { loadPublicIndex } from "../gallery/public-index";
import { localeUrl, SITE_ORIGIN } from "../i18n/locales";
import { getUi } from "../i18n/ui";
import { buildLlmsFullTxt, buildLlmsTxt, emojiEntry } from "./llms";

const DOCS_DIRECTORY = fileURLToPath(new URL("../../../../docs/", import.meta.url));

/**
 * Reads a published doc's title from its first level-one heading.
 * @param docPath - A path relative to the repository `docs/` folder.
 * @returns The heading text, or the path itself when the file has none.
 */
async function documentTitle(docPath: string): Promise<string> {
  const source = await readFile(path.join(DOCS_DIRECTORY, docPath), "utf8");
  return /^# (.+)$/m.exec(source)?.[1]?.trim() ?? docPath;
}

/**
 * Astro integration that rewrites `llms.txt` and `llms-full.txt` once the
 * build is done. The `starlight-llms-txt` plugin still generates the docs
 * text; its `llms-full.txt` becomes the Documentation section, next to the
 * landing page and every emoji page.
 * @returns The integration to register in `astro.config.ts`.
 */
export function composedLlmsFiles(): AstroIntegration {
  return {
    name: "composed-llms-files",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const outputDirectory = fileURLToPath(dir);
        const { meta } = getUi("en");
        const publicEmojis = await loadPublicIndex();
        const emojis = publicEmojis.map((emoji) =>
          emojiEntry(emoji, `${SITE_ORIGIN}${emojiPagePath(emoji.slug)}`),
        );
        const input = {
          siteName: meta.siteName,
          description: meta.description,
          landing: { title: meta.siteName, url: localeUrl("en") },
          docs: await Promise.all(
            PUBLISHED_DOCS.map(async (docPath) => ({
              title: await documentTitle(docPath),
              url: `${SITE_ORIGIN}${docRoute("en", docPath)}`,
            })),
          ),
          emojis,
        };
        const docsMarkdown = await readFile(path.join(outputDirectory, "llms-full.txt"), "utf8");
        await writeFile(path.join(outputDirectory, "llms.txt"), buildLlmsTxt(input));
        await writeFile(
          path.join(outputDirectory, "llms-full.txt"),
          buildLlmsFullTxt({ ...input, docsMarkdown }),
        );
      },
    },
  };
}
