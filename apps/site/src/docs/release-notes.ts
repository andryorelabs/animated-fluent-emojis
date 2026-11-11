/**
 * One released version parsed from `CHANGELOG.md`.
 */
export interface ReleaseNote {
  version: string;
  isoDate: string;
  body: string;
  compareUrl?: string;
}

/**
 * Section headings the changelog may use under a version.
 */
const RELEASE_SECTIONS = [
  "Added",
  "Changed",
  "Deprecated",
  "Fixed",
  "Migration",
  "Removed",
  "Security",
] as const;

const RELEASE_HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;
const UNRELEASED_HEADING = /^## \[Unreleased\]\s*$/;
const SECOND_LEVEL_HEADING_PREFIX = "## ";
const SECTION_HEADING = /^### (.+?)\s*$/;
const LINK_REFERENCE = /^\[(\d+\.\d+\.\d+|Unreleased)\]:\s*(\S*)\s*$/;

interface OpenEntry {
  version: string | null;
  isoDate: string;
  lines: string[];
}

function compareVersionsDescending(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function assertRealDate(isoDate: string, lineNumber: number, line: string) {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`CHANGELOG.md line ${String(lineNumber)}: invalid release date in "${line}"`);
  }
}

function collectLinkReferences(lines: string[]): {
  references: Map<string, string>;
  contentLines: string[];
} {
  const references = new Map<string, string>();
  const contentLines: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = LINK_REFERENCE.exec(line);
    if (!match) {
      contentLines.push(line);
      continue;
    }
    const [, version = "", inlineUrl = ""] = match;
    const url = inlineUrl || (lines[index + 1] ?? "").trim();
    if (!inlineUrl) index += 1;
    references.set(version, url);
  }
  return { references, contentLines };
}

/**
 * Parses a Keep a Changelog document into released versions, newest first.
 * Text before the first `## ` heading is ignored. `## [Unreleased]` is
 * validated like a release but never returned, so unreleased work stays off the
 * site until it ships. Footer link references (`[x.y.z]: url`) become each
 * entry's `compareUrl`.
 * @param markdown - The raw `CHANGELOG.md` contents.
 * @returns The release entries, newest first.
 * @throws {Error} When a heading is not `## [x.y.z] - YYYY-MM-DD` or
 * `## [Unreleased]`, a date is not a real date, a `### ` section is unknown or
 * a version appears twice. The message names the offending line.
 */
export function parseChangelog(markdown: string): ReleaseNote[] {
  const { references, contentLines } = collectLinkReferences(markdown.split(/\r?\n/));
  const entries: ReleaseNote[] = [];
  const seen = new Set<string>();
  let current: OpenEntry | null = null;

  const flush = () => {
    if (current?.version) {
      const compareUrl = references.get(current.version);
      entries.push({
        version: current.version,
        isoDate: current.isoDate,
        body: current.lines.join("\n").trim(),
        ...(compareUrl && { compareUrl }),
      });
    }
    current = null;
  };

  for (const [index, line] of contentLines.entries()) {
    const lineNumber = index + 1;
    if (!line.startsWith(SECOND_LEVEL_HEADING_PREFIX)) {
      if (current) {
        const section = SECTION_HEADING.exec(line)?.[1];
        if (section && !(RELEASE_SECTIONS as readonly string[]).includes(section)) {
          throw new Error(
            `CHANGELOG.md line ${String(lineNumber)}: unknown section "${line}"; expected one of ${RELEASE_SECTIONS.join(", ")}`,
          );
        }
        current.lines.push(line);
      }
      continue;
    }
    flush();
    if (UNRELEASED_HEADING.test(line)) {
      current = { version: null, isoDate: "", lines: [] };
      continue;
    }
    const match = RELEASE_HEADING.exec(line);
    if (!match) {
      throw new Error(
        `CHANGELOG.md line ${String(lineNumber)}: malformed release heading "${line}"; expected "## [x.y.z] - YYYY-MM-DD"`,
      );
    }
    const [, version = "", isoDate = ""] = match;
    assertRealDate(isoDate, lineNumber, line);
    if (seen.has(version)) {
      throw new Error(`CHANGELOG.md line ${String(lineNumber)}: duplicate version ${version}`);
    }
    seen.add(version);
    current = { version, isoDate, lines: [] };
  }
  flush();

  return entries.toSorted((left, right) => compareVersionsDescending(left.version, right.version));
}

/**
 * Renders the changelog page markdown: one H2 per version, linked to its
 * compare or release URL when the changelog has one, followed by the date and
 * the entry body verbatim.
 * @param entries - Entries from `parseChangelog`.
 * @returns The changelog page markdown.
 */
export function renderReleaseNotesMarkdown(entries: ReleaseNote[]): string {
  const sections = entries.map((entry) => {
    const heading = entry.compareUrl ? `[${entry.version}](${entry.compareUrl})` : entry.version;
    return `## ${heading}\n\n${entry.isoDate}\n\n${entry.body}`;
  });
  return `${sections.join("\n\n")}\n`;
}
