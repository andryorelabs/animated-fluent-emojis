import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { fetchOk, fetchOkOrMissing, type FetchLike } from "./http.js";

const TEAMS_STATIC_ORIGIN = "https://statics.teams.cdn.office.net";
const PERSONAL_EXPRESSIONS = `${TEAMS_STATIC_ORIGIN}/evergreen-assets/personal-expressions`;
const TEAMS_WEB_CLIENT_URL = "https://teams.microsoft.com/v2/";
const TEAMS_ECS_CONFIG_URL =
  "https://config.teams.microsoft.com/config/v1/MicrosoftTeams/0_0.0.0.0?environment=prod&audienceGroup=general&teamsRing=general";
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const HASH_PATTERN = /^[\da-f]{32}$/;

/**
 * A Teams emoticon metadata version and when it was published.
 */
export interface TeamsVersion {
  readonly hash: string;
  readonly lastModified: string;
}

/**
 * The result of looking for the newest Teams emoticon metadata version.
 */
export interface TeamsDiscovery {
  readonly version: TeamsVersion;
  readonly candidates: readonly TeamsVersion[];
  readonly warnings: readonly string[];
  readonly advertisedSourcesFailed: boolean;
}

/**
 * Builds the URL of a Teams emoticon metadata manifest.
 * @param hash The 32-character metadata version hash.
 * @returns The manifest URL for the `en-us` locale.
 */
export function buildManifestUrl(hash: string): string {
  return `${PERSONAL_EXPRESSIONS}/v1/metadata/${hash}/en-us.json`;
}

/**
 * Builds the URL of a Teams animated sprite sheet.
 * @param id The emoticon id.
 * @param toneSuffix The skin tone suffix (`''` or `_s2` to `_s6`).
 * @returns The 100px sprite sheet URL.
 */
export function buildSpriteUrl(id: string, toneSuffix: string): string {
  return `${PERSONAL_EXPRESSIONS}/v2/assets/emoticons/${id}/default/100_anim_f${toneSuffix}.png`;
}

/**
 * Finds the hashed Teams config bundle URLs referenced by the web client HTML.
 * @param html The HTML of the Teams web client page.
 * @returns The unique `config-prod` and `config-life` bundle URLs.
 */
export function findConfigBundleUrls(html: string): string[] {
  const matches = html.matchAll(/https:\/\/[^\s"']*config-(?:prod|life)-[\da-z]+\.js/g);
  return [...new Set([...matches].map((match) => match[0]))];
}

/**
 * Extracts the emoticon metadata hash from a Teams config bundle or ECS body.
 * @param source The text of a config bundle or ECS response.
 * @returns The hash, or undefined when none is present.
 */
export function extractAssetVersion(source: string): string | undefined {
  const match = /emoticonAssetVersion["']?\s*[:=]\s*(?:\[\{value:)?\s*["']([\da-f]{32})["']/.exec(
    source,
  );
  return match?.[1];
}

/**
 * Looks up when a Teams manifest hash was published.
 * @param fetchImplementation The fetch function to use.
 * @param hash The metadata version hash.
 * @returns The version, or undefined when the hash does not exist on the CDN.
 */
export async function probeVersion(
  fetchImplementation: FetchLike,
  hash: string,
): Promise<TeamsVersion | undefined> {
  const response = await fetchOkOrMissing(fetchImplementation, buildManifestUrl(hash), {
    method: "HEAD",
  });
  if (!response) return undefined;
  const parsed = Date.parse(response.headers.get("last-modified") ?? "");
  return Number.isNaN(parsed) ? undefined : { hash, lastModified: new Date(parsed).toISOString() };
}

async function readText(
  fetchImplementation: FetchLike,
  url: string,
  headers?: Record<string, string>,
): Promise<string> {
  const response = await fetchOk(
    fetchImplementation,
    url,
    headers === undefined ? {} : { headers },
  );
  return response.text();
}

async function collectBundleHashes(
  fetchImplementation: FetchLike,
  warnings: string[],
): Promise<string[]> {
  const hashes: string[] = [];
  try {
    const html = await readText(fetchImplementation, TEAMS_WEB_CLIENT_URL, {
      "user-agent": DESKTOP_USER_AGENT,
    });
    const bundleUrls = findConfigBundleUrls(html);
    if (bundleUrls.length === 0) {
      warnings.push("Teams web client HTML had no config bundle links");
    }
    for (const bundleUrl of bundleUrls) {
      const hash = extractAssetVersion(await readText(fetchImplementation, bundleUrl));
      if (hash) hashes.push(hash);
    }
  } catch (error: unknown) {
    warnings.push(`Teams config bundle lookup failed: ${String(error)}`);
  }
  return hashes;
}

async function collectEcsHashes(
  fetchImplementation: FetchLike,
  warnings: string[],
): Promise<string[]> {
  try {
    const hash = extractAssetVersion(await readText(fetchImplementation, TEAMS_ECS_CONFIG_URL));
    return hash ? [hash] : [];
  } catch (error: unknown) {
    warnings.push(`Teams ECS lookup failed: ${String(error)}`);
    return [];
  }
}

/**
 * Finds the newest published Teams emoticon metadata version among the known
 * hashes and the ones advertised by the Teams web client and ECS.
 * @param options Discovery inputs.
 * @param options.fetchImplementation The fetch function to use.
 * @param options.knownHashes Hashes that are always probed (pinned or published).
 * @returns The newest version, every probed candidate, any warnings and
 * whether both advertised sources failed to yield a hash.
 */
export async function discoverTeamsVersion(options: {
  fetchImplementation: FetchLike;
  knownHashes: readonly string[];
}): Promise<TeamsDiscovery> {
  const { fetchImplementation, knownHashes } = options;
  const warnings: string[] = [];
  const bundleHashes = await collectBundleHashes(fetchImplementation, warnings);
  const ecsHashes = await collectEcsHashes(fetchImplementation, warnings);
  const advertised = [...bundleHashes, ...ecsHashes];
  const advertisedSourcesFailed = bundleHashes.length === 0 && ecsHashes.length === 0;
  if (advertisedSourcesFailed) {
    warnings.push("Neither the Teams web client nor ECS advertised a metadata hash");
  }
  const hashes = [...new Set([...knownHashes, ...advertised])].filter((hash) =>
    HASH_PATTERN.test(hash),
  );

  const candidates: TeamsVersion[] = [];
  for (const hash of hashes) {
    try {
      const version = await probeVersion(fetchImplementation, hash);
      if (version) candidates.push(version);
      else warnings.push(`Teams manifest ${hash} is not available`);
    } catch (error: unknown) {
      warnings.push(`Teams manifest ${hash} probe failed: ${String(error)}`);
    }
  }

  const newest = candidates.toSorted(
    (first, second) => Date.parse(second.lastModified) - Date.parse(first.lastModified),
  )[0];
  if (!newest) throw new Error("No Teams manifest version could be resolved");
  return { version: newest, candidates, warnings, advertisedSourcesFailed };
}

/**
 * Downloads a Teams emoticon manifest.
 * @param fetchImplementation The fetch function to use.
 * @param hash The metadata version hash.
 * @returns The parsed manifest.
 */
export async function fetchTeamsManifest(
  fetchImplementation: FetchLike,
  hash: string,
): Promise<Manifest> {
  const response = await fetchOk(fetchImplementation, buildManifestUrl(hash));
  return (await response.json()) as Manifest;
}
