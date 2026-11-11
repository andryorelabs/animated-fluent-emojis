import { expect, test } from "vitest";

import { toSlimManifest } from "./slim-manifest.js";
import { createTeamsManifest } from "./test-support.js";

test("keeps only the runtime fields and omits absent hd", () => {
  const slim = toSlimManifest(createTeamsManifest());

  const [smilies] = slim.categories;
  expect(Object.keys(smilies ?? {})).toEqual(["id", "title", "description", "emoticons"]);
  const [grinning] = smilies?.emoticons ?? [];
  expect(Object.keys(grinning ?? {}).toSorted((a, b) => a.localeCompare(b))).toEqual([
    "animation",
    "description",
    "diverse",
    "etag",
    "id",
  ]);
});

test("carries hd over when present", () => {
  const manifest = createTeamsManifest();
  const hd = { framesCount: 10 };
  const first = manifest.categories[0]?.emoticons[0];
  Object.assign(first ?? {}, { hd });

  const slim = toSlimManifest(manifest);

  expect(slim.categories[0]?.emoticons[0]?.hd).toEqual(hd);
});

test("keeps the legacy entry shape with every field explicit", () => {
  const manifest = createTeamsManifest();
  const [wave] = manifest.categories[1]?.emoticons ?? [];

  const slim = toSlimManifest(manifest);

  expect(slim.categories[1]?.emoticons[0]).toEqual({
    id: wave?.id,
    description: wave?.description,
    etag: wave?.etag,
    diverse: true,
    animation: { fps: 24, framesCount: 21, firstFrame: 1 },
  });
});
