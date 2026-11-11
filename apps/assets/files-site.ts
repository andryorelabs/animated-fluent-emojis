import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { getConversionConcurrency } from "./build-context.js";
import { buildHdOutputPath, buildOutputPath } from "./catalog.js";
import { HD_FRAME_SIZE, SPRITE_FRAME_SIZE } from "./constants.js";
import { assertFileCountWithinLimit, MAX_OUTPUT_FILES } from "./guards.js";
import { mapWithConcurrency } from "./http.js";
import { encodePublicFiles, type PublicFiles, type PublicFilesInput } from "./public-files.js";
import { listRegistryKeys, type SlugRegistry } from "./public-slugs.js";

/**
 * Version of the files pipeline. Bump it to republish every file after an
 * encoding change.
 */
export const FILES_PIPELINE_VERSION = 1;

const LICENSE_FILE_NAME = "LICENSE-fluentui-emoji-animated.txt";

const FILE_CACHE_CONTROL = "Cache-Control: public, max-age=3600, stale-while-revalidate=86400";

const HEADERS_FILE = `/*
  Access-Control-Allow-Origin: *
  X-Content-Type-Options: nosniff

/gif/*
  ${FILE_CACHE_CONTROL}

/webp/*
  ${FILE_CACHE_CONTROL}

/png/*
  ${FILE_CACHE_CONTROL}

/index.json
  Cache-Control: public, max-age=300

/version.json
  Cache-Control: no-cache
`;

const NOTICE_TEXT = `Animated Fluent emojis: files site

The emoji artwork is Microsoft's. The code is open source. Not affiliated with
or endorsed by Microsoft.

The artwork remains Microsoft's, and its use is subject to Microsoft's terms.
Some emojis come from Microsoft's MIT-licensed repository; the notice that
applies to them is in ${LICENSE_FILE_NAME}.

These files are provided as they are, without warranty of any kind. Check the
terms that apply to the artwork before you use it in your own work.
`;

/**
 * Encodes a sprite sheet into the three public files.
 */
export type EncodeFiles = (input: PublicFilesInput) => Promise<PublicFiles>;

/**
 * The public URLs of one emoji or tone, relative to the files site root.
 */
interface FileUrls {
  readonly gif: string;
  readonly webp: string;
  readonly png: string;
}

/**
 * One skin tone of an emoji in `index.json`.
 */
interface IndexTone {
  readonly tone: string;
  readonly slug: string;
  readonly urls: FileUrls;
}

/**
 * One emoji of `index.json`. `size` is the frame edge in pixels.
 */
export interface IndexEntry {
  readonly slug: string;
  readonly id: string;
  readonly description: string;
  readonly unicode: string;
  readonly category: string;
  readonly keywords: readonly string[];
  readonly etag: string;
  readonly size: number;
  readonly urls: FileUrls;
  readonly tones: readonly IndexTone[];
}

/**
 * Options for {@link buildFilesSite}.
 */
export interface FilesSiteOptions {
  readonly assetsDirectory: string;
  readonly outputDirectory: string;
  readonly registry: SlugRegistry;
  readonly encode?: EncodeFiles | undefined;
  readonly maxOutputFiles?: number;
  readonly concurrency?: number;
}

interface FileJob {
  readonly slug: string;
  readonly sheetPath: string;
  readonly frameSize: number;
  readonly framesCount: number;
  readonly fps: number;
  readonly firstFrame: number;
}

const buildUrls = (slug: string): FileUrls => ({
  gif: `/gif/${slug}.gif`,
  webp: `/webp/${slug}.webp`,
  png: `/png/${slug}.png`,
});

function requireSlug(registry: SlugRegistry, key: string): string {
  const slug = registry.slugs[key];
  if (slug === undefined) throw new Error(`No public slug for ${key}`);
  return slug;
}

function planSite(
  manifest: Manifest,
  registry: SlugRegistry,
): { entries: IndexEntry[]; jobs: FileJob[] } {
  const keysById = Map.groupBy(listRegistryKeys(manifest), ({ id }) => id);
  const entries: IndexEntry[] = [];
  const jobs: FileJob[] = [];
  for (const category of manifest.categories) {
    for (const emoticon of category.emoticons) {
      const hasHd = (emoticon as { hd?: unknown }).hd !== undefined;
      const frameSize = hasHd ? HD_FRAME_SIZE : SPRITE_FRAME_SIZE;
      const buildSheetPath = hasHd ? buildHdOutputPath : buildOutputPath;
      const { fps, firstFrame, framesCount } = emoticon.animation;
      const planJob = (key: string): string => {
        const slug = requireSlug(registry, key);
        jobs.push({
          slug,
          sheetPath: buildSheetPath(category.title, emoticon.id, key.slice(emoticon.id.length)),
          frameSize,
          framesCount,
          fps,
          firstFrame,
        });
        return slug;
      };
      const [defaultKey, ...toneKeys] = keysById.get(emoticon.id) ?? [];
      if (defaultKey === undefined) continue;
      const slug = planJob(defaultKey.key);
      const tones = toneKeys.map(({ key, tone }) => {
        const toneSlug = planJob(key);
        return {
          tone: tone.replace(/^-/, ""),
          slug: toneSlug,
          urls: buildUrls(toneSlug),
        };
      });
      entries.push({
        slug,
        id: emoticon.id,
        description: emoticon.description,
        unicode: emoticon.unicode,
        category: category.title,
        keywords: emoticon.keywords,
        etag: emoticon.etag,
        size: frameSize,
        urls: buildUrls(slug),
        tones,
      });
    }
  }
  return { entries, jobs };
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/**
 * Builds the public files site from the asset site's sprite sheets: a GIF, a
 * WebP and a PNG poster for every emoji and skin tone, the index, the version
 * marker, the license notices and the headers file.
 * @param options Where to read and write, the frozen slugs and the injectable encoder.
 * @throws {Error} When an emoji has no slug, or the output exceeds the file limit.
 */
export async function buildFilesSite(options: FilesSiteOptions): Promise<void> {
  const {
    assetsDirectory,
    outputDirectory,
    registry,
    encode = encodePublicFiles,
    maxOutputFiles = MAX_OUTPUT_FILES,
    concurrency = getConversionConcurrency(),
  } = options;
  const manifest = await readJson<Manifest>(path.join(assetsDirectory, "manifest.json"));
  const assetVersion = await readJson<{ builtAt: string; mitSha: string }>(
    path.join(assetsDirectory, "version.json"),
  );
  const { entries, jobs } = planSite(manifest, registry);
  await rm(outputDirectory, { recursive: true, force: true });
  await Promise.all(
    ["gif", "webp", "png"].map((directory) =>
      mkdir(path.join(outputDirectory, directory), { recursive: true }),
    ),
  );
  await mapWithConcurrency(jobs, concurrency, async (job) => {
    const files = await encode({
      sheet: await readFile(path.join(assetsDirectory, job.sheetPath)),
      frameSize: job.frameSize,
      framesCount: job.framesCount,
      fps: job.fps,
      firstFrame: job.firstFrame,
    });
    await Promise.all([
      writeFile(path.join(outputDirectory, "gif", `${job.slug}.gif`), files.gif),
      writeFile(path.join(outputDirectory, "webp", `${job.slug}.webp`), files.webp),
      writeFile(path.join(outputDirectory, "png", `${job.slug}.png`), files.png),
    ]);
  });
  await writeFile(path.join(outputDirectory, "index.json"), JSON.stringify(entries));
  await writeFile(
    path.join(outputDirectory, "version.json"),
    JSON.stringify(
      {
        builtAt: assetVersion.builtAt,
        mitSha: assetVersion.mitSha,
        filesPipelineVersion: FILES_PIPELINE_VERSION,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDirectory, LICENSE_FILE_NAME),
    await readFile(path.join(assetsDirectory, LICENSE_FILE_NAME), "utf8"),
  );
  await writeFile(path.join(outputDirectory, "NOTICE.txt"), NOTICE_TEXT);
  await writeFile(path.join(outputDirectory, "_headers"), HEADERS_FILE);
  await assertFileCountWithinLimit(outputDirectory, maxOutputFiles);
}
