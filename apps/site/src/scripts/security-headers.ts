import { createHash } from "node:crypto";

/**
 * Token in `docker/security-headers.conf` replaced with the built script
 * hashes.
 */
const SCRIPT_HASHES_PLACEHOLDER = "__SCRIPT_HASHES__";

const HASH_SOURCE = /'sha(?:256|384|512)-[^']+'/g;
const OPENING_TAG = /<([a-z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const META_CSP_TAG =
  /<meta http-equiv="content-security-policy" content="(?<policy>[^"]*)"[^>]*>/gi;

/**
 * A built HTML page.
 */
export interface BuiltPage {
  file: string;
  html: string;
}

/**
 * Hash sources in the `script-src` directive of the Astro-emitted CSP meta tag.
 * @param html - A built page.
 * @returns The quoted hash sources, or an empty list without a CSP meta tag.
 */
export function collectMetaScriptHashes(html: string): string[] {
  const policy = new RegExp(META_CSP_TAG.source, "i").exec(html)?.groups?.policy;
  const scriptDirective = (policy ?? "")
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src "));
  return scriptDirective?.match(HASH_SOURCE) ?? [];
}

/**
 * Removes the Astro CSP meta tag, so the header is the only policy served.
 * @param html - A built page.
 * @returns The page without its CSP meta tag.
 */
export function stripMetaCsp(html: string): string {
  return html.replaceAll(META_CSP_TAG, "");
}

/**
 * SHA-256 CSP sources for every executable inline script in a page.
 * @param html - A built page.
 * @returns One quoted hash source per inline script that is not a data block.
 */
export function findInlineScriptHashes(html: string): string[] {
  const tag = new RegExp(OPENING_TAG.source, "gi");
  const hashes: string[] = [];
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    if (match[1]?.toLowerCase() !== "script") continue;
    const end = html.indexOf("</script", tag.lastIndex);
    const body = html.slice(tag.lastIndex, end === -1 ? undefined : end);
    tag.lastIndex = end === -1 ? html.length : end;
    const attributes = match[2] ?? "";
    const type = /\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attributes)?.[1];
    if (/\ssrc\s*=/i.test(attributes) || (type && type !== "module")) continue;
    const digest = createHash("sha256").update(body).digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

/**
 * Fills the header template with the sorted, de-duplicated script hashes.
 * @param template - The nginx header snippet containing the placeholder.
 * @param hashes - Quoted hash sources to allow.
 * @returns The rendered snippet.
 * @throws {Error} When no hashes are given, which would silently block every script.
 */
export function renderSecurityHeaders(template: string, hashes: readonly string[]): string {
  if (hashes.length === 0) {
    throw new Error("No script hashes found in the built pages");
  }
  const rendered = [...new Set(hashes)]
    .toSorted((first, second) => first.localeCompare(second))
    .join(" ");
  return template.replace(SCRIPT_HASHES_PLACEHOLDER, () => rendered);
}

/**
 * Checks every inline script against the hashes Astro declared, renders the
 * header snippet and rewrites each page without its CSP meta tag. Pages are
 * read lazily and never retained, so memory stays at one page, not the site.
 * @param readPages - Yields the built HTML pages; called once per pass.
 * @param template - The nginx header snippet containing the placeholder.
 * @param writePage - Persists a page without its CSP meta tag.
 * @returns The rendered snippet.
 * @throws {Error} When an inline script has no declared hash; no page is written then.
 */
export function prepareSecurityHeaders(
  readPages: () => Iterable<BuiltPage>,
  template: string,
  writePage: (page: BuiltPage) => void,
): string {
  const allowed = new Set<string>();
  for (const { html } of readPages()) {
    for (const hash of collectMetaScriptHashes(html)) allowed.add(hash);
  }
  const unhashed: string[] = [];
  for (const { file, html } of readPages()) {
    for (const hash of findInlineScriptHashes(html)) {
      if (!allowed.has(hash)) unhashed.push(`${file} ${hash}`);
    }
  }
  if (unhashed.length > 0) {
    throw new Error(`Inline scripts missing from the CSP:\n${unhashed.join("\n")}`);
  }
  const snippet = renderSecurityHeaders(template, [...allowed]);
  for (const { file, html } of readPages()) {
    writePage({ file, html: stripMetaCsp(html) });
  }
  return snippet;
}
