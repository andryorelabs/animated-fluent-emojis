import { useEffect, useState } from "react";

import { FILES_SITE_ORIGIN, parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import type { SearchEntry } from "../../gallery/search";

interface GalleryData {
  emojis: PublicEmoji[];
  searchIndex: SearchEntry[];
}

export type GalleryDataState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: GalleryData };

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${String(response.status)}`);
  }
  return response.json();
}

async function loadGalleryData(searchIndexUrl: string): Promise<GalleryData> {
  const [rawIndex, rawSearch] = await Promise.all([
    fetchJson(`${FILES_SITE_ORIGIN}/index.json`),
    fetchJson(searchIndexUrl),
  ]);
  if (!Array.isArray(rawSearch)) {
    throw new TypeError("The search index is not a list");
  }
  return {
    emojis: parsePublicIndex(rawIndex),
    searchIndex: rawSearch as SearchEntry[],
  };
}

interface Settled {
  attempt: number;
  result: { status: "error" } | { status: "ready"; data: GalleryData };
}

/**
 * Loads the public emoji index and the locale's search index in the browser.
 * @param searchIndexUrl - Site-relative URL of the locale's search index.
 * @returns The load state and a function that tries again after an error.
 */
export function useGalleryData(searchIndexUrl: string): {
  state: GalleryDataState;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let result: Settled["result"];
      try {
        result = {
          status: "ready",
          data: await loadGalleryData(searchIndexUrl),
        };
      } catch {
        result = { status: "error" };
      }
      if (!cancelled) setSettled({ attempt, result });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt, searchIndexUrl]);

  const state: GalleryDataState =
    settled?.attempt === attempt ? settled.result : { status: "loading" };
  return {
    state,
    retry: () => {
      setAttempt((current) => current + 1);
    },
  };
}
