import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { EMOJI_SHEET_HEADING_ID, EmojiSheetBody } from "./EmojiSheet";

vi.mock("animated-fluent-emojis/react", () => ({ Emoji: () => null }));

const [first] = parsePublicIndex(fixture);
if (!first) throw new Error("fixture needs an emoji");
const emoji: PublicEmoji = first;
const strings = getUi("en").gallery;

function render(locale: "en" | "es" = "en"): string {
  return renderToString(
    <EmojiSheetBody
      emoji={emoji}
      name="Waving hand"
      tone={undefined}
      size={64}
      locale={locale}
      strings={strings}
    />,
  );
}

describe("emoji sheet body", () => {
  it("labels the sheet with the emoji name heading", () => {
    const html = render();
    expect(html).toContain(`id="${EMOJI_SHEET_HEADING_ID}"`);
    expect(html).toContain("Waving hand");
  });

  it("offers copy buttons for the name and the id", () => {
    const html = render();
    expect(html).toContain(`aria-label="${strings.copyName}"`);
    expect(html).toContain(`aria-label="${strings.copyId}"`);
  });

  it("offers the 1× and 2× zoom", () => {
    const html = render();
    expect(html).toMatch(/1(<!-- -->)?×/);
    expect(html).toMatch(/2(<!-- -->)?×/);
  });

  it("shows the preview skeleton while the files load", () => {
    expect(render()).toContain('data-testid="sheet-preview-skeleton"');
  });

  it("keeps the preview transparent until it is ready", () => {
    expect(render()).toContain('data-ready="false"');
  });

  it("always renders the hidden status toast with an empty live region", () => {
    const html = render();
    expect(html).toContain('data-visible="false"');
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/);
  });

  it("renders the file, snippet and page actions", () => {
    const html = render();
    expect(html).toContain(strings.fileActionDownloadWebp);
    expect(html).toContain("Copy React");
    expect(html).toContain(strings.openPage);
  });

  it("links to the localized emoji page", () => {
    expect(render()).toContain(`href="/emojis/${emoji.slug}/"`);
    expect(render("es")).toContain(`href="/es/emojis/${emoji.slug}/"`);
  });
});
