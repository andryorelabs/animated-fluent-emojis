import { SITE_ORIGIN } from "../i18n/locales";
import { rewriteDocumentLink, type LinkContext } from "./links";

const INLINE_LINK = /(\]\()([^)\s]+)(\))/g;
const FENCE = /^\s*(```|~~~)/;

/**
 * Rewrites the target of every inline Markdown link outside fenced code with
 * {@link rewriteDocumentLink}. Astro 7's default Markdown processor has no rehype
 * stage, so links are rewritten on the source before it is rendered.
 * @param body - Markdown source.
 * @param context - The doc containing the links and the locale it renders for.
 * @param options - How the rewritten links are written out.
 * @param options.absolute - Emit site routes with the origin, as full URLs.
 * @returns The Markdown with rewritten links.
 */
export function rewriteMarkdownLinks(
  body: string,
  context: LinkContext,
  options: { absolute?: boolean } = {},
): string {
  let insideFence = false;
  return body
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) {
        insideFence = !insideFence;
        return line;
      }
      if (insideFence) return line;
      return line.replaceAll(INLINE_LINK, (_match, open: string, href: string, close: string) => {
        const rewritten = rewriteDocumentLink(href, context);
        const target =
          options.absolute && rewritten.startsWith("/") ? `${SITE_ORIGIN}${rewritten}` : rewritten;
        return `${open}${target}${close}`;
      });
    })
    .join("\n");
}

/**
 * Builds the standalone Markdown served next to a docs page for
 * copy-as-Markdown: the title as a heading, then the body with absolute links.
 * @param page - The page title, body, locale and doc path.
 * @returns The Markdown text.
 */
export function toPageMarkdown(page: { title: string; body: string } & LinkContext): string {
  return `# ${page.title}\n\n${rewriteMarkdownLinks(page.body, page, { absolute: true })}`;
}
