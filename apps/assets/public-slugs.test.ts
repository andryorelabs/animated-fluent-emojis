import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import {
  deriveRegistry,
  listRegistryKeys,
  mergeRegistries,
  registryFromIndex,
  SLUG_PATTERN,
  slugify,
  type SlugRegistry,
} from "./public-slugs.js";

const LIVE_MANIFEST_URL = "https://animated-fluent-emojis.pages.dev/manifest.json";
const LOCAL_MANIFEST_PATH = new URL("dist-assets/manifest.json", import.meta.url);
const COMMITTED_PATH = new URL("public-slugs.json", import.meta.url);

const createManifest = (
  entries: readonly { id: string; description: string; diverse?: boolean }[],
): Manifest => ({
  categories: [
    {
      id: "c",
      title: "C",
      description: "C",
      emoticons: entries.map(({ id, description, diverse = false }) => ({
        id,
        description,
        shortcuts: [],
        unicode: "x",
        etag: "e",
        diverse,
        animation: { fps: 24, framesCount: 10, firstFrame: 1 },
        keywords: [],
      })),
    },
  ],
});

const registry = (slugs: Record<string, string>): SlugRegistry => ({
  version: 1,
  slugs,
});

describe("slugify", () => {
  test("kebab-cases, strips accents and spells out ampersands", () => {
    expect(slugify("Piñata & Café!", "x")).toBe("pinata-and-cafe");
  });

  test("falls back to the id when the description is empty", () => {
    expect(slugify("!!!", "1f600_grin")).toBe("1f600-grin");
  });
});

describe("deriveRegistry", () => {
  test("adds tone suffixes and sorts keys", () => {
    const result = deriveRegistry(
      createManifest([
        { id: "b", description: "Waving hand", diverse: true },
        { id: "a", description: "Plain" },
      ]),
    );
    expect(Object.keys(result.slugs)).toEqual(["a", "b", "b_s2", "b_s3", "b_s4", "b_s5", "b_s6"]);
    expect(result.slugs.b_s2).toBe("waving-hand-light");
    expect(result.slugs.b_s3).toBe("waving-hand-medium-light");
    expect(result.slugs.b_s6).toBe("waving-hand-dark");
  });

  test("numbers duplicate descriptions in manifest order", () => {
    const result = deriveRegistry(
      createManifest([
        { id: "one", description: "Same" },
        { id: "two", description: "Same" },
        { id: "three", description: "Same" },
      ]),
    );
    expect(result.slugs).toEqual({
      one: "same",
      three: "same-3",
      two: "same-2",
    });
  });

  test("never changes a frozen slug when the description changes", () => {
    const frozen = registry({ a: "old-name" });
    const result = deriveRegistry(createManifest([{ id: "a", description: "New name" }]), frozen);
    expect(result.slugs.a).toBe("old-name");
  });

  test("never reuses the slug of a removed emoji", () => {
    const frozen = registry({ gone: "party" });
    const result = deriveRegistry(createManifest([{ id: "fresh", description: "Party" }]), frozen);
    expect(result.slugs.gone).toBe("party");
    expect(result.slugs.fresh).toBe("party-2");
  });

  test("builds new tone slugs on a frozen default slug", () => {
    const result = deriveRegistry(
      createManifest([{ id: "a", description: "Renamed", diverse: true }]),
      registry({ a: "original" }),
    );
    expect(result.slugs.a_s2).toBe("original-light");
  });
});

describe("mergeRegistries", () => {
  test("unions disjoint and agreeing registries", () => {
    const merged = mergeRegistries(
      registry({ b: "bee", a: "ay" }),
      registry({ a: "ay", c: "sea" }),
    );
    expect(Object.keys(merged.slugs)).toEqual(["a", "b", "c"]);
  });

  test("throws when the same key has different slugs", () => {
    expect(() => mergeRegistries(registry({ a: "one" }), registry({ a: "two" }))).toThrow(
      /conflict/i,
    );
  });

  test("throws when two keys share a slug", () => {
    expect(() => mergeRegistries(registry({ a: "same" }), registry({ b: "same" }))).toThrow(
      /used by both/,
    );
  });
});

const loadLiveManifest = async (): Promise<Manifest | undefined> => {
  if (existsSync(LOCAL_MANIFEST_PATH)) {
    return JSON.parse(readFileSync(LOCAL_MANIFEST_PATH, "utf8")) as Manifest;
  }
  try {
    const response = await fetch(LIVE_MANIFEST_URL);
    return response.ok ? ((await response.json()) as Manifest) : undefined;
  } catch {
    return undefined;
  }
};

describe("committed public-slugs.json", () => {
  const committed = JSON.parse(readFileSync(COMMITTED_PATH, "utf8")) as SlugRegistry;

  test("has valid, unique slugs and sorted keys", () => {
    const slugs = Object.values(committed.slugs);
    expect(committed.version).toBe(1);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN);
    const resorted = deriveRegistry(createManifest([]), committed);
    expect(Object.keys(resorted.slugs)).toEqual(Object.keys(committed.slugs));
  });

  test.skipIf(process.env.CHECK_LIVE_SLUGS !== "1")(
    "covers every tone variant of the live catalog",
    async () => {
      const manifest = await loadLiveManifest();
      if (manifest === undefined) {
        throw new Error("The live manifest could not be loaded");
      }
      const keys = new Set(Object.keys(committed.slugs));
      const missing = listRegistryKeys(manifest)
        .map(({ key }) => key)
        .filter((key) => !keys.has(key));
      expect(missing).toEqual([]);
    },
  );
});

test("registryFromIndex maps entries and tones back to registry keys", () => {
  expect(
    registryFromIndex([
      {
        id: "1f44b_wavinghand",
        slug: "waving-hand",
        tones: [{ tone: "medium-dark", slug: "waving-hand-medium-dark" }],
      },
    ]).slugs,
  ).toEqual({
    "1f44b_wavinghand": "waving-hand",
    "1f44b_wavinghand_s5": "waving-hand-medium-dark",
  });
  expect(() =>
    registryFromIndex([{ id: "x", slug: "x", tones: [{ tone: "purple", slug: "x-purple" }] }]),
  ).toThrow("Unknown skin tone");
});
