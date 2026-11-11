import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";

/**
 * The runtime-facing subset of an emoji entry: no shortcuts, keywords or
 * unicode, which keeps the published payload about a third of the full size.
 */
interface SlimEmoticon {
  readonly id: string;
  readonly description: string;
  readonly etag: string;
  readonly diverse: boolean;
  readonly animation: {
    readonly fps: number;
    readonly framesCount: number;
    readonly firstFrame: number;
  };
  readonly hd?: unknown;
}

/**
 * The slim manifest shape published as `manifest.slim.json`.
 */
export interface SlimManifest {
  readonly categories: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly emoticons: readonly SlimEmoticon[];
  }[];
}

/**
 * Reduces the full manifest to the fields the runtime needs. `hd` is carried
 * over only on entries that have it.
 * @param manifest The full manifest.
 * @returns The categories reduced to the runtime fields.
 */
export function toSlimManifest(manifest: Manifest): SlimManifest {
  return {
    categories: manifest.categories.map((category) => ({
      id: category.id,
      title: category.title,
      description: category.description,
      emoticons: category.emoticons.map((emoticon) => {
        const { hd } = emoticon as { hd?: unknown };
        return {
          id: emoticon.id,
          description: emoticon.description,
          etag: emoticon.etag,
          diverse: emoticon.diverse,
          animation: emoticon.animation,
          ...(hd !== undefined && { hd }),
        };
      }),
    })),
  };
}
