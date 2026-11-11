const VARIATION_SELECTOR = 0xfe_0f;

/**
 * Converts an emoji glyph to its codepoint key, dropping variation selectors.
 * @param glyph The emoji as a string, such as `👋`.
 * @returns Lowercase hex codepoints joined with `-`, such as `1f44b`.
 */
export function glyphToCodepoints(glyph: string): string {
  return Array.from(glyph, (character) => character.codePointAt(0))
    .filter(
      (codepoint): codepoint is number =>
        codepoint !== undefined && codepoint !== VARIATION_SELECTOR,
    )
    .map((codepoint) => codepoint.toString(16))
    .join("-");
}

/**
 * Normalizes a hex codepoint sequence to the key produced by
 * {@link glyphToCodepoints}.
 * @param hexSequence Space or dash separated hex, such as `1f642 200d 2194 fe0f`.
 * @returns Lowercase hex codepoints joined with `-`, without variation selectors.
 */
export function hexToCodepoints(hexSequence: string): string {
  return hexSequence
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((part) => part !== "" && part !== "fe0f")
    .join("-");
}
