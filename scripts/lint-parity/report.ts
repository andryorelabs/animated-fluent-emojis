import { diffFindings, findingKey, resolveGate, type AcceptedEntry, type Finding } from "./diff";

/**
 * Where a finding was seen: by both linters, only by the current ESLint
 * config, or only by the candidate stack.
 */
export type Classification = "both" | "eslint-only" | "oxlint-only";

/**
 * One line of the report. `reason` is set when an `accepted.json` entry
 * explains an ESLint-only finding.
 */
export interface ReportRow extends Finding {
  classification: Classification;
  reason?: string;
}

/**
 * The comparison for one harness section (fixtures, repo or corpus).
 * `isCandidatePresent` is false when only the ESLint side ran, in which case
 * every row is ESLint-only and nothing is gated.
 */
export interface SectionReport {
  name: string;
  isCandidatePresent: boolean;
  rows: ReportRow[];
  unexplained: Finding[];
  stale: AcceptedEntry[];
  problems: string[];
  exitCode: 0 | 1;
}

/**
 * Classifies every finding of one section and gates the ESLint-only ones
 * against the accepted gaps. With no candidate findings (`undefined`) the
 * section lists the ESLint findings and passes unless the harness reported
 * problems of its own.
 * @param input Everything one section needs.
 * @param input.name Heading the section is reported under.
 * @param input.eslint Baseline ESLint findings.
 * @param input.candidate Candidate findings, or `undefined` when absent.
 * @param input.accepted Explained gaps from `accepted.json`.
 * @param input.problems Harness problems detected for this section.
 * @returns The classified section report.
 */
export function buildSectionReport(input: {
  name: string;
  eslint: readonly Finding[];
  candidate: readonly Finding[] | undefined;
  accepted: readonly AcceptedEntry[];
  problems: readonly string[];
}): SectionReport {
  const { name, eslint, candidate, accepted, problems } = input;
  const problemExit = problems.length > 0 ? 1 : 0;
  if (candidate === undefined) {
    return {
      name,
      isCandidatePresent: false,
      rows: diffFindings(eslint, []).eslintOnly.map((finding) => ({
        ...finding,
        classification: "eslint-only",
      })),
      unexplained: [],
      stale: [],
      problems: [...problems],
      exitCode: problemExit,
    };
  }
  const diff = diffFindings(eslint, candidate);
  const gate = resolveGate(diff.eslintOnly, accepted);
  const reasons = new Map(gate.explained.map((item) => [findingKey(item), item.reason]));
  const rows: ReportRow[] = [
    ...diff.common.map((finding) => ({
      ...finding,
      classification: "both" as const,
    })),
    ...diff.eslintOnly.map((finding) => {
      const reason = reasons.get(findingKey(finding));
      return {
        ...finding,
        classification: "eslint-only" as const,
        ...(reason !== undefined && { reason }),
      };
    }),
    ...diff.oxlintOnly.map((finding) => ({
      ...finding,
      classification: "oxlint-only" as const,
    })),
  ];
  return {
    name,
    isCandidatePresent: true,
    rows,
    unexplained: gate.unexplained,
    stale: gate.stale,
    problems: [...problems],
    exitCode: problemExit === 1 || gate.exitCode === 1 ? 1 : 0,
  };
}

const CLASSIFICATION_ORDER: readonly Classification[] = ["eslint-only", "oxlint-only", "both"];

const formatLocation = (finding: Finding): string =>
  `\`${finding.file}:${String(finding.line)}\` \`${finding.rule}\``;

function renderRow(row: ReportRow): string {
  const note = row.reason === undefined ? "" : ` (accepted: ${row.reason})`;
  return `- ${formatLocation(row)}${note}`;
}

function renderSection(section: SectionReport): string {
  const lines = [`## ${section.name}`, ""];
  if (!section.isCandidatePresent) {
    lines.push("Candidate stack absent: ESLint baseline findings only.", "");
  }
  for (const problem of section.problems) lines.push(`- HARNESS: ${problem}`);
  for (const classification of CLASSIFICATION_ORDER) {
    const rows = section.rows.filter((row) => row.classification === classification);
    if (rows.length === 0) continue;
    lines.push(
      `### ${classification} (${String(rows.length)})`,
      "",
      ...rows.map((row) => renderRow(row)),
      "",
    );
  }
  if (section.unexplained.length > 0) {
    lines.push(
      `### UNEXPLAINED ESLint-only (${String(section.unexplained.length)})`,
      "",
      ...section.unexplained.map((finding) => `- ${formatLocation(finding)}`),
      "",
    );
  }
  for (const entry of section.stale) {
    lines.push(`- stale accepted entry: \`${entry.file}\` \`${entry.rule}\``);
  }
  return lines.join("\n");
}

/**
 * Renders the per-`(file, line, rule)` report as markdown, ESLint-only
 * findings first since those are the ones that gate the run.
 * @param sections The sections to render.
 * @returns The markdown document.
 */
export function renderMarkdown(sections: readonly SectionReport[]): string {
  const body = sections.map((section) => renderSection(section)).join("\n");
  return `# Lint parity report\n\n${body}\n`;
}
