/**
 * The files site that serves public files and the public index.
 */
export const FILES_SITE_ORIGIN = "https://animated-fluent-emojis-files.andryore.dev";

export const FILE_FORMATS = ["gif", "webp", "png"] as const;

type FileFormat = (typeof FILE_FORMATS)[number];

export type FileUrls = Record<FileFormat, string>;

export const SKIN_TONES = ["light", "medium-light", "medium", "medium-dark", "dark"] as const;

export type SkinTone = (typeof SKIN_TONES)[number];

interface EmojiToneVariant {
  tone: SkinTone;
  slug: string;
  unicode?: string;
  urls: FileUrls;
}

export interface PublicEmoji {
  slug: string;
  id: string;
  description: string;
  unicode: string;
  category: string;
  keywords: string[];
  urls: FileUrls;
  tones: EmojiToneVariant[];
}

/**
 * Thrown when the public index cannot be fetched or does not match the
 * expected shape, so the build stops instead of shipping a broken gallery.
 */
export class PublicIndexError extends Error {
  constructor(message: string) {
    super(`Public index: ${message}`);
    this.name = "PublicIndexError";
  }
}

type Fetcher = (url: string) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, field: string, where: string): string {
  const value = record[field];
  if (typeof value !== "string" || value === "") {
    throw new PublicIndexError(`${where} is missing a non-empty "${field}"`);
  }
  return value;
}

function readUrls(value: unknown, where: string): FileUrls {
  if (!isRecord(value)) {
    throw new PublicIndexError(`${where} is missing "urls"`);
  }
  return {
    gif: readString(value, "gif", `${where} urls`),
    webp: readString(value, "webp", `${where} urls`),
    png: readString(value, "png", `${where} urls`),
  };
}

function readTone(value: unknown, where: string): EmojiToneVariant {
  if (!isRecord(value)) {
    throw new PublicIndexError(`${where} is not an object`);
  }
  const tone = readString(value, "tone", where);
  if (!SKIN_TONES.includes(tone as SkinTone)) {
    throw new PublicIndexError(`${where} has unknown tone "${tone}"`);
  }
  return {
    tone: tone as SkinTone,
    slug: readString(value, "slug", where),
    ...(typeof value.unicode === "string" && value.unicode !== "" && { unicode: value.unicode }),
    urls: readUrls(value.urls, where),
  };
}

function readEmoji(value: unknown, position: number): PublicEmoji {
  const where = `entry ${String(position)}`;
  if (!isRecord(value)) {
    throw new PublicIndexError(`${where} is not an object`);
  }
  const keywords = value.keywords;
  if (!Array.isArray(keywords) || keywords.some((keyword) => typeof keyword !== "string")) {
    throw new PublicIndexError(`${where} is missing "keywords"`);
  }
  const tones = value.tones;
  if (!Array.isArray(tones)) {
    throw new PublicIndexError(`${where} is missing "tones"`);
  }
  return {
    slug: readString(value, "slug", where),
    id: readString(value, "id", where),
    description: readString(value, "description", where),
    unicode: readString(value, "unicode", where),
    category: readString(value, "category", where),
    keywords: keywords as string[],
    urls: readUrls(value.urls, where),
    tones: tones.map((tone, toneIndex) => readTone(tone, `${where} tone ${String(toneIndex)}`)),
  };
}

/**
 * Validates the parsed `index.json` and narrows it to typed emojis.
 * @param raw - The parsed JSON document.
 * @returns The emojis, in index order.
 * @throws {PublicIndexError} When the list is empty, an entry lacks a field or
 * a slug repeats.
 */
export function parsePublicIndex(raw: unknown): PublicEmoji[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new PublicIndexError("expected a non-empty list of emojis");
  }
  const emojis = raw.map((entry, position) => readEmoji(entry, position));
  const seen = new Set<string>();
  for (const { slug } of emojis) {
    if (seen.has(slug)) {
      throw new PublicIndexError(`duplicate slug "${slug}"`);
    }
    seen.add(slug);
  }
  return emojis;
}

/**
 * Fetches and validates the public index.
 * @param fetcher - Defaults to the global `fetch`; tests inject a stub.
 * @param origin - The files site origin.
 * @returns The validated emojis.
 * @throws {PublicIndexError} When the site is unreachable or the body is invalid.
 */
export async function fetchPublicIndex(
  fetcher: Fetcher = fetch,
  origin: string = FILES_SITE_ORIGIN,
): Promise<PublicEmoji[]> {
  const url = `${origin}/index.json`;
  let response: Response;
  try {
    response = await fetcher(url);
  } catch (error) {
    throw new PublicIndexError(`${url} is unreachable (${String(error)})`);
  }
  if (!response.ok) {
    throw new PublicIndexError(`${url} answered ${String(response.status)}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PublicIndexError(`${url} did not return valid JSON`);
  }
  return parsePublicIndex(body);
}

const memoizedIndex = new Map<string, Promise<PublicEmoji[]>>();

function restrictToSlugs(emojis: PublicEmoji[]): PublicEmoji[] {
  const only = process.env.SITE_EMOJI_SLUGS;
  if (only === undefined || only === "") return emojis;
  const wanted = new Set(only.split(","));
  return emojis.filter((emoji) => wanted.has(emoji.slug));
}

async function fetchOrForget(): Promise<PublicEmoji[]> {
  try {
    return restrictToSlugs(await fetchPublicIndex());
  } catch (error) {
    memoizedIndex.delete(FILES_SITE_ORIGIN);
    throw error;
  }
}

/**
 * Loads the public index once per build; later calls share the same promise.
 * A failure is not cached, so the next call retries. `SITE_EMOJI_SLUGS`, a
 * comma-separated list, keeps only those emojis so tests can build a small
 * site.
 * @returns The validated emojis.
 */
export function loadPublicIndex(): Promise<PublicEmoji[]> {
  let pending = memoizedIndex.get(FILES_SITE_ORIGIN);
  if (!pending) {
    pending = fetchOrForget();
    memoizedIndex.set(FILES_SITE_ORIGIN, pending);
  }
  return pending;
}

/**
 * Absolute URL of a public file.
 * @param path - A `urls` value from the index, such as `/gif/fire.gif`.
 * @param origin - The files site origin.
 * @returns The absolute URL.
 */
export function fileUrl(path: string, origin: string = FILES_SITE_ORIGIN): string {
  return `${origin}${path}`;
}
