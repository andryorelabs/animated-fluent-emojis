import { beforeAll, describe, expect, it } from "vitest";

import publicIndexFixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../gallery/public-index";
import { generateSnippet, type SnippetKind } from "../gallery/snippets";
import {
  buildCodeBlockTabs,
  buildEmojiPageTabs,
  buildHomeStats,
  buildInstallHtml,
  buildSnippetTabs,
  MARQUEE_EMOJI_IDS,
  MARQUEE_SPEED,
  marqueeDurationSeconds,
  pickMarqueeEmojis,
  pickTeaserEmojis,
  repeatMarqueeEmojis,
  resolveShortcodeEmoji,
  SNIPPET_TABS,
  TEASER_EMOJIS,
  verifyShortcodeDemo,
} from "./content";

const emojis = parsePublicIndex(publicIndexFixture);

describe("snippet tabs", () => {
  it("lists React, Vue, Svelte, Astro and HTML in order", () => {
    expect(SNIPPET_TABS.map((tab) => tab.label)).toEqual([
      "React",
      "Vue",
      "Svelte",
      "Astro",
      "HTML",
    ]);
  });

  it("fills each tab with the generator output for the emoji", () => {
    const emoji = emojis[0];
    if (!emoji) throw new Error("fixture is empty");
    const tabs = buildSnippetTabs(emoji);
    expect(tabs).toHaveLength(5);
    expect(tabs[0]?.code).toContain(emoji.id);
    expect(tabs[4]?.code).toContain("<fluent-emoji");
  });
});

function text(html: string): string {
  let previous: string;
  let result = html;
  do {
    previous = result;
    result = result.replaceAll(/<[^>]*>/g, "");
  } while (result !== previous);
  return result
    .replaceAll(/&#x([\dA-F]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&amp;", "&");
}

describe("highlighted blocks", () => {
  beforeAll(async () => {
    await buildInstallHtml();
  }, 30_000);

  it("fills the placeholders of every framework tab at build time", async () => {
    const emoji = emojis[0];
    if (!emoji) throw new Error("fixture is empty");
    const tabs = await buildCodeBlockTabs(emoji);
    expect(tabs.map((tab) => tab.id)).toEqual(["react", "vue", "svelte", "astro", "element"]);
    for (const tab of tabs) {
      expect(tab.html).toContain(emoji.id);
      expect(tab.html).not.toContain("EMOJIID");
      expect(tab.html).not.toContain("99999");
    }
  });

  it("expresses the play mode in code and filled html", async () => {
    const emoji = emojis[0];
    if (!emoji) throw new Error("fixture is empty");
    const hover = await buildCodeBlockTabs(emoji, undefined, 64, "hover");
    const loop = await buildCodeBlockTabs(emoji, undefined, 64, "loop");
    expect(hover[0]?.code).toContain("playOnHover autoPlay={false}");
    expect(text(hover[0]?.html ?? "")).toContain("playOnHover autoPlay={false}");
    expect(hover[1]?.code).toContain('play-on-hover :auto-play="false"');
    expect(loop[4]?.code).toContain('animation-iterations="infinite"');
    expect(text(loop[4]?.html ?? "")).toContain('animation-iterations="infinite"');
  });

  it("highlights the install command of every package manager", async () => {
    const html = await buildInstallHtml();
    expect(Object.keys(html)).toEqual(["bun", "pnpm", "npm", "yarn"]);
    expect(html.npm).toContain("install");
    expect(html.bun).not.toContain('class="gutter"');
  });
});

describe("teaser emojis", () => {
  const template = emojis[0];
  if (!template) throw new Error("fixture is empty");
  const everyTeaser = TEASER_EMOJIS.map((entry) => ({
    ...template,
    id: entry.id,
    slug: entry.id,
  }));
  const withoutFire = emojis.filter((emoji) => emoji.id !== "fire");

  it("picks the curated emojis in order with a glow hue each", () => {
    const picked = pickTeaserEmojis([...withoutFire, ...everyTeaser]);
    expect(picked.map((entry) => entry.emoji.id)).toEqual(TEASER_EMOJIS.map((entry) => entry.id));
    for (const entry of picked) {
      expect(entry.hue).toBeGreaterThanOrEqual(0);
      expect(entry.hue).toBeLessThan(360);
    }
  });

  it("shows six tiles", () => {
    expect(TEASER_EMOJIS).toHaveLength(6);
  });

  it("fails loudly when a curated emoji left the index", () => {
    expect(() => pickTeaserEmojis(withoutFire)).toThrow(/fire/);
  });

  it("skips missing emojis when asked to, for filtered builds", () => {
    expect(pickTeaserEmojis(withoutFire, true)).toEqual([]);
    expect(pickTeaserEmojis(emojis, true)).toHaveLength(1);
  });
});

const CODE_LINE_PATTERN = /<div class="code">(.*?)<\/div><\/div>/gs;

function stripTags(html: string): string {
  let text = "";
  let insideTag = false;
  for (const character of html) {
    if (character === "<") insideTag = true;
    else if (character === ">" && insideTag) insideTag = false;
    else if (!insideTag) text += character;
  }
  return text;
}

function visibleText(html: string): string {
  return Array.from(html.replaceAll("\n", "").matchAll(CODE_LINE_PATTERN), ([, line = ""]) =>
    stripTags(line)
      .replaceAll(/&#x([\dA-F]+);/gi, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16)),
      )
      .replaceAll("&amp;", "&"),
  ).join("\n");
}

describe("emoji page tabs", () => {
  const withTones = emojis.find((candidate) => candidate.tones.length > 0);
  const withoutTones = emojis.find((candidate) => candidate.tones.length === 0);

  it("shows the same text generateSnippet copies", async () => {
    if (!withTones) throw new Error("fixture needs an emoji with tones");
    const tone = withTones.tones[0]?.tone;
    const { plain, toned } = await buildEmojiPageTabs(withTones, 200);
    for (const tab of plain) {
      expect(visibleText(tab.html)).toBe(tab.code);
      expect(tab.code).toBe(generateSnippet(withTones, tab.id as SnippetKind, { size: 200 }));
    }
    for (const tab of toned) {
      expect(visibleText(tab.html)).toBe(
        generateSnippet(withTones, tab.id as SnippetKind, { size: 200, tone }),
      );
    }
  });

  it("has no toned tabs for an emoji without skin tones", async () => {
    if (!withoutTones) throw new Error("fixture needs an emoji without tones");
    const { plain, toned } = await buildEmojiPageTabs(withoutTones, 200);
    expect(plain).toHaveLength(5);
    expect(toned).toEqual([]);
  });
});

describe("home stats", () => {
  it("derives every stat from the given facts, in display order", () => {
    expect(
      buildHomeStats({
        emojiCount: 1500,
        localeCount: 10,
        license: "MIT",
      }),
    ).toEqual([
      { id: "emojis", value: "1500" },
      { id: "adapters", value: String(SNIPPET_TABS.length) },
      { id: "languages", value: "10" },
      { id: "license", value: "MIT" },
    ]);
  });
});

describe("marquee row", () => {
  it("picks distinct emojis up to the requested count", () => {
    const row = pickMarqueeEmojis(emojis, 1);
    expect(row).toHaveLength(1);
  });

  it("returns what it can when the index is small", () => {
    expect(pickMarqueeEmojis(emojis, 4)).toHaveLength(3);
  });

  it("puts the preferred still emojis first and never repeats one", () => {
    const template = emojis[0];
    if (!template) throw new Error("fixture is empty");
    const [preferredId] = MARQUEE_EMOJI_IDS;
    if (!preferredId) throw new Error("no preferred marquee emoji");
    const withPreferred = [...emojis, { ...template, id: preferredId }];
    const ids = pickMarqueeEmojis(withPreferred, 2).map((emoji) => emoji.id);
    expect(ids[0]).toBe(preferredId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("repeats the row until a half is wider than the minimum", () => {
    const row = pickMarqueeEmojis(emojis, 3);
    const half = repeatMarqueeEmojis(row, 60, 2560);
    expect(half.length * 60).toBeGreaterThan(2560);
    expect(half.length % row.length).toBe(0);
    expect((half.length - row.length) * 60).toBeLessThanOrEqual(2560);
  });

  it("repeats 24 emojis twice for 2560 pixels", () => {
    const template = emojis[0];
    if (!template) throw new Error("fixture is empty");
    const row = Array.from({ length: 24 }, () => template);
    expect(repeatMarqueeEmojis(row, 60, 2560)).toHaveLength(48);
  });

  it("returns nothing for an empty row", () => {
    expect(repeatMarqueeEmojis([], 60, 2560)).toEqual([]);
  });

  it("derives the loop duration from the half width at the canvas speed", () => {
    expect(MARQUEE_SPEED).toBe(47);
    expect(marqueeDurationSeconds(2820)).toBe(60);
    expect(marqueeDurationSeconds(2880)).toBeCloseTo(61.28, 2);
  });

  it("keeps the effective speed constant as the half grows", () => {
    for (const halfWidth of [1410, 2820, 5640]) {
      expect(halfWidth / marqueeDurationSeconds(halfWidth)).toBeCloseTo(47, 5);
    }
  });

  it("rejects a half without width", () => {
    expect(() => marqueeDurationSeconds(0)).toThrow(RangeError);
  });
});

describe("shortcode resolution", () => {
  const template = emojis[0];
  if (!template) throw new Error("fixture is empty");
  const fire = { ...template, id: "1f525_fire" };
  const launch = { ...template, id: "launch" };
  const prefixedLaunch = { ...template, id: "1f680_launch" };

  it("matches the full id", () => {
    expect(resolveShortcodeEmoji([fire], "1f525_fire").id).toBe("1f525_fire");
  });

  it("matches the id without its code-point prefix", () => {
    expect(resolveShortcodeEmoji([fire], "fire").id).toBe("1f525_fire");
  });

  it("fails loudly for an unknown shortcode", () => {
    expect(() => resolveShortcodeEmoji([fire, launch], "missing")).toThrow(/missing/);
  });

  it("accepts a demo whose ids all resolve", () => {
    expect(() => {
      verifyShortcodeDemo(
        [fire, launch],
        [
          { code: "fire", id: "1f525_fire" },
          { code: "launch", id: "launch" },
        ],
      );
    }).not.toThrow();
  });

  it("fails loudly when a demo id drifts from its shortcode", () => {
    expect(() => {
      verifyShortcodeDemo([fire], [{ code: "fire", id: "fire" }]);
    }).toThrow(/1f525_fire/);
    expect(() => {
      verifyShortcodeDemo([fire], [{ code: "launch", id: "launch" }]);
    }).toThrow(/:launch:/);
  });

  it("fails loudly when two ids share a shortcode", () => {
    expect(() => resolveShortcodeEmoji([launch, prefixedLaunch], "launch")).toThrow(/ambiguous/i);
  });
});
