import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DOCS_DIR, TRANSLATIONS_DIR } from "./paths";
import { classifyTranslation, hashSource, parseTranslation } from "./translations";

interface TranslationFile {
  relative: string;
  file: string;
}

function listTranslationFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...listTranslationFiles(full));
    else if (full.endsWith(".md")) found.push(full);
  }
  return found;
}

function fencedBlocks(markdown: string): string[] {
  return markdown
    .matchAll(/^```[^\n]*\n[\s\S]*?^```$/gm)
    .map((match) => match[0])
    .toArray();
}

const files: TranslationFile[] = listTranslationFiles(TRANSLATIONS_DIR).map((file) => ({
  relative: path.relative(TRANSLATIONS_DIR, file),
  file,
}));

describe.skipIf(files.length === 0)("translations", () => {
  it.each(files)(
    "$relative keeps the English code blocks byte-identical while fresh",
    ({ relative, file }) => {
      const docPath = relative.split(path.sep).slice(1).join("/");
      const english = readFileSync(path.join(DOCS_DIR, docPath), "utf8");
      const translation = parseTranslation(readFileSync(file, "utf8"), relative);
      const status = classifyTranslation(translation, hashSource(english));
      if (status === "stale") return;
      expect(status).toBe("translated");
      expect(fencedBlocks(translation.body)).toEqual(fencedBlocks(english));
    },
  );
});
