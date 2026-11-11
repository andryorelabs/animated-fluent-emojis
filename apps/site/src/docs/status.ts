import type { DocumentPage } from "./catalog";

/**
 * Renders the `i18n:status` report: every missing and stale page, then totals.
 * @param pages - The catalog from `loadCatalog`.
 * @returns The report text, ending with a newline.
 */
export function formatStatusReport(pages: readonly DocumentPage[]): string {
  const outstanding = pages.filter((page) => page.status !== "translated");
  const lines = outstanding.map(
    (page) => `${page.status.padEnd(7)} ${page.locale} ${page.docPath}`,
  );
  const missing = outstanding.filter((page) => page.status === "missing");
  const stale = outstanding.length - missing.length;
  return `${[
    ...lines,
    `${String(missing.length)} missing, ${String(stale)} stale, ${String(pages.length - outstanding.length)} up to date`,
  ].join("\n")}\n`;
}
