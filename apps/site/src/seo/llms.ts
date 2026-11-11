import type { PublicEmoji } from "../gallery/public-index";

/**
 * One page listed in an llms file.
 */
interface LlmsLink {
  title: string;
  url: string;
  description?: string;
}

/**
 * An emoji page entry: the link plus the longer text `llms-full.txt` shows.
 */
export interface LlmsEmojiEntry extends LlmsLink {
  details: string;
}

/**
 * The emoji fields an llms file needs.
 */
export type LlmsEmoji = Pick<
  PublicEmoji,
  "slug" | "description" | "unicode" | "category" | "keywords"
>;

/**
 * Everything the composed llms files are built from.
 */
export interface LlmsInput {
  siteName: string;
  description: string;
  landing: LlmsLink;
  docs: readonly LlmsLink[];
  emojis: readonly LlmsEmojiEntry[];
}

/**
 * Inputs of `llms-full.txt`: the same pages plus the docs Markdown that the
 * `starlight-llms-txt` plugin generates.
 */
export interface LlmsFullInput extends LlmsInput {
  docsMarkdown: string;
}

function linkLine({ title, url, description }: LlmsLink): string {
  return `- [${title}](${url})${description ? `: ${description}` : ""}`;
}

function section(heading: string, body: string): string {
  return `## ${heading}\n\n${body}`;
}

function header(input: LlmsInput): string[] {
  return [`# ${input.siteName}`, `> ${input.description}`];
}

/**
 * Describes an emoji as an llms entry linking to its page.
 * @param emoji - The emoji to list.
 * @param pageUrl - Absolute URL of the emoji page.
 * @returns The entry, with the Unicode sequence and category, and keywords in its details.
 */
export function emojiEntry(emoji: LlmsEmoji, pageUrl: string): LlmsEmojiEntry {
  const summary = `${emoji.unicode}, ${emoji.category}`;
  return {
    title: emoji.description,
    url: pageUrl,
    description: summary,
    details:
      emoji.keywords.length > 0 ? `${summary}. Keywords: ${emoji.keywords.join(", ")}` : summary,
  };
}

/**
 * Composes `llms.txt`: the landing page, the documentation pages and every
 * emoji page.
 * @param input - The site description and the pages to list.
 * @returns The Markdown index.
 */
export function buildLlmsTxt(input: LlmsInput): string {
  return (
    [
      ...header(input),
      section("Landing", linkLine(input.landing)),
      section("Documentation", input.docs.map((link) => linkLine(link)).join("\n")),
      section("Emojis", input.emojis.map((link) => linkLine(link)).join("\n")),
    ].join("\n\n") + "\n"
  );
}

/**
 * Composes `llms-full.txt`: the landing page, the full documentation text from
 * the `starlight-llms-txt` plugin and the emoji details.
 * @param input - The site description, docs Markdown and emoji entries.
 * @returns The Markdown document.
 */
export function buildLlmsFullTxt(input: LlmsFullInput): string {
  return (
    [
      ...header(input),
      section("Landing", linkLine(input.landing)),
      section("Documentation", input.docsMarkdown.trim()),
      section(
        "Emojis",
        input.emojis
          .map(({ title, url, details }) => `- [${title}](${url}): ${details}`)
          .join("\n"),
      ),
    ].join("\n\n") + "\n"
  );
}
