import type { CompactManifest } from "../utils/index.js";

export const MANIFEST_URL = "https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json";

export const SPRITE_URL_PATTERN = "https://animated-fluent-emojis-cdn.andryore.dev/v1/sprites/*";

export const FIXTURE_MANIFEST: CompactManifest = {
  categories: [
    {
      id: "smilies",
      title: "Smilies",
      description: "Faces",
      emoticons: [
        {
          id: "grinning-face",
          description: "Grinning face",
          etag: "etag-grin",
          unicode: "😀",
          animation: { framesCount: 40, fps: 20, firstFrame: 2 },
        },
        {
          id: "waving-hand",
          description: "Waving hand",
          etag: "etag-wave",
          unicode: "👋",
          animation: { framesCount: 21 },
          diverse: true,
          hd: true,
        },
      ],
    },
    {
      id: "animals",
      title: "Animals",
      description: "Critters",
      emoticons: [
        {
          id: "cat",
          description: "Cat",
          etag: "etag-cat",
          unicode: "🐱",
          animation: { framesCount: 20, fps: 10 },
        },
      ],
    },
  ],
};

export const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
