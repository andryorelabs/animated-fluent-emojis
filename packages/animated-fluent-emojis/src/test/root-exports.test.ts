import { expect, test } from "vitest";

import * as rootEntry from "../index.js";
import { createEmoji } from "../vanilla/create-emoji.js";

test("the root exports the vanilla createEmoji", () => {
  expect(rootEntry.createEmoji).toBe(createEmoji);
});

test("the root exports only the framework-free runtime API", () => {
  expect(new Set(Object.keys(rootEntry))).toEqual(
    new Set(["configureEmojis", "createEmoji", "preloadEmojis"]),
  );
});
