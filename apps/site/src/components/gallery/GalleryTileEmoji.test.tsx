import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { fileUrl, parsePublicIndex } from "../../gallery/public-index";
import { GalleryTileEmoji } from "./GalleryTileEmoji";

vi.mock("animated-fluent-emojis/react", () => ({
  Emoji: (props: { id: string }) => <i data-sprite={props.id} />,
}));

const diverse = parsePublicIndex(fixture).find((candidate) => candidate.tones.length > 0);
if (!diverse) throw new Error("fixture needs an emoji with tones");
const variant = diverse.tones[0];
if (!variant) throw new Error("fixture needs a tone variant");

describe("gallery tile emoji", () => {
  it("shows the poster and no sprite until the tile is armed", () => {
    const html = renderToString(
      <GalleryTileEmoji emoji={diverse} tone={undefined} size={64} armed={false} />,
    );
    expect(html).toContain(`src="${fileUrl(diverse.urls.png)}"`);
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain("data-sprite");
  });

  it("uses the poster of the applied skin tone", () => {
    const html = renderToString(
      <GalleryTileEmoji emoji={diverse} tone={variant.tone} size={64} armed={false} />,
    );
    expect(html).toContain(`src="${fileUrl(variant.urls.png)}"`);
  });

  it("stacks the animated emoji over the poster once armed", () => {
    const html = renderToString(
      <GalleryTileEmoji emoji={diverse} tone={undefined} size={96} armed />,
    );
    expect(html).toContain(`data-sprite="${diverse.id}"`);
    expect(html).toContain(`src="${fileUrl(diverse.urls.png)}"`);
    expect(html).toContain("--tile-size:96px");
  });
});
