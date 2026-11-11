import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { acquireLock, releaseLock } from "./locks";

/**
 * Pinned lychee release. It is the default `lycheeVersion` of the
 * `lycheeverse/lychee-action` version in {@link EXPECTED_LYCHEE_ACTION_VERSION}.
 */
export const LYCHEE_VERSION = "v0.24.2";

/**
 * The `lycheeverse/lychee-action` version pinned in
 * `.github/workflows/lint-docs.yml`. `scripts/lint-docs.test.ts` asserts the
 * workflow still pins it, so bumping the action fails the test until
 * {@link LYCHEE_VERSION} is re-checked against the new action default.
 */
export const EXPECTED_LYCHEE_ACTION_VERSION = "v2.9.0";

const LYCHEE_LOCK_TIMEOUT_MS = 60_000;
const LYCHEE_LOCK_POLL_INTERVAL_MS = 500;

/**
 * Arguments passed to lychee, identical to the `args:` of the workflow.
 * Globs are passed unexpanded, as the workflow's quoting does.
 */
export const LYCHEE_ARGS = [
  "--offline",
  "--include-fragments=anchor-only",
  "--no-progress",
  "*.md",
  "docs/**/*.md",
  ".github/**/*.md",
] as const;

/**
 * Maps Node platform and architecture to the lychee Linux release arch.
 * @param arch The Node.js architecture.
 * @param platform The Node.js platform.
 * @returns The lychee release architecture string.
 */
export function resolveLycheeArch(
  arch: NodeJS.Architecture = process.arch,
  platform: NodeJS.Platform = process.platform,
): "aarch64" | "x86_64" {
  if (platform !== "linux") {
    throw new Error(
      `lint-docs: unsupported platform "${platform}", lychee prebuilt binaries are Linux-only. Install lychee manually.`,
    );
  }
  if (arch === "arm64") return "aarch64";
  if (arch === "x64") return "x86_64";
  throw new Error(
    `lint-docs: unsupported architecture "${arch}", lychee only publishes x86_64 and aarch64 Linux binaries.`,
  );
}

/**
 * Builds the release asset URL for a lychee version and architecture.
 * @param version The release tag, such as `v0.24.2`.
 * @param arch The CPU part of the asset name, such as `x86_64`.
 * @returns An https GitHub release asset link.
 */
export function buildLycheeDownloadUrl(version: string, arch: string): string {
  return `https://github.com/lycheeverse/lychee/releases/download/lychee-${version}/lychee-${arch}-unknown-linux-gnu.tar.gz`;
}

/**
 * Builds the cache path, relative to the git common dir, of a lychee binary.
 * @param version The release tag the binary belongs to.
 * @returns A path like `lychee/v0.24.2/lychee`.
 */
export function buildLycheeCacheRelativePath(version: string): string {
  return path.join("lychee", version, "lychee");
}

/** Injectable collaborators of {@link ensureLycheeBinary}. */
export interface LycheeBinaryDependencies {
  resolveCacheRoot: () => string;
  fetchArchive: (url: string) => Promise<Response>;
  arch: NodeJS.Architecture;
  platform: NodeJS.Platform;
}

function resolveGitCommonDirectory(): string {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`lint-docs: "git rev-parse --git-common-dir" failed: ${result.stderr}`);
  }
  return path.resolve(result.stdout.trim());
}

function findBinaryRecursively(rootDirectory: string, maxDepth: number): string | undefined {
  const entries = readdirSync(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDirectory, entry.name);
    if (entry.isFile() && entry.name === "lychee") return entryPath;
    if (!entry.isDirectory() || maxDepth <= 0) continue;
    const found = findBinaryRecursively(entryPath, maxDepth - 1);
    if (found) return found;
  }
  return undefined;
}

async function downloadLycheeBinary(
  version: string,
  destinationPath: string,
  dependencies: LycheeBinaryDependencies,
): Promise<void> {
  const url = buildLycheeDownloadUrl(
    version,
    resolveLycheeArch(dependencies.arch, dependencies.platform),
  );
  const response = await dependencies.fetchArchive(url);
  if (!response.ok) {
    throw new Error(
      `lint-docs: failed to download lychee from ${url} (HTTP ${String(response.status)}).`,
    );
  }

  const workingDirectory = mkdtempSync(path.join(tmpdir(), "lint-docs-lychee-"));
  try {
    const archivePath = path.join(workingDirectory, "lychee.tar.gz");
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
    const extractedDirectory = path.join(workingDirectory, "extracted");
    mkdirSync(extractedDirectory);
    const tar = spawnSync("tar", ["-xzf", archivePath, "-C", extractedDirectory]);
    if (tar.status !== 0) {
      throw new Error(
        `lint-docs: failed to extract the archive from ${url}: ${tar.stderr.toString()}`,
      );
    }
    const extractedBinaryPath = findBinaryRecursively(extractedDirectory, 2);
    if (!extractedBinaryPath) {
      throw new Error(`lint-docs: no "lychee" binary found in ${url}.`);
    }
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    const temporaryPath = `${destinationPath}.tmp-${String(process.pid)}-${String(Date.now())}`;
    copyFileSync(extractedBinaryPath, temporaryPath);
    chmodSync(temporaryPath, 0o755);
    renameSync(temporaryPath, destinationPath);
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true });
  }
}

function defaultLycheeDependencies(): LycheeBinaryDependencies {
  return {
    resolveCacheRoot: resolveGitCommonDirectory,
    fetchArchive: (url) => fetch(url),
    arch: process.arch,
    platform: process.platform,
  };
}

/**
 * Returns a cached lychee binary, downloading it on first use. The download
 * is serialised by a lock directory next to the cache, so parallel worktrees
 * never download into the same destination at once.
 * @param version The lychee release version to ensure is cached.
 * @param dependencies The cache root, fetch and platform, defaulting to the real ones.
 * @returns The absolute path of the cached binary.
 */
export async function ensureLycheeBinary(
  version: string,
  dependencies: LycheeBinaryDependencies = defaultLycheeDependencies(),
): Promise<string> {
  const binaryPath = path.join(
    dependencies.resolveCacheRoot(),
    buildLycheeCacheRelativePath(version),
  );
  if (existsSync(binaryPath)) return binaryPath;
  const cacheRoot = dependencies.resolveCacheRoot();
  mkdirSync(cacheRoot, { recursive: true });
  const lockDirectory = path.join(cacheRoot, `lychee-${version}.lock`);
  await acquireLock(
    lockDirectory,
    () => ({
      pid: process.pid,
      worktree: process.cwd(),
      acquiredAt: Date.now(),
    }),
    {
      timeoutMs: LYCHEE_LOCK_TIMEOUT_MS,
      pollIntervalMs: LYCHEE_LOCK_POLL_INTERVAL_MS,
      maxAgeMs: LYCHEE_LOCK_TIMEOUT_MS,
      logLabel: "lint-docs",
    },
  );
  try {
    if (existsSync(binaryPath)) return binaryPath;
    console.log(`lint-docs: lychee ${version} not cached, downloading...`);
    await downloadLycheeBinary(version, binaryPath, dependencies);
    console.log(`lint-docs: cached lychee ${version} at ${binaryPath}.`);
    return binaryPath;
  } finally {
    releaseLock(lockDirectory);
  }
}

function exitCodeOf(code: number | null): number {
  return typeof code === "number" ? code : 1;
}

function spawnInherited(binaryPath: string, binaryArguments: string[]): Promise<number> {
  const child = spawn(binaryPath, binaryArguments, { stdio: "inherit" });
  return new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(exitCodeOf(code));
    });
  });
}

/**
 * Runs lychee over the docs with the cached pinned binary.
 * @param extraArguments Arguments appended to {@link LYCHEE_ARGS}.
 * @param ensureBinary Resolves the lychee binary path.
 * @param spawnBinary Runs the binary and resolves its exit code.
 * @returns The lychee exit code.
 */
export async function runDocumentationLint(
  extraArguments: string[] = process.argv.slice(2),
  ensureBinary: (version: string) => Promise<string> = ensureLycheeBinary,
  spawnBinary: (binaryPath: string, binaryArguments: string[]) => Promise<number> = spawnInherited,
): Promise<number> {
  const binaryPath = await ensureBinary(LYCHEE_VERSION);
  return spawnBinary(binaryPath, [...LYCHEE_ARGS, ...extraArguments]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await runDocumentationLint();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
