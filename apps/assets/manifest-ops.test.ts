import { expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { pruneManifest } from "./manifest-ops.js";

const animation = { fps: 10, framesCount: 4, firstFrame: 1 };

const manifest = {
  categories: [
    {
      id: "a",
      title: "A",
      emoticons: [{ id: "cat", etag: "e1", animation }],
    },
    {
      id: "b",
      title: "B",
      emoticons: [
        { id: "dog", etag: "e2", animation },
        { id: "fox", etag: "e3", animation },
      ],
    },
  ],
} as unknown as Manifest;

test("pruneManifest drops a category emptied by skipped emoji", () => {
  const pruned = pruneManifest(manifest, new Set(["cat"]), undefined);

  expect(pruned.categories.map((category) => category.id)).toEqual(["b"]);
});

test("pruneManifest keeps only generated ids", () => {
  const pruned = pruneManifest(manifest, new Set(), new Set(["dog"]));

  expect(pruned.categories.map((category) => category.id)).toEqual(["a", "b"]);
  expect(pruned.categories[0]?.emoticons).toEqual([]);
  expect(pruned.categories[1]?.emoticons.map((emoticon) => emoticon.id)).toEqual(["dog"]);
});
