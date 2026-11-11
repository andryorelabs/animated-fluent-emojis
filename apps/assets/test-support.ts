import sharp from "sharp";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { FetchLike } from "./http.js";

/**
 * A canned response for {@link createFakeFetch}.
 */
export interface FakeResponse {
  readonly status?: number;
  readonly headers?: Record<string, string>;
  readonly body?: string | Uint8Array | object;
}

/**
 * A fake fetch and the requests it received.
 */
export interface FakeFetch {
  readonly fetch: FetchLike;
  readonly requests: string[];
}

/**
 * Creates a fetch that answers from a route table keyed by `METHOD url`.
 * Unknown routes answer 404.
 * @param routes Canned responses keyed by `GET https://example.com/a`.
 * @returns The fake fetch and its request log.
 */
export function createFakeFetch(routes: Record<string, FakeResponse>): FakeFetch {
  const requests: string[] = [];
  const fakeFetch: FetchLike = (input, init) => {
    const key = `${init?.method ?? "GET"} ${input}`;
    requests.push(key);
    const route = routes[key];
    if (!route) return Promise.resolve(new Response("not found", { status: 404 }));
    const { body = "", status = 200, headers = {} } = route;
    const payload =
      typeof body === "string"
        ? body
        : body instanceof Uint8Array
          ? new Uint8Array(body)
          : JSON.stringify(body);
    return Promise.resolve(new Response(new Blob([payload]), { status, headers }));
  };
  return { fetch: fakeFetch, requests };
}

/**
 * Builds a small Teams-style manifest for tests.
 * @returns A manifest with one plain and one skin-tone emoticon.
 */
export function createTeamsManifest(): Manifest {
  return {
    categories: [
      {
        id: "smilies-id",
        title: "Smilies",
        description: "Smilies",
        emoticons: [
          {
            id: "1f603_grinningfacewithbigeyes",
            description: "Grinning face with big eyes",
            shortcuts: [],
            unicode: "😃",
            etag: "v11",
            diverse: false,
            animation: { fps: 24, framesCount: 72, firstFrame: 1 },
            keywords: ["grinning"],
          },
        ],
      },
      {
        id: "hands-id",
        title: "Hand gestures",
        description: "Hand gestures",
        emoticons: [
          {
            id: "1f44b_wavinghand",
            description: "Waving hand",
            shortcuts: [],
            unicode: "👋",
            etag: "v5",
            diverse: true,
            animation: { fps: 24, framesCount: 21, firstFrame: 1 },
            keywords: ["wave"],
          },
        ],
      },
      {
        id: "symbols-id",
        title: "Symbols",
        description: "Symbols",
        emoticons: [],
      },
    ],
  };
}

/**
 * Encodes a blank vertical sprite sheet.
 * @param framesCount How many frames tall the sheet is.
 * @param options Optional overrides.
 * @param options.frameSize The frame edge in pixels (default 100).
 * @param options.width The sheet width, when it should differ from the frame size.
 * @returns PNG bytes of `width x framesCount * frameSize` pixels.
 */
export async function createSpritePng(
  framesCount: number,
  options: { frameSize?: number; width?: number } = {},
): Promise<Buffer> {
  const frameSize = options.frameSize ?? 100;
  return sharp({
    create: {
      width: options.width ?? frameSize,
      height: framesCount * frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}
