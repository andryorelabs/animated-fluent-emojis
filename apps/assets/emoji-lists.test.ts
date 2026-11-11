import path from "node:path";
import { expect, test } from "vitest";

import {
  buildCategoryFileName,
  formatSource,
  renderEmojiIdModule,
  renderEmojiLists,
} from "./emoji-lists.js";
import { deriveRegistry } from "./public-slugs.js";
import { createTeamsManifest } from "./test-support.js";

const FILES = "https://files.example";

function render(manifest = createTeamsManifest()): Map<string, string> {
  return renderEmojiLists(manifest, deriveRegistry(manifest), FILES);
}

test("buildCategoryFileName matches the existing docs naming", () => {
  expect(buildCategoryFileName("Travel and places")).toBe("EMOJI_LIST_Travel_and_places.md");
  expect(buildCategoryFileName("Smilies")).toBe("EMOJI_LIST_Smilies.md");
});

test("renders one table per category and leaves the index alone", () => {
  const files = render();

  expect(files.keys().toArray()).toEqual([
    "EMOJI_LIST_Smilies.md",
    "EMOJI_LIST_Hand_gestures.md",
    "EMOJI_LIST_Symbols.md",
  ]);
  const smilies = files.get("EMOJI_LIST_Smilies.md") ?? "";
  expect(smilies).toContain("# Smilies");
  expect(smilies).toContain(
    '| 1f603_grinningfacewithbigeyes | <img src="https://files.example/png/grinning-face-with-big-eyes.png" width="32" height="32" alt=""> | 😃 | Grinning face with big eyes | grinning | [GIF](https://files.example/gif/grinning-face-with-big-eyes.gif) [WebP](https://files.example/webp/grinning-face-with-big-eyes.webp) [PNG](https://files.example/png/grinning-face-with-big-eyes.png) |',
  );
});

test("lists the file links of every skin tone of a diverse emoji", () => {
  const hands = render().get("EMOJI_LIST_Hand_gestures.md") ?? "";

  expect(hands).toContain('/png/waving-hand.png" width="32"');
  expect(hands).toContain(
    "<br>light: [GIF](https://files.example/gif/waving-hand-light.gif) [WebP](https://files.example/webp/waving-hand-light.webp) [PNG](https://files.example/png/waving-hand-light.png)",
  );
  expect(hands).toContain("<br>medium-dark: ");
});

test("trims a trailing slash from the files url and rejects a missing slug", () => {
  const manifest = createTeamsManifest();

  const smilies =
    renderEmojiLists(manifest, deriveRegistry(manifest), `${FILES}/`).get(
      "EMOJI_LIST_Smilies.md",
    ) ?? "";

  expect(smilies).not.toContain("example//");
  expect(() => renderEmojiLists(manifest, { version: 1, slugs: {} }, FILES)).toThrow(
    "No public slug for 1f603_grinningfacewithbigeyes",
  );
});

test("escapes pipes and collapses whitespace in cells", () => {
  const manifest = createTeamsManifest();
  const emoticon = manifest.categories[0]?.emoticons[0];
  if (!emoticon) throw new Error("fixture changed");
  const [smiliesCategory] = manifest.categories;
  if (!smiliesCategory) throw new Error("fixture changed");
  smiliesCategory.emoticons = [{ ...emoticon, description: "a | b\n  c" }];

  const smilies = render(manifest).get("EMOJI_LIST_Smilies.md") ?? "";

  expect(smilies).toContain(String.raw`a \| b c`);
});

test("formatSource applies the repository Oxfmt config to TypeScript", async () => {
  const formatted = await formatSource(
    'export type EmojiId =\n  | "b";\n',
    path.resolve(import.meta.dirname, "../../packages/animated-fluent-emojis/src/emoji-id.ts"),
  );

  expect(formatted).toBe('export type EmojiId = "b";\n');
});

test("formatSource rejects source Oxfmt cannot parse", async () => {
  await expect(formatSource("export type =", path.resolve("emoji-id.ts"))).rejects.toThrow(
    /Oxfmt failed to format/,
  );
});

test("formatSource aligns the table with the repository Oxfmt config", async () => {
  const source = "| A | B |\n| - | - |\n| longer cell | x |\n";

  const formatted = await formatSource(
    source,
    path.resolve(import.meta.dirname, "../../docs/EMOJI_LIST_Test.md"),
  );

  expect(formatted).toContain("| A           | B   |");
});

test("renders the EmojiId union with one literal per id", () => {
  const source = renderEmojiIdModule(createTeamsManifest());

  expect(source).toContain("export type EmojiId =");
  expect(source).toContain('  | "1f603_grinningfacewithbigeyes"');
  expect(source).toContain('  | "1f44b_wavinghand"');
  expect(source.match(/^ {2}\| "/gm)).toHaveLength(3);
});

test("renders DiverseEmojiId with only the diverse ids", () => {
  const source = renderEmojiIdModule(createTeamsManifest());
  const diverseSection = source.slice(source.indexOf("export type DiverseEmojiId"));

  expect(diverseSection).toContain('  | "1f44b_wavinghand"');
  expect(diverseSection).not.toContain("1f603_grinningfacewithbigeyes");
  expect(diverseSection.match(/^ {2}\| "/gm)).toHaveLength(1);
});

test("renders DiverseEmojiId as never when no id is diverse", () => {
  const manifest = createTeamsManifest();
  for (const category of manifest.categories) {
    for (const emoticon of category.emoticons) emoticon.diverse = false;
  }

  expect(renderEmojiIdModule(manifest)).toContain("export type DiverseEmojiId = never");
});
