import { expect, test } from "vitest";

import {
  buildManifestUrl,
  buildSpriteUrl,
  discoverTeamsVersion,
  extractAssetVersion,
  findConfigBundleUrls,
  probeVersion,
} from "./teams.js";
import { createFakeFetch } from "./test-support.js";

const OLD_HASH = "a".repeat(32);
const MID_HASH = "b".repeat(32);
const NEW_HASH = "c".repeat(32);
const BUNDLE_URL =
  "https://teams.public.onecdn.static.microsoft/teams-modular-packages/hashed-assets/config-prod-abc123.js";

const headRoute = (hash: string, lastModified: string) => ({
  [`HEAD ${buildManifestUrl(hash)}`]: {
    headers: { "last-modified": lastModified },
  },
});

test("builds manifest and sprite URLs", () => {
  expect(buildManifestUrl(OLD_HASH)).toBe(
    `https://statics.teams.cdn.office.net/evergreen-assets/personal-expressions/v1/metadata/${OLD_HASH}/en-us.json`,
  );
  expect(buildSpriteUrl("1f44b_wavinghand", "_s3")).toBe(
    "https://statics.teams.cdn.office.net/evergreen-assets/personal-expressions/v2/assets/emoticons/1f44b_wavinghand/default/100_anim_f_s3.png",
  );
});

test("findConfigBundleUrls returns the unique config bundles", () => {
  const html = `<script src="${BUNDLE_URL}"></script><link href='${BUNDLE_URL}'><script src="https://x.test/app-1.js"></script>`;

  expect(findConfigBundleUrls(html)).toEqual([BUNDLE_URL]);
});

test("extractAssetVersion reads the bundle and ECS formats", () => {
  expect(extractAssetVersion(`a,emoticonAssetVersion:[{value:"${NEW_HASH}"}],b`)).toBe(NEW_HASH);
  expect(extractAssetVersion(`{"emoticonAssetVersion":"${OLD_HASH}","x":1}`)).toBe(OLD_HASH);
  expect(extractAssetVersion("nothing here")).toBeUndefined();
});

test("probeVersion reads Last-Modified and rejects missing manifests", async () => {
  const { fetch } = createFakeFetch(headRoute(OLD_HASH, "Wed, 03 May 2023 17:03:38 GMT"));

  await expect(probeVersion(fetch, OLD_HASH)).resolves.toEqual({
    hash: OLD_HASH,
    lastModified: "2023-05-03T17:03:38.000Z",
  });
  await expect(probeVersion(fetch, NEW_HASH)).resolves.toBeUndefined();
});

test("discoverTeamsVersion picks the newest Last-Modified among all sources", async () => {
  const { fetch } = createFakeFetch({
    ...headRoute(OLD_HASH, "Wed, 03 May 2023 17:03:38 GMT"),
    ...headRoute(MID_HASH, "Fri, 08 Aug 2025 00:26:42 GMT"),
    ...headRoute(NEW_HASH, "Thu, 16 Oct 2025 22:08:15 GMT"),
    "GET https://teams.microsoft.com/v2/": {
      body: `<script src="${BUNDLE_URL}"></script>`,
    },
    [`GET ${BUNDLE_URL}`]: {
      body: `emoticonAssetVersion:[{value:"${MID_HASH}"}]`,
    },
    "GET https://config.teams.microsoft.com/config/v1/MicrosoftTeams/0_0.0.0.0?environment=prod&audienceGroup=general&teamsRing=general":
      { body: { emoticonAssetVersion: OLD_HASH } },
  });

  const discovery = await discoverTeamsVersion({
    fetchImplementation: fetch,
    knownHashes: [NEW_HASH],
  });

  expect(discovery.version.hash).toBe(NEW_HASH);
  expect(
    discovery.candidates
      .map((candidate) => candidate.hash)
      .toSorted((first, second) => first.localeCompare(second)),
  ).toEqual(
    [OLD_HASH, MID_HASH, NEW_HASH].toSorted((first, second) => first.localeCompare(second)),
  );
  expect(discovery.warnings).toEqual([]);
});

test("discoverTeamsVersion warns but still resolves when scraping fails", async () => {
  const { fetch } = createFakeFetch({
    ...headRoute(OLD_HASH, "Wed, 03 May 2023 17:03:38 GMT"),
    "GET https://teams.microsoft.com/v2/": { status: 403 },
  });

  const discovery = await discoverTeamsVersion({
    fetchImplementation: fetch,
    knownHashes: [OLD_HASH, "not-a-hash"],
  });

  expect(discovery.version.hash).toBe(OLD_HASH);
  expect(discovery.warnings.some((warning) => warning.includes("bundle"))).toBe(true);
});

test("discoverTeamsVersion throws when no version resolves", async () => {
  const { fetch } = createFakeFetch({});

  await expect(
    discoverTeamsVersion({
      fetchImplementation: fetch,
      knownHashes: [OLD_HASH],
    }),
  ).rejects.toThrow("No Teams manifest version could be resolved");
});

test("discoverTeamsVersion flags when no advertised source yields a hash", async () => {
  const { fetch } = createFakeFetch({
    ...headRoute(OLD_HASH, "Wed, 03 May 2023 17:03:38 GMT"),
    "GET https://teams.microsoft.com/v2/": { status: 403 },
  });

  const discovery = await discoverTeamsVersion({
    fetchImplementation: fetch,
    knownHashes: [OLD_HASH],
  });

  expect(discovery.advertisedSourcesFailed).toBe(true);
});

test("discoverTeamsVersion does not flag when one source works", async () => {
  const { fetch } = createFakeFetch({
    ...headRoute(OLD_HASH, "Wed, 03 May 2023 17:03:38 GMT"),
    "GET https://config.teams.microsoft.com/config/v1/MicrosoftTeams/0_0.0.0.0?environment=prod&audienceGroup=general&teamsRing=general":
      { body: { emoticonAssetVersion: OLD_HASH } },
  });

  const discovery = await discoverTeamsVersion({
    fetchImplementation: fetch,
    knownHashes: [],
  });

  expect(discovery.advertisedSourcesFailed).toBe(false);
});
