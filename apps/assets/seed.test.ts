import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { BuildContext } from "./build-context.js";
import type { FetchLike } from "./http.js";
import { retainPreviousGeneration } from "./seed.js";

const LIVE_URL = "https://live.example.com";

const createManifest = (entries: readonly { id: string; etag: string }[]): Manifest => ({
  categories: [
    {
      id: "smilies-id",
      title: "Smilies",
      description: "Smilies",
      emoticons: entries.map(({ id, etag }) => ({
        id,
        description: id,
        shortcuts: [],
        unicode: "😃",
        etag,
        diverse: false,
        animation: { fps: 24, framesCount: 10, firstFrame: 1 },
        keywords: [],
      })),
    },
  ],
});

const workDirectory = { path: "" };

beforeEach(async () => {
  workDirectory.path = await mkdtemp(path.join(tmpdir(), "seed-test-"));
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await rm(workDirectory.path, { recursive: true, force: true });
});

const createOptions = (
  fetchImplementation: FetchLike,
  previousManifest: Manifest,
  extra: Partial<BuildContext["options"]> = {},
): BuildContext["options"] => ({
  fetchImplementation,
  teamsVersion: { hash: "c".repeat(32), lastModified: "" },
  outputDirectory: path.join(workDirectory.path, "out"),
  cacheDirectory: path.join(workDirectory.path, "cache"),
  liveUrl: LIVE_URL,
  previousManifest,
  ...extra,
});

const failing: FetchLike = () => Promise.reject(new Error("network down"));

const notFound = (): ReturnType<FetchLike> =>
  Promise.resolve(new Response("missing", { status: 404 }));

test("retains nothing without a live url", async () => {
  const result = await retainPreviousGeneration({
    options: createOptions(notFound, createManifest([]), {
      liveUrl: undefined,
    }),
    manifest: createManifest([]),
    emojiIds: new Set(),
    fileBudget: 10,
  });
  expect(result).toEqual({ retained: [], emojiCount: 0 });
});

test("warns with the error message when a live download throws", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  const pending = retainPreviousGeneration({
    options: createOptions(failing, createManifest([{ id: "changed", etag: "old" }])),
    manifest: createManifest([{ id: "changed", etag: "new" }]),
    emojiIds: new Set(["changed"]),
    fileBudget: 10,
  });
  await vi.runAllTimersAsync();
  const result = await pending;
  expect(result).toEqual({ retained: [], emojiCount: 0 });
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("could not be fetched: network down"));
});

test("requests changed and removed emoji in id order", async () => {
  const requested: string[] = [];
  const recording: FetchLike = (input) => {
    requested.push(input);
    return notFound();
  };
  await retainPreviousGeneration({
    options: createOptions(
      recording,
      createManifest([
        { id: "b-changed", etag: "old" },
        { id: "a-changed", etag: "old" },
        { id: "d-removed", etag: "old" },
        { id: "c-removed", etag: "old" },
      ]),
    ),
    manifest: createManifest([
      { id: "b-changed", etag: "new" },
      { id: "a-changed", etag: "new" },
    ]),
    emojiIds: new Set(["a-changed", "b-changed"]),
    fileBudget: 10,
  });
  const order = requested.map((url) => /[a-d]-(?:changed|removed)/.exec(url)?.[0]);
  expect(order).toEqual(["a-changed", "b-changed", "c-removed", "d-removed"]);
});
