import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import {
  buildFilesSite,
  FILES_PIPELINE_VERSION,
  type EncodeFiles,
  type IndexEntry,
} from "./files-site.js";
import { deriveRegistry, listRegistryKeys } from "./public-slugs.js";
import { createTeamsManifest } from "./test-support.js";

const WAVING_ID = "1f44b_wavinghand";
const GRINNING_ID = "1f603_grinningfacewithbigeyes";

const state = {
  assetsDirectory: "",
  outputDirectory: "",
  manifest: { categories: [] } as Manifest,
};

const compareText = (a: string, b: string): number => a.localeCompare(b);

const encodeCalls: Parameters<EncodeFiles>[0][] = [];

const fakeEncode: EncodeFiles = (input) => {
  encodeCalls.push(input);
  return Promise.resolve({
    gif: Buffer.from("gif"),
    webp: Buffer.from("webp"),
    png: Buffer.from("png"),
  });
};

async function seedAssets(): Promise<void> {
  state.manifest = createTeamsManifest();
  const waving = state.manifest.categories[1]?.emoticons[0];
  Object.assign(waving ?? {}, { hd: true });
  await writeFile(
    path.join(state.assetsDirectory, "manifest.json"),
    JSON.stringify(state.manifest),
  );
  await writeFile(
    path.join(state.assetsDirectory, "version.json"),
    JSON.stringify({ builtAt: "2026-01-01T00:00:00.000Z", mitSha: "abc123" }),
  );
  await writeFile(
    path.join(state.assetsDirectory, "LICENSE-fluentui-emoji-animated.txt"),
    "MIT text",
  );
  const sheets = [
    `Smilies/${GRINNING_ID}.png`,
    ...["", "_s2", "_s3", "_s4", "_s5", "_s6"].map(
      (suffix) => `Hand gestures/${WAVING_ID}${suffix}@2x.png`,
    ),
  ];
  for (const sheet of sheets) {
    const target = path.join(state.assetsDirectory, "sprites", sheet);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, sheet);
  }
}

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), "files-site-"));
  state.assetsDirectory = path.join(root, "dist-assets");
  state.outputDirectory = path.join(root, "dist-files");
  await mkdir(state.assetsDirectory, { recursive: true });
  await seedAssets();
  encodeCalls.length = 0;
});

const build = (extra: { maxOutputFiles?: number } = {}) =>
  buildFilesSite({
    assetsDirectory: state.assetsDirectory,
    outputDirectory: state.outputDirectory,
    registry: deriveRegistry(state.manifest),
    encode: fakeEncode,
    concurrency: 2,
    ...extra,
  });

describe("buildFilesSite", () => {
  test("writes the three files for every emoji and skin tone", async () => {
    await build();
    const registry = deriveRegistry(state.manifest);
    const slugs = Object.values(registry.slugs);
    expect(slugs).toHaveLength(listRegistryKeys(state.manifest).length);
    for (const slug of slugs) {
      await expect(
        readFile(path.join(state.outputDirectory, "gif", `${slug}.gif`), "utf8"),
      ).resolves.toBe("gif");
      await expect(
        readFile(path.join(state.outputDirectory, "webp", `${slug}.webp`), "utf8"),
      ).resolves.toBe("webp");
      await expect(
        readFile(path.join(state.outputDirectory, "png", `${slug}.png`), "utf8"),
      ).resolves.toBe("png");
    }
  });

  test("index.json lists the registry slugs with their tones", async () => {
    await build();
    const index = JSON.parse(
      await readFile(path.join(state.outputDirectory, "index.json"), "utf8"),
    ) as IndexEntry[];
    const registry = deriveRegistry(state.manifest);
    const indexed = index.flatMap((entry) => [entry.slug, ...entry.tones.map((tone) => tone.slug)]);
    expect(indexed.toSorted(compareText)).toEqual(
      Object.values(registry.slugs).toSorted(compareText),
    );
    const waving = index.find((entry) => entry.id === WAVING_ID);
    expect(waving?.tones.map((tone) => tone.tone)).toEqual([
      "light",
      "medium-light",
      "medium",
      "medium-dark",
      "dark",
    ]);
    expect(waving).toMatchObject({
      slug: "waving-hand",
      category: "Hand gestures",
      unicode: "👋",
      etag: "v5",
      size: 200,
      urls: {
        gif: "/gif/waving-hand.gif",
        webp: "/webp/waving-hand.webp",
        png: "/png/waving-hand.png",
      },
    });
    expect(index.find((entry) => entry.id === GRINNING_ID)).toMatchObject({
      size: 100,
      tones: [],
    });
  });

  test("picks the HD sheet and frame size only when the emoji has HD", async () => {
    await build();
    const sheets = encodeCalls.map((call) => ({
      sheet: call.sheet.toString(),
      frameSize: call.frameSize,
    }));
    expect(sheets).toContainEqual({
      sheet: `Smilies/${GRINNING_ID}.png`,
      frameSize: 100,
    });
    const hd = sheets.filter((entry) => entry.sheet.includes(WAVING_ID));
    expect(hd).toHaveLength(6);
    expect(hd.every((entry) => entry.frameSize === 200)).toBe(true);
    expect(hd.every((entry) => entry.sheet.endsWith("@2x.png"))).toBe(true);
  });

  test("writes the version marker, license, notice and headers", async () => {
    await build();
    const version = JSON.parse(
      await readFile(path.join(state.outputDirectory, "version.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(version).toEqual({
      builtAt: "2026-01-01T00:00:00.000Z",
      mitSha: "abc123",
      filesPipelineVersion: FILES_PIPELINE_VERSION,
    });
    await expect(
      readFile(path.join(state.outputDirectory, "LICENSE-fluentui-emoji-animated.txt"), "utf8"),
    ).resolves.toBe("MIT text");
    const notice = await readFile(path.join(state.outputDirectory, "NOTICE.txt"), "utf8");
    expect(notice).toContain("Microsoft's");
    expect(notice.toLowerCase()).not.toContain("free to use");
    const headers = await readFile(path.join(state.outputDirectory, "_headers"), "utf8");
    expect(headers).toContain(
      "/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff",
    );
    for (const prefix of ["gif", "webp", "png"]) {
      expect(headers).toContain(
        `/${prefix}/*\n  Cache-Control: public, max-age=3600, stale-while-revalidate=86400`,
      );
    }
    expect(headers).toContain("/index.json\n  Cache-Control: public, max-age=300");
    expect(headers).toContain("/version.json\n  Cache-Control: no-cache");
  });

  test("fails when the output exceeds the file limit", async () => {
    await expect(build({ maxOutputFiles: 10 })).rejects.toThrow(/over the 10/);
  });

  test("fails when an emoji has no slug", async () => {
    await expect(
      buildFilesSite({
        assetsDirectory: state.assetsDirectory,
        outputDirectory: state.outputDirectory,
        registry: { version: 1, slugs: {} },
        encode: fakeEncode,
      }),
    ).rejects.toThrow(/No public slug/);
    await expect(readdir(state.outputDirectory)).rejects.toThrow();
  });
});
