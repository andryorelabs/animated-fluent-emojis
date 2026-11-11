import { describe, expect, it } from "vitest";

import fixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex, type PublicEmoji } from "../gallery/public-index";
import {
  copyableGlyph,
  createEmojiSitemapSource,
  emojiPagePath,
  fillName,
  formatCodePoint,
  imageObjectJsonLd,
  neighbourEmojis,
  ogImagePath,
  relatedEmojis,
} from "./emoji-page";

const emojis = parsePublicIndex(fixture);

function at(list: readonly PublicEmoji[], index: number): PublicEmoji {
  const emoji = list[index];
  if (!emoji) throw new Error(`no emoji at ${String(index)}`);
  return emoji;
}

function make(slug: string, category: string): PublicEmoji {
  return { ...at(emojis, 0), slug, category };
}

describe("emoji page helpers", () => {
  it("builds the page and OG image paths from the slug", () => {
    expect(emojiPagePath("fire")).toBe("/emojis/fire/");
    expect(ogImagePath("fire")).toBe("/og/fire.png");
  });

  it("fills the name into a pattern", () => {
    expect(fillName("{name}, animated emoji", "Fuego")).toBe("Fuego, animated emoji");
  });

  it("describes the GIF as an ImageObject", () => {
    const emoji = at(emojis, 0);
    const json = imageObjectJsonLd(emoji, "Hola", "es");
    expect(json).toMatchObject({
      "@type": "ImageObject",
      name: "Hola",
      contentUrl: `https://animated-fluent-emojis-files.andryore.dev${emoji.urls.gif}`,
      url: `https://animated-fluent-emojis.andryore.dev/es/emojis/${emoji.slug}/`,
    });
  });
});

describe("related emojis", () => {
  const all = [make("a", "X"), make("b", "Y"), make("c", "X"), make("d", "X"), make("e", "X")];

  it("lists same-category emojis after the current one, wrapping, without it", () => {
    expect(relatedEmojis(at(all, 0), all).map((emoji) => emoji.slug)).toEqual(["c", "d", "e"]);
    expect(relatedEmojis(at(all, 3), all).map((emoji) => emoji.slug)).toEqual(["e", "a", "c"]);
  });

  it("caps the list at the limit", () => {
    expect(relatedEmojis(at(all, 0), all, 2)).toHaveLength(2);
  });
});

describe("neighbour emojis", () => {
  const all = [make("a", "X"), make("b", "Y"), make("c", "X"), make("d", "X")];

  it("returns the previous and next emoji of the category", () => {
    const result = neighbourEmojis(at(all, 2), all);
    expect(result?.previous.slug).toBe("a");
    expect(result?.next.slug).toBe("d");
  });

  it("wraps around in both directions", () => {
    expect(neighbourEmojis(at(all, 0), all)?.previous.slug).toBe("d");
    expect(neighbourEmojis(at(all, 3), all)?.next.slug).toBe("a");
  });

  it("returns nothing for a one-emoji category", () => {
    expect(neighbourEmojis(at(all, 1), all)).toBeUndefined();
  });
});

describe("emoji sitemap source", () => {
  it("lists every emoji as a localized route", async () => {
    const source = createEmojiSitemapSource(() => Promise.resolve(emojis));
    expect(await source()).toEqual(
      emojis.map((emoji) => ({
        path: `/emojis/${emoji.slug}/`,
        localized: true,
        lastmod: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
      })),
    );
  });
});

describe("formatCodePoint", () => {
  it("formats a single code point", () => {
    expect(formatCodePoint("🔥")).toBe("U+1F525");
  });

  it("formats a ZWJ sequence as space-separated code points", () => {
    expect(formatCodePoint("👨‍💻")).toBe("U+1F468 U+200D U+1F4BB");
  });

  it("drops the U+FE0F variation selector", () => {
    expect(formatCodePoint("❤️")).toBe("U+2764");
  });
});

describe("copyableGlyph", () => {
  const base = { ...at(emojis, 0), unicode: "👋" };
  const withTone = (unicode?: string): PublicEmoji => ({
    ...base,
    tones: [
      {
        tone: "light",
        slug: "waving-hand-light",
        ...(unicode && { unicode }),
        urls: base.urls,
      },
    ],
  });

  it("returns the toned glyph when the variant has its own unicode", () => {
    expect(copyableGlyph(withTone("👋🏻"), "light")).toBe("👋🏻");
  });

  it("falls back to the base glyph without a tone or variant unicode", () => {
    expect(copyableGlyph(withTone("👋🏻"), undefined)).toBe("👋");
    expect(copyableGlyph(withTone(), "light")).toBe("👋");
  });
});
