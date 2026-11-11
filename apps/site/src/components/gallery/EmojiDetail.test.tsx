import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { fileUrl, parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { EmojiDetail } from "./EmojiDetail";

vi.mock("animated-fluent-emojis/react", () => ({ Emoji: () => null }));

const found = parsePublicIndex(fixture).find((candidate) => candidate.tones.length > 0);
if (!found) throw new Error("fixture needs an emoji with tones");
const emoji: PublicEmoji = found;
const strings = getUi("en").gallery;

function render(tone: "light" | undefined): string {
  return renderToString(
    <EmojiDetail emoji={emoji} name="Waving hand" tone={tone} size={200} strings={strings} page />,
  );
}

describe("emoji detail on a page", () => {
  it("shows the default snippet without a tone", () => {
    const html = render(undefined);
    expect(html).toContain(emoji.id);
    expect(html).not.toContain("skinTone");
  });

  it("puts the chosen tone in the snippet", () => {
    expect(render("light")).toContain("light");
    expect(render("light")).not.toBe(render(undefined));
  });

  it("server-renders a static poster of the current tone as the preview", () => {
    const html = render("light");
    const light = emoji.tones.find((variant) => variant.tone === "light");
    expect(html).toContain(`src="${fileUrl(light?.urls.png ?? "")}"`);
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('alt=""');
  });

  it("renders no poster outside a page", () => {
    const html = renderToString(
      <EmojiDetail
        emoji={emoji}
        name="Waving hand"
        tone={undefined}
        size={200}
        strings={strings}
      />,
    );
    expect(html).not.toContain(`src="${fileUrl(emoji.urls.png)}"`);
  });

  it("puts the background group and the pause button before the zoom group", () => {
    const html = render(undefined);
    const background = html.indexOf(`aria-label="${strings.backgroundLabel}"`);
    const pause = html.indexOf(`aria-label="${strings.pauseAnimation}"`);
    const zoom = html.indexOf(`aria-label="${strings.zoomLabel}"`);
    expect(background).toBeGreaterThan(-1);
    expect(pause).toBeGreaterThan(background);
    expect(zoom).toBeGreaterThan(pause);
  });

  it("leaves the name heading to the page", () => {
    expect(render(undefined)).not.toContain("<h2");
  });

  it("leaves the id row and the file action button to the page columns", () => {
    const html = render(undefined);
    expect(html).not.toContain(`aria-label="${strings.copyId}"`);
    expect(html).not.toContain(`aria-label="${strings.fileActionMenuLabel}"`);
  });

  it("keeps the id copy action and the file action button in the sheet", () => {
    const html = renderToString(
      <EmojiDetail
        emoji={emoji}
        name="Waving hand"
        tone={undefined}
        size={200}
        strings={strings}
      />,
    );
    expect(html).toContain(`aria-label="${strings.copyId}"`);
    expect(html).toContain(`aria-label="${strings.fileActionMenuLabel}"`);
    expect(html).toContain(strings.fileActionDownloadWebp);
  });

  it('puts "No code" as the last snippet tab', () => {
    const html = render(undefined);
    expect(html.lastIndexOf(strings.tabNoCode)).toBeGreaterThan(html.indexOf(strings.tabHtml));
  });

  it("names the emoji wrapper, not the stage, on a page only", () => {
    const html = render(undefined);
    expect(html).toContain(`--view-transition-name:emoji-${emoji.slug}`);
    expect(html).toContain("--view-transition-class:emoji");
    expect(html.match(/--view-transition-name/g)).toHaveLength(1);
    const outside = renderToString(
      <EmojiDetail
        emoji={emoji}
        name="Waving hand"
        tone={undefined}
        size={200}
        strings={strings}
      />,
    );
    expect(outside).not.toContain("--view-transition-name");
  });
});
