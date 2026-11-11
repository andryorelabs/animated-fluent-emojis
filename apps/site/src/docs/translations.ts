import { createHash } from "node:crypto";

/**
 * How a locale's page relates to the English source.
 */
export type TranslationStatus = "translated" | "missing" | "stale";

/**
 * A translation file after parsing its frontmatter.
 */
export interface ParsedTranslation {
  title: string;
  description?: string;
  sourceHash: string;
  body: string;
}

/**
 * Thrown when a translation file cannot be parsed. `i18n:status` exits
 * non-zero only for this error.
 */
export class MalformedTranslationError extends Error {
  constructor(label: string, reason: string) {
    super(`${label}: ${reason}`);
    this.name = "MalformedTranslationError";
  }
}

/**
 * Hash of an English source file, stored in a translation's `sourceHash`
 * frontmatter. Line endings are normalised so the hash is stable across
 * platforms.
 * @param source - The full text of the English doc.
 * @returns The first 16 hex characters of its SHA-256.
 */
export function hashSource(source: string): string {
  return createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex").slice(0, 16);
}

function unquote(value: string): string {
  const quote = value[0];
  return (quote === '"' || quote === "'") && value.endsWith(quote) ? value.slice(1, -1) : value;
}

/**
 * Parses a translation: simple `key: value` frontmatter with a required
 * `title` and `sourceHash`, then the Markdown body.
 * @param text - The file contents.
 * @param label - The file name, used in error messages.
 * @returns The parsed translation.
 * @throws {MalformedTranslationError} When the frontmatter is missing or
 * incomplete.
 */
export function parseTranslation(text: string, label: string): ParsedTranslation {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new MalformedTranslationError(label, "missing frontmatter");
  const fields = new Map<string, string>();
  const lines = (match[1] ?? "").split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === "") continue;
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new MalformedTranslationError(label, `invalid line "${line}"`);
    }
    fields.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1).trim()));
  }
  const title = fields.get("title");
  if (!title) throw new MalformedTranslationError(label, "missing title");
  const sourceHash = fields.get("sourceHash");
  if (!sourceHash) {
    throw new MalformedTranslationError(label, "missing sourceHash");
  }
  const description = fields.get("description");
  return {
    title,
    sourceHash,
    body: match[2] ?? "",
    ...(description && { description }),
  };
}

/**
 * Classifies a locale's page against the current English source.
 * @param translation - The parsed translation, or undefined when none exists.
 * @param englishHash - The current hash of the English source.
 * @returns `missing` without a file, `stale` when its hash no longer matches,
 * otherwise `translated`.
 */
export function classifyTranslation(
  translation: Pick<ParsedTranslation, "sourceHash"> | undefined,
  englishHash: string,
): TranslationStatus {
  if (!translation) return "missing";
  return translation.sourceHash === englishHash ? "translated" : "stale";
}
