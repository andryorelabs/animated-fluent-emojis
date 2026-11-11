import type { SnippetSlot } from "./snippet-template";

export interface SlotElement {
  dataset: Record<string, string | undefined>;
  textContent: string | null;
}

/**
 * Replaces the text of each slot token with its new value and leaves every
 * other token, and so the highlighting, untouched.
 * @param elements - The `data-snippet-slot` tokens of one snippet, for example
 * `root.querySelectorAll<HTMLElement>('[data-snippet-slot]')`.
 * @param values - The new text per slot; slots without a value are kept.
 */
export function swapSnippetSlots(
  elements: Iterable<SlotElement>,
  values: Partial<Record<SnippetSlot, string>>,
): void {
  for (const element of elements) {
    const value = values[element.dataset.snippetSlot as SnippetSlot];
    if (value !== undefined) {
      element.textContent = value;
    }
  }
}
