import { describe, expect, it } from "vitest";

import publicIndexFixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../gallery/public-index";
import { generateSnippet } from "../gallery/snippets";
import { SNIPPET_TABS } from "./content";
import {
  DEMO_EMOJIS,
  DEMO_PLAYS,
  DEMO_SIZES,
  DEMO_TONES,
  demoEmojiProps,
  demoSlotValues,
  demoSnippetCode,
  demoTone,
  INITIAL_DEMO_STATE,
  isInitialDemoState,
  isTapPlayTrigger,
  type DemoState,
} from "./demo";

const emojis = parsePublicIndex(publicIndexFixture);
const diverse = emojis.find((emoji) => emoji.tones.length > 0);
const plain = emojis.find((emoji) => emoji.tones.length === 0);
if (!diverse || !plain) throw new Error("fixture needs both emoji kinds");

const state = (overrides: Partial<DemoState>): DemoState => ({
  ...INITIAL_DEMO_STATE,
  ...overrides,
});

describe("demo options", () => {
  it("offers the emojis, sizes, tones and plays from the design", () => {
    expect(DEMO_EMOJIS.map((emoji) => emoji.id)).toEqual([
      "1f44b_wavinghand",
      "fire",
      "1f389_partypopper",
      "heart",
      "launch",
      "1f600_grinningface",
    ]);
    expect(DEMO_SIZES).toEqual([32, 64, 96, 128]);
    expect(DEMO_TONES.map((tone) => tone.id)).toEqual(["default", "light", "medium", "dark"]);
    expect(DEMO_PLAYS.map((play) => play.id)).toEqual(["hover", "load", "loop"]);
  });

  it("starts on a hover-driven waving hand", () => {
    expect(INITIAL_DEMO_STATE).toEqual({
      emojiId: "1f44b_wavinghand",
      size: 96,
      tone: "default",
      play: "hover",
    });
  });

  it("knows when nothing changed", () => {
    expect(isInitialDemoState(INITIAL_DEMO_STATE)).toBe(true);
    expect(isInitialDemoState(state({ size: 32 }))).toBe(false);
    expect(isInitialDemoState(state({ emojiId: "fire" }))).toBe(false);
  });
});

describe("demo emoji props", () => {
  it("plays on hover without autoplay", () => {
    expect(demoEmojiProps(diverse, state({ size: 64, tone: "light" }))).toEqual({
      size: 64,
      skinTone: "light",
      playOnHover: true,
      autoPlay: false,
    });
  });

  it("plays on load without hover", () => {
    expect(demoEmojiProps(diverse, state({ size: 128, tone: "dark", play: "load" }))).toEqual({
      size: 128,
      skinTone: "dark",
      playOnHover: false,
      autoPlay: true,
    });
  });

  it("loops forever with autoplay", () => {
    expect(demoEmojiProps(diverse, state({ size: 64, play: "loop" }))).toEqual({
      size: 64,
      skinTone: undefined,
      playOnHover: false,
      autoPlay: true,
      animationIterations: "infinite",
    });
  });

  it("drops the tone for an emoji without tones", () => {
    expect(demoEmojiProps(plain, state({ tone: "dark" })).skinTone).toBe(undefined);
  });
});

describe("demo snippets", () => {
  it("applies a tone only when the emoji has tones and one is picked", () => {
    expect(demoTone(diverse, state({ tone: "medium" }))).toBe("medium");
    expect(demoTone(diverse, state({ tone: "default" }))).toBeUndefined();
    expect(demoTone(plain, state({ tone: "medium" }))).toBeUndefined();
  });

  it.each(SNIPPET_TABS)("copies exactly what generateSnippet makes for $kind", ({ kind }) => {
    expect(demoSnippetCode(diverse, kind, state({ size: 32, tone: "light", play: "load" }))).toBe(
      generateSnippet(diverse, kind, { size: 32, tone: "light" }),
    );
    expect(demoSnippetCode(plain, kind, state({ tone: "dark", play: "load" }))).toBe(
      generateSnippet(plain, kind, { size: 96 }),
    );
  });

  it.each(SNIPPET_TABS.filter(({ kind }) => kind !== "no-code"))(
    "expresses each play in the $kind snippet, toned and plain",
    ({ kind }) => {
      for (const play of ["hover", "loop"] as const) {
        expect(demoSnippetCode(diverse, kind, state({ tone: "light", play }))).toBe(
          generateSnippet(diverse, kind, { size: 96, tone: "light", play }),
        );
        expect(demoSnippetCode(plain, kind, state({ play }))).toBe(
          generateSnippet(plain, kind, { size: 96, play }),
        );
      }
      expect(demoSnippetCode(plain, kind, state({ play: "loop" }))).toContain("infinite");
      expect(demoSnippetCode(plain, kind, state({ play: "hover" }))).toMatch(/play-?on-?hover/i);
    },
  );

  it("maps the state to the placeholder values", () => {
    expect(demoSlotValues(diverse, state({ size: 64, tone: "medium" }))).toEqual({
      id: diverse.id,
      size: "64",
      unicode: diverse.unicode,
      tone: "medium",
    });
    expect(demoSlotValues(plain, state({ tone: "medium" }))).not.toHaveProperty("tone");
  });
});

describe("tap playback", () => {
  it("starts a hover play from a touch or pen press", () => {
    expect(isTapPlayTrigger("hover", "touch")).toBe(true);
    expect(isTapPlayTrigger("hover", "pen")).toBe(true);
  });

  it("ignores a mouse press, which already plays through hover", () => {
    expect(isTapPlayTrigger("hover", "mouse")).toBe(false);
  });

  it("ignores presses when the play is not hover", () => {
    expect(isTapPlayTrigger("load", "touch")).toBe(false);
    expect(isTapPlayTrigger("loop", "touch")).toBe(false);
  });
});
