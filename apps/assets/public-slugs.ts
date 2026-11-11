import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { TONE_SUFFIXES } from "./constants.js";

/**
 * The committed registry of frozen public slugs.
 */
export interface SlugRegistry {
  /** Registry format version. */
  version: 1;
  /** Slugs keyed by `${id}${toneSuffix}`, sorted by key. */
  slugs: Record<string, string>;
}

/**
 * Pattern every public slug must match.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const TONE_SLUGS: Record<(typeof TONE_SUFFIXES)[number], string> = {
  _s2: "-light",
  _s3: "-medium-light",
  _s4: "-medium",
  _s5: "-medium-dark",
  _s6: "-dark",
};

const toKebab = (text: string): string =>
  text
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

/**
 * Turns an emoji description into a kebab-case slug.
 * @param description The human-readable description.
 * @param fallback The value slugified instead when the description yields nothing.
 * @returns A slug matching {@link SLUG_PATTERN}.
 */
export function slugify(description: string, fallback: string): string {
  return toKebab(description) || toKebab(fallback) || "emoji";
}

/**
 * One registry key of a manifest.
 */
export interface RegistryKey {
  /** The emoji id. */
  id: string;
  /** The registry key, `${id}${toneSuffix}`. */
  key: string;
  /** The slug suffix of the tone, empty for the default tone. */
  tone: string;
}

/**
 * Lists every registry key of a manifest in manifest order: the default tone
 * of each emoji, followed by its five skin tones when it is diverse.
 * @param manifest The manifest to enumerate.
 * @returns The keys in manifest order.
 */
export function listRegistryKeys(manifest: Manifest): RegistryKey[] {
  return manifest.categories.flatMap((category) =>
    category.emoticons.flatMap((emoticon) => {
      const variants = emoticon.diverse
        ? [
            { suffix: "", tone: "" },
            ...TONE_SUFFIXES.map((suffix) => ({
              suffix: suffix,
              tone: TONE_SLUGS[suffix],
            })),
          ]
        : [{ suffix: "", tone: "" }];
      return variants.map(({ suffix, tone }) => ({
        id: emoticon.id,
        key: `${emoticon.id}${suffix}`,
        tone,
      }));
    }),
  );
}

const compareKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function sortSlugs(slugs: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(slugs).toSorted(([a], [b]) => compareKeys(a, b)));
}

function nextFreeSlug(candidate: string, taken: ReadonlySet<string>): string {
  if (!taken.has(candidate)) return candidate;
  for (let suffix = 2; ; suffix += 1) {
    const next = `${candidate}-${String(suffix)}`;
    if (!taken.has(next)) return next;
  }
}

/**
 * Extends a frozen registry with slugs for every manifest key it lacks.
 * Frozen slugs never change, and slugs of emoji no longer in the manifest stay
 * reserved so they are never reused. Collisions get `-2`, `-3`, ... in
 * manifest order.
 * @param manifest The manifest to cover.
 * @param frozen The registry whose slugs are kept as-is.
 * @returns A sorted registry covering the manifest and everything frozen.
 */
export function deriveRegistry(manifest: Manifest, frozen?: SlugRegistry): SlugRegistry {
  const slugs: Record<string, string> = { ...frozen?.slugs };
  const taken = new Set(Object.values(slugs));
  const descriptions = new Map(
    manifest.categories.flatMap((category) =>
      category.emoticons.map((emoticon) => [emoticon.id, emoticon.description] as const),
    ),
  );
  const baseSlugs = new Map<string, string>();
  for (const { id, key, tone } of listRegistryKeys(manifest)) {
    if (Object.hasOwn(slugs, key)) continue;
    const baseSlug =
      baseSlugs.get(id) ??
      slugs[id] ??
      nextFreeSlug(slugify(descriptions.get(id) ?? id, id), taken);
    baseSlugs.set(id, baseSlug);
    const slug = nextFreeSlug(`${baseSlug}${tone}`, taken);
    slugs[key] = slug;
    taken.add(slug);
  }
  return { version: 1, slugs: sortSlugs(slugs) };
}

/**
 * Derives the registry a live `index.json` implies: one key per emoji and per
 * skin tone.
 * @param entries The `id`, `slug` and tones of every `index.json` entry.
 * @returns The sorted registry of the live slugs.
 * @throws {Error} When a tone is not a known skin tone.
 */
export function registryFromIndex(
  entries: readonly {
    id: string;
    slug: string;
    tones: readonly { tone: string; slug: string }[];
  }[],
): SlugRegistry {
  const suffixByTone = new Map(
    TONE_SUFFIXES.map((suffix) => [TONE_SLUGS[suffix].slice(1), suffix]),
  );
  const slugs: Record<string, string> = {};
  for (const { id, slug, tones } of entries) {
    slugs[id] = slug;
    for (const { tone, slug: toneSlug } of tones) {
      const suffix = suffixByTone.get(tone);
      if (suffix === undefined) {
        throw new Error(`Unknown skin tone "${tone}" for ${id} in index.json.`);
      }
      slugs[`${id}${suffix}`] = toneSlug;
    }
  }
  return { version: 1, slugs: sortSlugs(slugs) };
}

/**
 * Merges the committed registry with the registry derived from the live files site.
 * @param committed The registry committed in the repository.
 * @param live The registry derived from the live `index.json`.
 * @returns The sorted union of both registries.
 * @throws {Error} When a key maps to different slugs, or two keys share a slug.
 */
export function mergeRegistries(committed: SlugRegistry, live: SlugRegistry): SlugRegistry {
  const slugs: Record<string, string> = { ...committed.slugs };
  for (const [key, slug] of Object.entries(live.slugs)) {
    const existing = slugs[key];
    if (existing !== undefined && existing !== slug) {
      throw new Error(`Slug conflict for ${key}: committed "${existing}" vs live "${slug}".`);
    }
    slugs[key] = slug;
  }
  const owners = new Map<string, string>();
  for (const [key, slug] of Object.entries(slugs)) {
    const owner = owners.get(slug);
    if (owner !== undefined) {
      throw new Error(`Slug "${slug}" is used by both ${owner} and ${key}.`);
    }
    owners.set(slug, key);
  }
  return { version: 1, slugs: sortSlugs(slugs) };
}
