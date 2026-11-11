import path from "node:path";

/**
 * The repository `docs/` folder holding the English sources. Resolved from the
 * `apps/site` working directory, because the bundled prerender chunks have no
 * stable `import.meta` location.
 */
export const DOCS_DIR = path.resolve(process.cwd(), "../../docs");

/**
 * The repository `CHANGELOG.md` the changelog page is built from.
 */
export const CHANGELOG_FILE = path.resolve(process.cwd(), "../../CHANGELOG.md");

/**
 * The site content folder holding one subfolder per translated locale.
 */
export const TRANSLATIONS_DIR = path.resolve(process.cwd(), "src/content/translations");
