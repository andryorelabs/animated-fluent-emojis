import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { indexEmoticons } from "./constants.js";

/**
 * Animation data measured from a converted sprite sheet.
 */
export interface AnimationState {
  readonly fps: number;
  readonly framesCount: number;
}

/**
 * A summary of how two manifests differ.
 */
export interface ManifestDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

/**
 * Compares two manifests by emoji id and etag.
 * @param previous The previously published manifest.
 * @param next The new manifest.
 * @returns The ids added, removed and whose etag changed.
 */
export function diffManifests(previous: Manifest, next: Manifest): ManifestDiff {
  const before = indexEmoticons(previous);
  const after = indexEmoticons(next);
  return {
    added: after
      .keys()
      .filter((id) => !before.has(id))
      .toArray(),
    removed: before
      .keys()
      .filter((id) => !after.has(id))
      .toArray(),
    changed: after
      .entries()
      .filter(([id, emoticon]) => before.has(id) && before.get(id)?.etag !== emoticon.etag)
      .map(([id]) => id)
      .toArray(),
  };
}

/**
 * Marks emoticons as having HD sheets and moves their etag to the HD-aware one.
 * @param manifest The manifest with real animations.
 * @param hdEtagById The HD-aware etag of every emoji published with HD sheets.
 * @returns A manifest where those emoticons carry `hd: true`.
 */
export function applyHd(manifest: Manifest, hdEtagById: ReadonlyMap<string, string>): Manifest {
  return {
    categories: manifest.categories.map((category) => ({
      ...category,
      emoticons: category.emoticons.map((emoticon) => {
        const etag = hdEtagById.get(emoticon.id);
        return etag === undefined ? emoticon : { ...emoticon, etag, hd: true };
      }),
    })),
  };
}

/**
 * Applies converted animation data to the official-repository emoticons.
 * @param manifest The merged manifest with placeholder animations.
 * @param animationsById Animation data keyed by emoji id.
 * @returns A manifest with the real `fps` and `framesCount`.
 */
export function applyAnimations(
  manifest: Manifest,
  animationsById: ReadonlyMap<string, AnimationState>,
): Manifest {
  return {
    categories: manifest.categories.map((category) => ({
      ...category,
      emoticons: category.emoticons.map((emoticon) => {
        const animation = animationsById.get(emoticon.id);
        return animation ? { ...emoticon, animation: { ...animation, firstFrame: 1 } } : emoticon;
      }),
    })),
  };
}

/**
 * Removes emoji that were skipped or not generated from a manifest. A category
 * emptied by skipped emoji is dropped too.
 * @param manifest The planned manifest.
 * @param skippedIds The ids that failed to build.
 * @param generatedIds When set, the only ids that may stay.
 * @returns The manifest without the removed emoji.
 */
export function pruneManifest(
  manifest: Manifest,
  skippedIds: ReadonlySet<string>,
  generatedIds: ReadonlySet<string> | undefined,
): Manifest {
  return {
    categories: manifest.categories
      .map((category) => ({
        ...category,
        emoticons: category.emoticons.filter(
          (emoticon) =>
            !skippedIds.has(emoticon.id) &&
            (generatedIds === undefined || generatedIds.has(emoticon.id)),
        ),
      }))
      .filter(
        (category) =>
          category.emoticons.length > 0 ||
          !manifest.categories
            .find((original) => original.id === category.id)
            ?.emoticons.some((emoticon) => skippedIds.has(emoticon.id)),
      ),
  };
}
