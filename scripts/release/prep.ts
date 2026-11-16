import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Path of the published package manifest, relative to the repository root.
 */
export const PACKAGE_PATH = "packages/animated-fluent-emojis/package.json";

const CHANGELOG_PATH = "CHANGELOG.md";
const PACKAGE_VERSION_FIELD = /^(\s*"version":\s*")([^"]*)(")/m;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const SECTION_PREFIX = "## [";
const SUBSECTION_PREFIX = "### ";
const GROUP_HEADING = /^### (?:Added|Changed|Fixed)\s*$/;
const LINK_DEFINITION = /^\[[^\]]+\]:\s/;
const UNRELEASED_HEADING = /^## \[Unreleased\]\s*$/i;
const UNRELEASED_LINK = /^\[Unreleased\]: (\S+)\/compare\/v(\S+)\.\.\.HEAD\s*$/i;
const LIST_ITEM = /^[-*] +/;

/**
 * A release that cannot be prepared as asked. The message is written for the
 * person cutting the release.
 */
export class PrepError extends Error {
  override readonly name = "PrepError";
}

/**
 * One file the script rewrote: its `path` relative to the repository root and
 * a one-line `summary` of what changed in it.
 */
export interface ChangedFile {
  readonly path: string;
  readonly summary: string;
}

interface ParsedVersion {
  readonly core: readonly number[];
  readonly prerelease: readonly string[];
}

function hasContent(line: string): boolean {
  return line.trim() !== "";
}

function parseVersion(version: string): ParsedVersion | undefined {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    return undefined;
  }
  const [, major = "0", minor = "0", patch = "0", prerelease] = match;
  return {
    core: [Number(major), Number(minor), Number(patch)],
    prerelease: prerelease === undefined ? [] : prerelease.split("."),
  };
}

function comparePrereleaseIdentifier(first: string, second: string): number {
  const isFirstNumeric = /^\d+$/.test(first);
  const isSecondNumeric = /^\d+$/.test(second);
  if (isFirstNumeric && isSecondNumeric) {
    return Number(first) - Number(second);
  }
  if (isFirstNumeric !== isSecondNumeric) {
    return isFirstNumeric ? -1 : 1;
  }
  return first.localeCompare(second);
}

function compareVersions(first: ParsedVersion, second: ParsedVersion): number {
  for (const [index, part] of first.core.entries()) {
    const difference = part - (second.core[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  if (first.prerelease.length === 0 || second.prerelease.length === 0) {
    return second.prerelease.length - first.prerelease.length;
  }
  const length = Math.max(first.prerelease.length, second.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const left = first.prerelease[index];
    const right = second.prerelease[index];
    if (left === undefined || right === undefined) {
      return left === undefined ? -1 : 1;
    }
    const difference = comparePrereleaseIdentifier(left, right);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function readCurrentVersion(packageText: string): string {
  const { version } = JSON.parse(packageText) as { version?: unknown };
  if (typeof version !== "string") {
    throw new PrepError(`${PACKAGE_PATH} has no "version" field`);
  }
  return version;
}

function assertIncreasing(version: string, currentVersion: string): void {
  const next = parseVersion(version);
  if (!next) {
    throw new PrepError(
      `"${version}" is not a valid version. Use MAJOR.MINOR.PATCH with an optional prerelease suffix and no leading "v", such as 0.9.0 or 0.9.0-beta.1`,
    );
  }
  const current = parseVersion(currentVersion);
  if (!current) {
    throw new PrepError(
      `${PACKAGE_PATH} carries the version "${currentVersion}", which is not valid`,
    );
  }
  if (compareVersions(next, current) <= 0) {
    throw new PrepError(`${version} is not higher than the current version ${currentVersion}`);
  }
}

function bumpPackage(packageText: string, currentVersion: string, version: string): string {
  const field = PACKAGE_VERSION_FIELD.exec(packageText);
  const [, prefix = "", fieldVersion] = field ?? [];
  if (!field || fieldVersion !== currentVersion) {
    throw new PrepError(`Could not find the "version" field to rewrite in ${PACKAGE_PATH}`);
  }
  const versionStart = field.index + prefix.length;
  return (
    packageText.slice(0, versionStart) +
    version +
    packageText.slice(versionStart + currentVersion.length)
  );
}

function findUnreleasedBody(
  lines: readonly string[],
): { headingIndex: number; body: string[] } | undefined {
  const headingIndex = lines.findIndex((line) => UNRELEASED_HEADING.test(line));
  if (headingIndex === -1) {
    return undefined;
  }
  const rest = lines.slice(headingIndex + 1);
  const length = rest.findIndex(
    (line) => line.startsWith(SECTION_PREFIX) || LINK_DEFINITION.test(line),
  );
  return { headingIndex, body: length === -1 ? rest : rest.slice(0, length) };
}

function dropEmptySubsections(body: readonly string[]): string[] {
  const kept: string[] = [];
  let subsection: string[] = [];
  const flush = () => {
    const [first = "", ...rest] = subsection;
    if (!first.startsWith(SUBSECTION_PREFIX) || rest.some((line) => hasContent(line))) {
      kept.push(...subsection);
    }
    subsection = [];
  };
  for (const line of body) {
    if (line.startsWith(SUBSECTION_PREFIX)) {
      flush();
    }
    subsection.push(line);
  }
  flush();
  return kept;
}

function trimBlankEdges(lines: readonly string[]): string[] {
  const first = lines.findIndex((line) => hasContent(line));
  const last = lines.findLastIndex((line) => hasContent(line));
  return first === -1 ? [] : lines.slice(first, last + 1);
}

function assertReleasableBody(body: readonly string[]): void {
  if (body.every((line) => !LIST_ITEM.test(line))) {
    throw new PrepError('The "## [Unreleased]" section of CHANGELOG.md has no entries to release');
  }
  const firstLine = body.find((line) => hasContent(line)) ?? "";
  if (!firstLine.startsWith(SUBSECTION_PREFIX)) {
    throw new PrepError(
      'Entries under "## [Unreleased]" must sit under a "### Added", "### Changed" or "### Fixed" heading',
    );
  }
  const unknownGroup = body.find(
    (line) => line.startsWith(SUBSECTION_PREFIX) && !GROUP_HEADING.test(line),
  );
  if (unknownGroup !== undefined) {
    throw new PrepError(
      `"${unknownGroup.trim()}" is not a changelog group; use "### Added", "### Changed" or "### Fixed"`,
    );
  }
}

/**
 * Moves everything under `[Unreleased]` into a dated section for `version` and
 * rewrites the compare links, leaving `[Unreleased]` empty. Subsection
 * headings with nothing under them are not carried over.
 * @param changelog The current CHANGELOG text.
 * @param version The version being released, without a leading `v`.
 * @param isoDate The release date as `YYYY-MM-DD`.
 * @returns The new CHANGELOG text.
 * @throws {PrepError} When `[Unreleased]` is missing or has no list item, an
 * entry sits outside an Added, Changed or Fixed group, the version already has
 * a section, or the `[Unreleased]` compare link is missing.
 */
export function cutRelease(changelog: string, version: string, isoDate: string): string {
  const lines = changelog.split("\n");
  const unreleased = findUnreleasedBody(lines);
  if (!unreleased) {
    throw new PrepError('CHANGELOG.md has no "## [Unreleased]" section');
  }
  if (lines.some((line) => line.startsWith(`## [${version}]`))) {
    throw new PrepError(`CHANGELOG.md already has a section for ${version}`);
  }
  const body = trimBlankEdges(dropEmptySubsections(unreleased.body));
  assertReleasableBody(body);
  const afterUnreleased = lines.slice(unreleased.headingIndex + 1 + unreleased.body.length);
  const linkIndex = afterUnreleased.findIndex((line) => UNRELEASED_LINK.test(line));
  const link = UNRELEASED_LINK.exec(afterUnreleased[linkIndex] ?? "");
  if (!link) {
    throw new PrepError(
      'CHANGELOG.md has no "[Unreleased]: <repo>/compare/vX.Y.Z...HEAD" link to update',
    );
  }
  const [, repositoryUrl = "", previousVersion = ""] = link;
  afterUnreleased.splice(
    linkIndex,
    1,
    `[Unreleased]: ${repositoryUrl}/compare/v${version}...HEAD`,
    `[${version}]: ${repositoryUrl}/compare/v${previousVersion}...v${version}`,
  );
  return [
    ...lines.slice(0, unreleased.headingIndex + 1),
    "",
    `## [${version}] - ${isoDate}`,
    "",
    ...body,
    "",
    ...afterUnreleased,
  ].join("\n");
}

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/**
 * Prepares a release in the working tree: bumps the package version and moves
 * `[Unreleased]` into a dated section with updated compare links. Both files
 * are validated before the first is written, so a rejected release changes
 * nothing. Never commits, tags or pushes.
 * @param root The repository root to release.
 * @param version The new version, such as `0.9.0` or `0.9.0-beta.1`.
 * @param isoDate The release date as `YYYY-MM-DD`; today when omitted.
 * @returns The files that were rewritten, in the order they were written.
 * @throws {PrepError} When the version is invalid or not higher than the
 * current one, a file does not have the expected shape, or `[Unreleased]` has
 * nothing to release.
 */
export function prepareRelease(
  root: string,
  version: string,
  isoDate: string = todayIsoDate(),
): ChangedFile[] {
  const packageText = readFileSync(path.join(root, PACKAGE_PATH), "utf8");
  const currentVersion = readCurrentVersion(packageText);
  assertIncreasing(version, currentVersion);
  const changelog = cutRelease(
    readFileSync(path.join(root, CHANGELOG_PATH), "utf8"),
    version,
    isoDate,
  );
  const writes = [
    {
      path: PACKAGE_PATH,
      summary: `version ${currentVersion} -> ${version}`,
      content: bumpPackage(packageText, currentVersion, version),
    },
    {
      path: CHANGELOG_PATH,
      summary: `[Unreleased] moved into [${version}] - ${isoDate}, compare links updated`,
      content: changelog,
    },
  ];
  for (const write of writes) {
    writeFileSync(path.join(root, write.path), write.content);
  }
  return writes.map(({ path: filePath, summary }) => ({
    path: filePath,
    summary,
  }));
}

/**
 * Runs `bun scripts/release/prep.ts <version>`.
 * @param commandArguments The arguments after the script name.
 * @param root The repository root to release.
 * @param log Receives each output line.
 * @returns The process exit code: 0 when the release was prepared, 1 when it
 * was rejected.
 */
export function runPrep(
  commandArguments: readonly string[],
  root: string,
  log: (message: string) => void,
): number {
  const [version, ...extra] = commandArguments;
  if (!version || extra.length > 0) {
    log("Usage: bun scripts/release/prep.ts <version>, for example 0.9.0");
    return 1;
  }
  try {
    const changed = prepareRelease(root, version);
    log(`Prepared release ${version}:`);
    for (const file of changed) {
      log(`  ${file.path}: ${file.summary}`);
    }
    log("Nothing was committed, tagged or pushed.");
    return 0;
  } catch (error) {
    if (error instanceof PrepError) {
      log(`release prep: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

if (import.meta.main) {
  process.exitCode = runPrep(
    process.argv.slice(2),
    path.resolve(import.meta.dirname, "../.."),
    console.error,
  );
}
