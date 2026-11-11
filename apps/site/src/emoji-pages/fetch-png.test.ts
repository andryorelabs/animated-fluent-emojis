import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPng } from "./fetch-png";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchPng", () => {
  it("returns the bytes of a successful response", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));
    expect(new Uint8Array(await fetchPng("https://x/a.png"))).toEqual(bytes);
  });

  it("does not retry a client error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPng("https://x/a.png")).rejects.toThrow("404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a server error until it succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([9]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = fetchPng("https://x/a.png");
    await vi.runAllTimersAsync();
    expect(new Uint8Array(await result)).toEqual(new Uint8Array([9]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
