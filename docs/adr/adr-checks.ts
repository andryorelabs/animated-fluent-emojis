const ALLOWED_STATUSES = /^(?:(?:Accepted|Proposed|Deprecated)\b|Superseded by .+)/;
const REQUIRED_SECTIONS = ["Status", "Context", "Decision", "Consequences"];
const DATE_LINE_PATTERN = /^Date: \d{4}-\d{2}-\d{2}$/m;
const VALID_REVISED_LINE_PATTERN = /^Revised: \d{4}-\d{2}-\d{2}, \S/;
const RELATION_PHRASE_SOURCE = String.raw`Amended\s+by|Partly\s+superseded\s+by|Superseded\s+by|Amends|Extends|Partly\s+supersedes|Supersedes`;
const RELATION_PHRASE_PATTERN = new RegExp(String.raw`\b(?:${RELATION_PHRASE_SOURCE})\b`, "g");
const RELATION_WITH_LINK_PATTERN = new RegExp(
  String.raw`\b(?:${RELATION_PHRASE_SOURCE})\s+\[\d{4}\]\(\d{4}-[^)]+\.md\)`,
  "g",
);
const RELATION_LIST_PATTERN = new RegExp(
  String.raw`\b(${RELATION_PHRASE_SOURCE})\s+((?:\[\d{4}\]\([^)]+\)(?:,?\s+(?:and\s+)?)?)+)`,
  "g",
);
const RELATION_LINK_PATTERN = /\[(\d{4})\]\(([^)]+)\)/g;
const INDEX_ROW_PATTERN = /^\|\s*(\d{4})\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|[^|]*\|([^|]*)\|\s*$/gm;

const RELATION_KINDS = {
  Amends: { inverse: "Amended by" },
  Extends: { inverse: "Amended by" },
  "Partly supersedes": { inverse: "Partly superseded by" },
  Supersedes: { inverse: "Superseded by" },
} as const;

type ForwardPhrase = keyof typeof RELATION_KINDS;
type InversePhrase = (typeof RELATION_KINDS)[ForwardPhrase]["inverse"];
type RelationPhrase = ForwardPhrase | InversePhrase;

interface Relation {
  readonly phrase: RelationPhrase;
  readonly targetNumber: string;
  readonly targetFile: string;
}

interface IndexRow {
  readonly number: string;
  readonly title: string;
  readonly fileName: string;
  readonly supersededOrAmendedBy: string;
}

/** One ADR markdown file read from `docs/adr`. */
export interface AdrFile {
  readonly fileName: string;
  readonly number: string;
  readonly content: string;
}

function isForwardPhrase(phrase: string): phrase is ForwardPhrase {
  return Object.hasOwn(RELATION_KINDS, phrase);
}

function readStatusSection(content: string): string {
  return /(?:^|\n)## Status\n\n([\s\S]*?)(?=\n## |$)/.exec(content)?.[1] ?? "";
}

function parseRelations(statusSection: string): Relation[] {
  return statusSection
    .matchAll(RELATION_LIST_PATTERN)
    .flatMap((listMatch) =>
      (listMatch[2] ?? "").matchAll(RELATION_LINK_PATTERN).map((link): Relation => ({
        phrase: (listMatch[1] ?? "").replaceAll(/\s+/g, " ") as RelationPhrase,
        targetNumber: link[1] ?? "",
        targetFile: link[2] ?? "",
      })),
    )
    .toArray();
}

function parseIndexRows(indexContent: string): IndexRow[] {
  return Array.from(indexContent.matchAll(INDEX_ROW_PATTERN), (match): IndexRow => ({
    number: match[1] ?? "",
    title: match[2] ?? "",
    fileName: match[3] ?? "",
    supersededOrAmendedBy: (match[4] ?? "").trim(),
  }));
}

function expectedIndexCell(relations: readonly Relation[]): string {
  const entries = relations
    .filter((relation) => !isForwardPhrase(relation.phrase))
    .toSorted((left, right) => left.targetNumber.localeCompare(right.targetNumber))
    .map(
      (relation) =>
        `${relation.targetNumber}${relation.phrase === "Partly superseded by" ? " (partly)" : ""}`,
    );
  return entries.length > 0 ? entries.join(", ") : "-";
}

/**
 * Checks that every relation phrase in a Status section links an ADR number.
 * @param adrs - The ADR files to check.
 * @returns One message per ADR with unlinked relation wording.
 */
export function findRelationWordingViolations(adrs: readonly AdrFile[]): string[] {
  return adrs
    .filter((adr) => {
      const statusSection = readStatusSection(adr.content);
      const phraseCount = statusSection.match(RELATION_PHRASE_PATTERN)?.length ?? 0;
      const linkedCount = statusSection.match(RELATION_WITH_LINK_PATTERN)?.length ?? 0;
      return phraseCount !== linkedCount;
    })
    .map((adr) => `${adr.fileName}: relation wording must link the ADR number`);
}

/**
 * Checks that every relation links an existing ADR and is recorded on both
 * sides with the inverse wording.
 * @param adrs - The ADR files to check.
 * @returns One message per broken or one-sided relation.
 */
export function findRelationViolations(adrs: readonly AdrFile[]): string[] {
  const violations: string[] = [];
  const byFile = new Map(adrs.map((adr) => [adr.fileName, adr]));
  const relationsByFile = new Map(
    adrs.map((adr) => [adr.fileName, parseRelations(readStatusSection(adr.content))]),
  );
  for (const adr of adrs) {
    const adrRelations = relationsByFile.get(adr.fileName) ?? [];
    for (const relation of adrRelations) {
      const target = byFile.get(relation.targetFile);
      if (!target || !relation.targetFile.startsWith(`${relation.targetNumber}-`)) {
        violations.push(
          `${adr.fileName}: "${relation.phrase}" links missing ADR ${relation.targetFile}`,
        );
        continue;
      }
      const inverse = isForwardPhrase(relation.phrase)
        ? RELATION_KINDS[relation.phrase].inverse
        : undefined;
      const mirrored = (relationsByFile.get(target.fileName) ?? []).some(
        (other) =>
          other.targetFile === adr.fileName &&
          (inverse
            ? other.phrase === inverse
            : isForwardPhrase(other.phrase) &&
              RELATION_KINDS[other.phrase].inverse === relation.phrase),
      );
      if (!mirrored) {
        violations.push(
          `${adr.fileName}: "${relation.phrase}" ${target.number} is not recorded on ${target.fileName}`,
        );
      }
    }
  }
  return violations;
}

/**
 * Checks that README rows match each ADR's title and reverse relations.
 * @param adrs - The ADR files to check.
 * @param indexContent - The contents of the ADR index README.
 * @returns One message per mismatched README row.
 */
export function findIndexColumnViolations(
  adrs: readonly AdrFile[],
  indexContent: string,
): string[] {
  const violations: string[] = [];
  const rowsByFile = new Map(parseIndexRows(indexContent).map((row) => [row.fileName, row]));
  for (const adr of adrs) {
    const row = rowsByFile.get(adr.fileName);
    if (!row) continue;
    const title = /^# \d{4}: (.*)$/m.exec(adr.content)?.[1]?.trim() ?? "";
    if (row.title !== title) {
      violations.push(`${adr.fileName}: README title "${row.title}" differs from "${title}"`);
    }
    const expected = expectedIndexCell(parseRelations(readStatusSection(adr.content)));
    if (row.supersededOrAmendedBy !== expected) {
      violations.push(
        `${adr.fileName}: README "Superseded or amended by" is "${row.supersededOrAmendedBy}", expected "${expected}"`,
      );
    }
  }
  return violations;
}

/**
 * Checks a set of ADRs against the enforced invariants: ascending unique
 * numbers, header, sections, status, date, `Revised:` lines, index listing, linked relation wording recorded on both
 * sides and the index relation column.
 * @param adrs - The ADR files to check, sorted by file name.
 * @param indexContent - The contents of the ADR index README.
 * @returns One message per violation, empty when all invariants hold.
 */
export function findAdrViolations(adrs: readonly AdrFile[], indexContent: string): string[] {
  const violations: string[] = [];
  const numbers = adrs.map((adr) => Number(adr.number));

  if (new Set(numbers).size !== numbers.length) {
    violations.push("duplicate ADR number");
  }
  if (numbers.some((number, index) => index > 0 && number < (numbers[index - 1] ?? 0))) {
    violations.push("ADR numbers are not ascending");
  }

  for (const adr of adrs) {
    const firstLine = adr.content.split("\n", 1)[0] ?? "";
    if (!new RegExp(String.raw`^# ${adr.number}: \S.*$`).test(firstLine)) {
      violations.push(`${adr.fileName}: bad header`);
    }
    for (const section of REQUIRED_SECTIONS) {
      if (!new RegExp(`^## ${section}$`, "m").test(adr.content)) {
        violations.push(`${adr.fileName}: missing "## ${section}" section`);
      }
    }
    const statusSection = readStatusSection(adr.content);
    const status = statusSection.split("\n", 1)[0] ?? "";
    if (!ALLOWED_STATUSES.test(status)) {
      violations.push(`${adr.fileName}: unknown status "${status}"`);
    }
    if (!DATE_LINE_PATTERN.test(statusSection)) {
      violations.push(`${adr.fileName}: missing Date line in Status`);
    }
    const revisedLines = statusSection.split("\n").filter((line) => line.startsWith("Revised:"));
    if (revisedLines.some((line) => !VALID_REVISED_LINE_PATTERN.test(line))) {
      violations.push(`${adr.fileName}: Revised line must be "Revised: YYYY-MM-DD, <text>"`);
    }
    if (!indexContent.includes(`](${adr.fileName})`)) {
      violations.push(`${adr.fileName}: not listed in README`);
    }
  }

  const known = new Set(adrs.map((adr) => adr.fileName));
  const linkedFileNames = Array.from(
    indexContent.matchAll(/\]\((\d{4}-[^)]+\.md)\)/g),
    (match) => match[1] ?? "",
  );
  for (const fileName of linkedFileNames) {
    if (!known.has(fileName)) {
      violations.push(`${fileName}: listed in README but missing`);
    }
  }

  violations.push(
    ...findRelationWordingViolations(adrs),
    ...findRelationViolations(adrs),
    ...findIndexColumnViolations(adrs, indexContent),
  );

  return violations;
}
