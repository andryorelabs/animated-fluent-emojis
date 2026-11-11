import type { SnippetSlot } from "./snippet-template";

const HIGHLIGHT_CLASS = "ec-line-highlight";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string): string {
  return value.replaceAll(/[&<>"]/g, (character) => HTML_ESCAPES[character] ?? "");
}

/**
 * Fills the placeholder tokens of a pre-rendered snippet with their values at
 * build time, so the server HTML already shows the real emoji.
 * @param html - The highlighted snippet markup with `data-snippet-slot` tokens.
 * @param values - The text per slot; slots without a value are kept.
 * @returns The markup with each given slot's text replaced.
 */
export function fillSnippetSlots(
  html: string,
  values: Partial<Record<SnippetSlot, string>>,
): string {
  return html.replaceAll(
    /(<span[^>]* data-snippet-slot="(\w+)"[^>]*>)[^<]*(<\/span>)/g,
    (match, open: string, slot: string, close: string) => {
      const value = values[slot as SnippetSlot];
      return value === undefined ? match : `${open}${escapeHtml(value)}${close}`;
    },
  );
}

/**
 * Marks one line of a highlighted snippet so it renders emphasized.
 * @param html - The highlighted snippet markup, one `ec-line` per line.
 * @param line - The 1-based line to mark.
 * @returns The markup with that line carrying the highlight class, or the
 * markup unchanged when the line does not exist.
 */
export function markHighlightedLine(html: string, line: number): string {
  let seen = 0;
  return html.replaceAll('<div class="ec-line"', (match) => {
    seen += 1;
    return seen === line ? `<div class="ec-line ${HIGHLIGHT_CLASS}"` : match;
  });
}
