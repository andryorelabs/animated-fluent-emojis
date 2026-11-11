/**
 * Makes every code frame keyboard scrollable by giving its `pre` a tab stop,
 * so wide code is reachable without a pointer.
 */
export function makeCodeFocusable(): void {
  for (const block of document.querySelectorAll(".expressive-code pre")) {
    block.setAttribute("tabindex", "0");
  }
}
