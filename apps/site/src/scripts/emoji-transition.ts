const EMOJI_PAGE_PATTERN = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/emojis\/([^/]+)\/?$/;

/**
 * Extracts the emoji slug from an emoji detail page URL.
 * @param url - An absolute URL, or undefined when unknown.
 * @returns The slug, or undefined when the URL is not an emoji page.
 */
export function emojiSlugFromUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const match = EMOJI_PAGE_PATTERN.exec(new URL(url).pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Names only the given gallery tile's emoji for the shared-element morph.
 * @param root - The document to search.
 * @param slug - The emoji slug whose tile should be named.
 * @returns A function that removes the name again, or undefined when no tile matches.
 */
export function nameGalleryTile(root: ParentNode, slug: string): (() => void) | undefined {
  const target = root.querySelector<HTMLElement>(
    `[data-slug="${CSS.escape(slug)}"] [data-transition-target]`,
  );
  if (!target) return undefined;
  target.style.viewTransitionName = `emoji-${slug}`;
  return () => {
    target.style.viewTransitionName = "";
  };
}

/**
 * Wires the gallery tile naming to `pageswap` (leaving the gallery) and
 * `pagereveal` (arriving back on it), clearing the name once the transition ends.
 * @param target - The window to listen on.
 */
export function installEmojiTransition(target: typeof globalThis = globalThis): void {
  target.addEventListener("pageswap", (event) => {
    const { viewTransition, activation } = event;
    if (!viewTransition) return;
    const slug = emojiSlugFromUrl(activation?.entry.url);
    if (!slug) return;
    const clear = nameGalleryTile(target.document, slug);
    if (clear) void viewTransition.finished.finally(clear);
  });

  target.addEventListener("pagereveal", (event) => {
    const { viewTransition } = event;
    if (!viewTransition) return;
    const slug = emojiSlugFromUrl(target.navigation.activation?.from?.url);
    if (!slug) return;
    const clear = nameGalleryTile(target.document, slug);
    if (clear) void viewTransition.finished.finally(clear);
  });
}
