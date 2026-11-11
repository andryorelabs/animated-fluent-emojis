import { expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { HD_FRAME_SIZE, indexEmoticons, SPRITE_FRAME_SIZE, TONE_SUFFIXES } from "./constants.js";

const animation = { fps: 10, framesCount: 4, firstFrame: 1 };

test("frame sizes and tone suffixes match the published sheets", () => {
  expect(SPRITE_FRAME_SIZE).toBe(100);
  expect(HD_FRAME_SIZE).toBe(200);
  expect(TONE_SUFFIXES).toEqual(["_s2", "_s3", "_s4", "_s5", "_s6"]);
});

test("indexEmoticons keys every emoticon of every category by id", () => {
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
        emoticons: [{ id: "dog", etag: "e2", animation }],
      },
    ],
  } as unknown as Manifest;

  const index = indexEmoticons(manifest);

  expect(index.keys().toArray()).toEqual(["cat", "dog"]);
  expect(index.get("dog")?.etag).toBe("e2");
});
