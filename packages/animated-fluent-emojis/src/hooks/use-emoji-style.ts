import { useEffect, useSyncExternalStore } from "react";

import {
  getManifestSnapshot,
  getServerManifestSnapshot,
  startManifestLoad,
  subscribeToManifest,
  type EmojiManifest,
} from "../utils/index.js";

export type UseEmojiStyleResult =
  | { status: "loading"; emoji: null }
  | { status: "ready"; emoji: EmojiManifest }
  | { status: "missing"; emoji: null }
  | { status: "error"; emoji: null };

/**
 * Reads the manifest entry for an emoji from the shared manifest store.
 * @param id - Key of the emoji in the manifest.
 * @returns `loading` while the manifest is pending, `ready` with the entry,
 * `missing` when the id is unknown, or `error` when the manifest failed to
 * load. A failed load is retried on mount, on `preloadEmojis` and when the
 * browser comes back online.
 */
export const useEmojiStyle = (id: string): UseEmojiStyleResult => {
  const snapshot = useSyncExternalStore(
    subscribeToManifest,
    getManifestSnapshot,
    getServerManifestSnapshot,
  );

  useEffect(() => {
    void startManifestLoad();
  }, []);

  if (snapshot.status === "error") return { status: "error", emoji: null };
  if (snapshot.status !== "ready") return { status: "loading", emoji: null };
  const emoji = snapshot.manifest[id];
  return emoji ? { status: "ready", emoji } : { status: "missing", emoji: null };
};
