import { expect, test, vi } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { PIPELINE_VERSION } from "./catalog.js";
import type { PublishedVersion } from "./site-writer.js";
import {
  createPlanGuard,
  fetchPublishedJson,
  formatErrorChain,
  isV1LayoutStale,
  needsRebuild,
  parseLimit,
  verifyLive,
} from "./sync.js";
import { createFakeFetch } from "./test-support.js";

const published: PublishedVersion = {
  teamsHash: "a".repeat(32),
  teamsLastModified: "2025-10-16T22:08:15.000Z",
  mitSha: "b".repeat(40),
  builtAt: "2026-10-05T00:00:00.000Z",
  pipelineVersion: PIPELINE_VERSION,
  layouts: ["v1"],
};
const missingHost = () =>
  Promise.reject(new Error("fetch failed", { cause: { code: "ENOTFOUND" } }));
const invalidJson = () => Promise.resolve(new Response("not json", { status: 200 }));
const offline = () => Promise.reject(new Error("socket hang up"));
const latest = { teamsHash: published.teamsHash, mitSha: published.mitSha };

test("does not rebuild when nothing changed", () => {
  expect(needsRebuild(published, published, latest, false)).toBe(false);
});

test("rebuilds on a new Teams hash or official commit", () => {
  expect(needsRebuild(published, published, { ...latest, teamsHash: "c".repeat(32) }, false)).toBe(
    true,
  );
  expect(needsRebuild(published, published, { ...latest, mitSha: "d".repeat(40) }, false)).toBe(
    true,
  );
});

test("rebuilds on the first run and when rebuild is requested", () => {
  expect(needsRebuild(undefined, undefined, latest, false)).toBe(true);
  expect(needsRebuild(published, published, latest, true)).toBe(true);
});

test("rebuilds when the v1 marker is a 404, lacks v1 or has another pipeline version", () => {
  expect(needsRebuild(published, undefined, latest, false)).toBe(true);
  expect(needsRebuild(published, { ...published, layouts: [] }, latest, false)).toBe(true);
  expect(
    needsRebuild(published, { ...published, pipelineVersion: PIPELINE_VERSION + 1 }, latest, false),
  ).toBe(true);
  expect(isV1LayoutStale(published)).toBe(false);
});

const manifestOf = (count: number): Manifest =>
  ({
    categories: [
      {
        id: "c",
        name: "C",
        emoticons: Array.from({ length: count }, (_, index) => ({
          id: `e${String(index)}`,
          etag: "x",
        })),
      },
    ],
  }) as unknown as Manifest;

test("the plan guard refuses a catalog that removes more than 5% and can be bypassed", () => {
  const previous = manifestOf(100);
  expect(createPlanGuard(undefined, false)).toBeUndefined();
  const guard = createPlanGuard(previous, false);
  expect(() => guard?.(manifestOf(94))).toThrow("would be removed");
  expect(() => guard?.(manifestOf(95))).not.toThrow();
  expect(() => createPlanGuard(previous, true)?.(manifestOf(10))).not.toThrow();
});

test("fetchPublishedJson returns the parsed JSON of a published file", async () => {
  const { fetch } = createFakeFetch({
    "GET https://site.test/version.json": { body: published },
  });

  await expect(
    fetchPublishedJson<PublishedVersion>(fetch, "https://site.test", "version.json"),
  ).resolves.toEqual(published);
});

test("fetchPublishedJson treats only HTTP 404 as unpublished", async () => {
  const { fetch } = createFakeFetch({});
  await expect(
    fetchPublishedJson(fetch, "https://site.test", "version.json"),
  ).resolves.toBeUndefined();
});

test("fetchPublishedJson fails on DNS errors instead of treating them as unpublished", async () => {
  await expect(
    fetchPublishedJson(missingHost, "https://nope.test", "version.json", 1),
  ).rejects.toThrow("fetch failed");
});

test("fetchPublishedJson fails on HTTP 500", async () => {
  const { fetch } = createFakeFetch({
    "GET https://site.test/version.json": { status: 500 },
  });
  await expect(fetchPublishedJson(fetch, "https://site.test", "version.json", 1)).rejects.toThrow(
    "HTTP 500",
  );
});

test("fetchPublishedJson surfaces network failures", async () => {
  await expect(fetchPublishedJson(offline, "https://site.test", "version.json", 1)).rejects.toThrow(
    "socket hang up",
  );
});

test("fetchPublishedJson fails on unparsable JSON with the cause attached", async () => {
  let error: unknown;
  try {
    await fetchPublishedJson(invalidJson, "https://site.test", "manifest.json");
  } catch (error_: unknown) {
    error = error_;
  }
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain("https://site.test/manifest.json");
  expect((error as Error).cause).toBeInstanceOf(SyntaxError);
});

test("formatErrorChain prints the message, cause chain and stack", () => {
  const error = new Error("outer", {
    cause: new Error("inner", { cause: { code: "ENOTFOUND" } }),
  });
  const output = formatErrorChain(error);
  expect(output).toContain("Error: outer");
  expect(output).toContain("Caused by: Error: inner");
  expect(output).toContain('Caused by: {"code":"ENOTFOUND"}');
  expect(output).toContain("at ");
});

test("fetchPublishedJson retries a transient failure through the shared helper", async () => {
  let calls = 0;
  const flaky = () => {
    calls += 1;
    return Promise.resolve(
      calls === 1
        ? new Response("x", { status: 503, headers: { "retry-after": "0" } })
        : Response.json(published),
    );
  };

  await expect(fetchPublishedJson(flaky, "https://site.test", "version.json")).resolves.toEqual(
    published,
  );
  expect(calls).toBe(2);
});

test("rebuilds when the published catalog lists skipped emojis", () => {
  const withSkipped = { ...published, skippedIds: ["1f3c1_chequeredflag"] };
  expect(needsRebuild(withSkipped, withSkipped, latest, false)).toBe(true);
  expect(needsRebuild(published, withSkipped, latest, false)).toBe(true);
  const emptySkipped = { ...published, skippedIds: [] };
  expect(needsRebuild(emptySkipped, emptySkipped, latest, false)).toBe(false);
});

test("never treats a limited build as current", () => {
  const limited = { ...published, limited: true as const };
  expect(needsRebuild(limited, limited, latest, false)).toBe(true);
  expect(needsRebuild(published, limited, latest, false)).toBe(true);
});

test("parses --limit and rejects anything but a positive whole number", () => {
  expect(parseLimit(undefined)).toBeUndefined();
  expect(parseLimit("5")).toBe(5);
  for (const bad of ["abc", "0", "-3", "1.5", "", "1e3"]) {
    expect(() => parseLimit(bad)).toThrow("Invalid --limit");
  }
});

const liveUrl = "https://site.example";
const liveVersionKey = `GET ${liveUrl}/v1/version.json`;

test("verify-live passes for a current v1 marker", async () => {
  const { fetch } = createFakeFetch({
    [liveVersionKey]: { body: published },
  });
  await expect(verifyLive(fetch, liveUrl)).resolves.toBeUndefined();
});

test("verify-live retries a 503 and then passes", async () => {
  vi.useFakeTimers();
  try {
    const responses = [new Response("x", { status: 503 }), Response.json(published)];
    const fetch = vi.fn(() => Promise.resolve(responses.shift() as Response));
    const result = verifyLive(fetch, liveUrl);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

test("verify-live does not retry a 404", async () => {
  const fetch = vi.fn(() => Promise.resolve(new Response("x", { status: 404 })));
  await expect(verifyLive(fetch, liveUrl)).rejects.toThrow("404");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("verify-live fails on a 404", async () => {
  const { fetch } = createFakeFetch({});
  await expect(verifyLive(fetch, liveUrl)).rejects.toThrow("404");
});

test("verify-live fails when v1 is not listed", async () => {
  const { fetch } = createFakeFetch({
    [liveVersionKey]: { body: { ...published, layouts: [] } },
  });
  await expect(verifyLive(fetch, liveUrl)).rejects.toThrow("layout");
});

test("verify-live fails on a limited build", async () => {
  const { fetch } = createFakeFetch({
    [liveVersionKey]: { body: { ...published, limited: true } },
  });
  await expect(verifyLive(fetch, liveUrl)).rejects.toThrow("--limit");
});

test("verify-live fails on another pipeline version", async () => {
  const { fetch } = createFakeFetch({
    [liveVersionKey]: {
      body: { ...published, pipelineVersion: PIPELINE_VERSION + 1 },
    },
  });
  await expect(verifyLive(fetch, liveUrl)).rejects.toThrow("pipelineVersion");
});
