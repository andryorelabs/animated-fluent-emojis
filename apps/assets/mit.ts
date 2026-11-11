import { hexToCodepoints } from "./codepoints.js";
import { fetchOk, mapWithConcurrency, type FetchLike } from "./http.js";

export const MIT_REPOSITORY = "microsoft/fluentui-emoji-animated";
const GITHUB_API = `https://api.github.com/repos/${MIT_REPOSITORY}`;
const ASSETS_PREFIX = "assets/";
const METADATA_CONCURRENCY = 16;

const TONE_SUFFIX_BY_FOLDER: Readonly<Record<string, string>> = {
  Default: "",
  Light: "_s2",
  "Medium-Light": "_s3",
  Medium: "_s4",
  "Medium-Dark": "_s5",
  Dark: "_s6",
};

/**
 * One animated PNG of an emoji in the official repository.
 */
interface MitSprite {
  readonly toneSuffix: string;
  readonly path: string;
  readonly blobSha: string;
}

/**
 * An emoji of the official `fluentui-emoji-animated` repository.
 */
export interface MitEmoji {
  readonly codepoints: string;
  readonly glyph: string;
  readonly cldr: string;
  readonly group: string;
  readonly keywords: readonly string[];
  readonly sprites: readonly MitSprite[];
}

/**
 * The indexed state of the official repository at one commit.
 */
export interface MitIndex {
  readonly commitSha: string;
  readonly emojis: readonly MitEmoji[];
}

/**
 * A git tree entry as returned by the GitHub API.
 */
export interface TreeEntry {
  readonly path: string;
  readonly type: string;
  readonly sha: string;
}

interface MitMetadata {
  readonly cldr: string;
  readonly glyph: string;
  readonly group: string;
  readonly keywords: readonly string[];
  readonly unicode: string;
}

interface EmojiFiles {
  readonly metadataPath: string;
  readonly sprites: MitSprite[];
}

function encodePath(filePath: string): string {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Builds the URL that serves a Git LFS file of the official repository.
 * @param commitSha The commit to read from.
 * @param filePath The repository path of the file.
 * @returns The media.githubusercontent.com URL.
 */
export function buildMitMediaUrl(commitSha: string, filePath: string): string {
  return `https://media.githubusercontent.com/media/${MIT_REPOSITORY}/${commitSha}/${encodePath(filePath)}`;
}

function buildRawUrl(commitSha: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${MIT_REPOSITORY}/${commitSha}/${encodePath(filePath)}`;
}

/**
 * Groups the repository tree by emoji folder, finding each metadata file and
 * every animated PNG with its skin tone.
 * @param tree The recursive git tree entries.
 * @returns Emoji files keyed by emoji folder name.
 */
export function groupTreeByEmoji(tree: readonly TreeEntry[]): Map<string, EmojiFiles> {
  const byName = new Map<string, EmojiFiles>();
  for (const entry of tree) {
    if (entry.type !== "blob" || !entry.path.startsWith(ASSETS_PREFIX)) continue;
    const segments = entry.path.slice(ASSETS_PREFIX.length).split("/");
    const name = segments[0];
    if (name === undefined) continue;
    const files = byName.get(name) ?? {
      metadataPath: `${ASSETS_PREFIX}${name}/metadata.json`,
      sprites: [],
    };
    byName.set(name, files);

    const isPlainSprite = segments.length === 3 && segments[1] === "animated";
    const toneFolder = segments.length === 4 ? segments[1] : undefined;
    const toneSuffix = toneFolder === undefined ? undefined : TONE_SUFFIX_BY_FOLDER[toneFolder];
    if (isPlainSprite) {
      files.sprites.push({
        toneSuffix: "",
        path: entry.path,
        blobSha: entry.sha,
      });
    } else if (toneSuffix !== undefined && segments[2] === "animated") {
      files.sprites.push({ toneSuffix, path: entry.path, blobSha: entry.sha });
    }
  }
  return byName;
}

/**
 * Reads the latest commit of the official repository.
 * @param fetchImplementation The fetch function to use.
 * @param githubHeaders Optional headers (such as authorization) for the GitHub API.
 * @returns The commit SHA of `main`.
 */
export async function fetchMitCommitSha(
  fetchImplementation: FetchLike,
  githubHeaders: Record<string, string> = {},
): Promise<string> {
  const response = await fetchOk(fetchImplementation, `${GITHUB_API}/commits/main`, {
    headers: githubHeaders,
  });
  return ((await response.json()) as { sha: string }).sha;
}

/**
 * Reads the official repository: its latest commit, tree and metadata files.
 * @param fetchImplementation The fetch function to use.
 * @param githubHeaders Optional headers (such as authorization) for the GitHub API.
 * @returns The index of every emoji with an animated sprite.
 */
export async function loadMitIndex(
  fetchImplementation: FetchLike,
  githubHeaders: Record<string, string> = {},
): Promise<MitIndex> {
  const commitSha = await fetchMitCommitSha(fetchImplementation, githubHeaders);
  const treeResponse = await fetchOk(
    fetchImplementation,
    `${GITHUB_API}/git/trees/${commitSha}?recursive=1`,
    { headers: githubHeaders },
  );
  const treeBody = (await treeResponse.json()) as {
    truncated: boolean;
    tree: TreeEntry[];
  };
  if (treeBody.truncated) {
    throw new Error("The official repository tree was truncated by the API");
  }

  const files = groupTreeByEmoji(treeBody.tree)
    .values()
    .filter((entry) => entry.sprites.length > 0)
    .toArray();
  const emojis = await mapWithConcurrency(
    files,
    METADATA_CONCURRENCY,
    async (entry): Promise<MitEmoji> => {
      const response = await fetchOk(
        fetchImplementation,
        buildRawUrl(commitSha, entry.metadataPath),
      );
      try {
        const metadata = (await response.json()) as MitMetadata;
        return {
          codepoints: hexToCodepoints(metadata.unicode),
          glyph: metadata.glyph,
          cldr: metadata.cldr,
          group: metadata.group,
          keywords: metadata.keywords,
          sprites: entry.sprites,
        };
      } catch (error: unknown) {
        throw new Error(`Invalid metadata for official emoji at ${entry.metadataPath}`, {
          cause: error,
        });
      }
    },
  );
  return { commitSha, emojis };
}
