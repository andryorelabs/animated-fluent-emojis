import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { FILES_SITE_ORIGIN } from "../../gallery/public-index";
import { useGalleryData } from "./use-gallery-data";

const SEARCH_URL = "/search/en.json";
const searchIndex = [{ slug: "fire", name: "Fire" }];

function respond(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((url: string) => Promise.resolve(handler(url)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("loads the public index and the search index into a ready state", async () => {
  const fetchMock = stubFetch((url) => respond(url === SEARCH_URL ? searchIndex : fixture));

  const { result } = renderHook(() => useGalleryData(SEARCH_URL));

  expect(result.current.state.status).toBe("loading");
  await waitFor(() => {
    expect(result.current.state.status).toBe("ready");
  });
  const { state } = result.current;
  if (state.status !== "ready") throw new Error("expected ready");
  expect(state.data.emojis.map((emoji) => emoji.slug)).toContain("fire");
  expect(state.data.searchIndex).toEqual(searchIndex);
  expect(fetchMock).toHaveBeenCalledWith(`${FILES_SITE_ORIGIN}/index.json`);
  expect(fetchMock).toHaveBeenCalledWith(SEARCH_URL);
});

test("reports an error when a request answers with a failing status", async () => {
  stubFetch((url) => (url === SEARCH_URL ? respond({}, 500) : respond(fixture)));

  const { result } = renderHook(() => useGalleryData(SEARCH_URL));

  await waitFor(() => {
    expect(result.current.state.status).toBe("error");
  });
});

test("reports an error when the search index is not a list", async () => {
  stubFetch((url) => respond(url === SEARCH_URL ? { not: "a list" } : fixture));

  const { result } = renderHook(() => useGalleryData(SEARCH_URL));

  await waitFor(() => {
    expect(result.current.state.status).toBe("error");
  });
});

test("retry goes back to loading and settles with the new attempt", async () => {
  let failing = true;
  stubFetch((url) => {
    if (failing) return respond({}, 503);
    return respond(url === SEARCH_URL ? searchIndex : fixture);
  });

  const { result } = renderHook(() => useGalleryData(SEARCH_URL));
  await waitFor(() => {
    expect(result.current.state.status).toBe("error");
  });

  failing = false;
  act(() => {
    result.current.retry();
  });

  expect(result.current.state.status).toBe("loading");
  await waitFor(() => {
    expect(result.current.state.status).toBe("ready");
  });
});

test("ignores a load that settles after unmount", async () => {
  const pending = Promise.withResolvers<Response>();
  const fetchMock = stubFetch((url) =>
    url === SEARCH_URL ? respond(searchIndex) : pending.promise,
  );
  const consoleError = vi.spyOn(console, "error");

  const { result, unmount } = renderHook(() => useGalleryData(SEARCH_URL));
  expect(result.current.state.status).toBe("loading");
  unmount();
  pending.resolve(respond(fixture));
  await fetchMock.mock.results[0]?.value;
  await act(async () => {
    await Promise.resolve();
  });

  expect(result.current.state.status).toBe("loading");
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
