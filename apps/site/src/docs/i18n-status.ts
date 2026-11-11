import { loadCatalog } from "./catalog";
import { DOCS_DIR, TRANSLATIONS_DIR } from "./paths";
import { formatStatusReport } from "./status";
import { MalformedTranslationError } from "./translations";

try {
  process.stdout.write(
    formatStatusReport(
      loadCatalog({
        docsDirectory: DOCS_DIR,
        translationsDirectory: TRANSLATIONS_DIR,
      }),
    ),
  );
} catch (error) {
  if (!(error instanceof MalformedTranslationError)) throw error;
  process.stderr.write(`malformed translation: ${error.message}\n`);
  process.exitCode = 1;
}
