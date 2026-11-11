import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import type { AcceptedEntry, Finding } from "./diff";
import { MODES, parseMode, type Mode } from "./modes";
import { buildSectionReport, type SectionReport } from "./report";

/**
 * Suffix the committed fixtures carry so the repository's own lint,
 * formatter and TypeScript project never see them.
 */
export const FIXTURE_SUFFIX = ".fixture";

/**
 * The parsed command line.
 */
export interface Options {
  mode: Mode;
  isTypeAware: boolean;
  accepted: string;
  corpusDirectory: string;
  report: string;
}

/**
 * Where the options default to when a flag is omitted.
 */
export interface OptionDefaults {
  accepted: string;
  corpusDirectory: string;
  report: string;
}

/**
 * The `--help` text.
 */
export const HELP = `bun scripts/lint-parity/run.ts [options]

Differential lint parity: runs the frozen baseline ESLint config
(scripts/lint-parity/eslint.baseline.config.mjs) and, when installed, the
candidate stack (Oxlint plus the minimal ESLint for .astro) over the same
inputs, and diffs the findings per (file, line, rule). Exits 1 when ESLint
reports something the candidate does not and no accepted.json entry explains
it. With the candidate absent there is nothing to compare against: every
ESLint finding is reported and the run exits 0.

Modes (--mode)
  fixtures   (default) Violation fixtures in scripts/lint-parity/fixtures/tree,
             one or more per enforced rule family and policy. They are stored
             with a ${FIXTURE_SUFFIX} suffix, copied to their repo-relative path
             (path-scoped config blocks and the TypeScript project service
             need it), linted, and removed again. The baseline must flag every
             rule listed in fixtures/expected.json or the run fails.
  repo       This repository, linted from the root.
  corpus     External TS/React repos fetched at a pinned commit into
             .cache/lint-parity/corpus (never committed) and linted without
             type information. The repository lint ignores .cache.
  all        fixtures, repo and corpus.

Type-aware (default)
  Oxlint runs with --type-aware (tsgolint) and the baseline with type
  information, so type-aware rules are gated. --no-type-aware skips them on
  both sides for a quick run; such a run is not a valid gate.

accepted.json (--accepted, default scripts/lint-parity/accepted.json)
  JSON array of explained gaps: { "file", "line"?, "rule", "reason" }. A
  missing "line" covers every line of that file and rule. "reason" is
  mandatory. Entries that match nothing are reported as stale.

Options
  --mode <${MODES.join("|")}>   what to lint (default fixtures)
  --no-type-aware                skip type-aware rules (not a valid gate)
  --accepted <path>              accepted gaps file
  --corpus-dir <path>            where corpus repos are cloned
  --report <path>                JSON report; a .md twin is written next to it
  --help                         show this text
`;

/**
 * Parses the command line.
 * @param argv The arguments after the script name.
 * @param defaults Paths used for omitted flags.
 * @returns The options, or `undefined` when `--help` was requested.
 */
export function parseOptions(argv: string[], defaults: OptionDefaults): Options | undefined {
  const { values } = parseArgs({
    args: argv,
    options: {
      mode: { type: "string", default: "fixtures" },
      "no-type-aware": { type: "boolean", default: false },
      accepted: { type: "string", default: defaults.accepted },
      "corpus-dir": { type: "string", default: defaults.corpusDirectory },
      report: { type: "string", default: defaults.report },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) return undefined;
  return {
    mode: parseMode(values.mode),
    isTypeAware: !values["no-type-aware"],
    accepted: path.resolve(values.accepted),
    corpusDirectory: path.resolve(values["corpus-dir"]),
    report: path.resolve(values.report),
  };
}

interface RuleMetadata {
  meta?: {
    docs?: {
      requiresTypeChecking?: boolean;
      extendsBaseRule?: boolean | string;
    };
  };
}

/**
 * Builds the function that maps a rule id to the one both sides are compared
 * under, for rules that are the same rule under two names:
 *
 * - a typescript-eslint extension rule (`@typescript-eslint/no-empty-function`)
 *   and the core rule of the same name, which Oxlint's native port runs on
 *   TypeScript too: both become the core name. Extensions renamed from their
 *   base (`only-throw-error`) keep their own id.
 * - an `eslint-plugin-react-hooks` rule, which Oxlint ports into its `react`
 *   plugin (`react/set-state-in-effect`): both become `react-hooks/...`.
 * @returns The canonicalizing function; other ids pass through unchanged.
 */
export function canonicalRuleIdFunction(): (rule: string) => string {
  const typescriptRules = (tseslint.plugin as unknown as { rules: Record<string, RuleMetadata> })
    .rules;
  const extensionRules = new Set(
    Object.entries(typescriptRules)
      .filter(([, rule]) => rule.meta?.docs?.extendsBaseRule === true)
      .map(([name]) => name),
  );
  const hookRules = new Set(Object.keys(reactHooks.rules));
  return (rule) => {
    const [, plugin, name = ""] = /^(@typescript-eslint|react)\/(.+)$/.exec(rule) ?? [];
    if (plugin === "@typescript-eslint" && extensionRules.has(name)) return name;
    return plugin === "react" && hookRules.has(name) ? `react-hooks/${name}` : rule;
  };
}

/**
 * Every rule id of the baseline that needs type information: the
 * `@typescript-eslint` rules flagged `requiresTypeChecking` plus the rules
 * `@eslint-react`'s type-checked preset adds over its plain one.
 * @returns The set of ids a type-less run cannot reproduce.
 */
export function ruleIdsRequiringTypes(): Set<string> {
  const rules = (tseslint.plugin as unknown as { rules: Record<string, RuleMetadata> }).rules;
  const typescriptRules = Object.entries(rules)
    .filter(([, rule]) => rule.meta?.docs?.requiresTypeChecking === true)
    .map(([name]) => `@typescript-eslint/${name}`);
  const reactRuleIds = (preset: "recommended" | "recommended-type-checked") =>
    Object.keys(eslintReact.configs[preset].rules ?? {});
  const plainReact = new Set(reactRuleIds("recommended"));
  const typedOnlyReact = reactRuleIds("recommended-type-checked").filter(
    (rule) => !plainReact.has(rule),
  );
  return new Set([...typescriptRules, ...typedOnlyReact]);
}

/**
 * Checks the baseline against `expected.json`: every listed rule must show up
 * on its fixture, and every materialized fixture must be listed.
 * @param expected Fixture path to the rule ids it must trigger.
 * @param findings The baseline findings.
 * @param files The materialized fixture paths.
 * @returns One message per problem; empty when the baseline behaves.
 */
export function checkExpectedFixtures(
  expected: Readonly<Record<string, readonly string[]>>,
  findings: readonly Finding[],
  files: readonly string[],
): string[] {
  const seen = new Set(findings.map((item) => `${item.file}|${item.rule}`));
  const missing = Object.entries(expected).flatMap(([file, rules]) =>
    rules
      .filter((rule) => !seen.has(`${file}|${rule}`))
      .map((rule) => `ESLint did not report ${rule} on fixture ${file}`),
  );
  const unlisted = files
    .filter((file) => !Object.hasOwn(expected, file))
    .map((file) => `Fixture ${file} is missing from expected.json`);
  return [...missing, ...unlisted];
}

/**
 * Splits the lint targets between Oxlint and the minimal ESLint that owns
 * `.astro`. Explicit files split by extension; directory targets are linted
 * by Oxlint as given and by ESLint through an `.astro` glob.
 * @param targets Files or directories relative to the repo root.
 * @param isExplicitFiles Whether `targets` are files rather than directories.
 * @returns The Oxlint targets and the ESLint `.astro` targets.
 */
export function splitCandidateTargets(
  targets: readonly string[],
  isExplicitFiles: boolean,
): { oxlint: string[]; astro: string[] } {
  if (isExplicitFiles) {
    return {
      oxlint: targets.filter((target) => !target.endsWith(".astro")),
      astro: targets.filter((target) => target.endsWith(".astro")),
    };
  }
  return {
    oxlint: [...targets],
    astro: targets.map((target) => (target === "." ? "**/*.astro" : `${target}/**/*.astro`)),
  };
}

/**
 * Lists the files under a directory as sorted forward-slash paths relative
 * to it.
 * @param directory The directory to walk.
 * @returns The relative file paths.
 */
export function listFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
    )
    .toSorted((left, right) => left.localeCompare(right));
}

/**
 * Copies the fixture tree into the repo at each file's repo-relative path
 * (path-scoped config blocks only apply there), stripping the fixture
 * suffix, and returns the file list plus a cleanup that removes exactly what
 * was copied. Refuses to overwrite an existing file.
 * @param treeDirectory The directory holding the stored fixtures.
 * @param repositoryRoot The directory the fixtures are copied into.
 * @returns The repo-relative fixture paths and the cleanup function.
 */
export function materializeFixtures(
  treeDirectory: string,
  repositoryRoot: string,
): { files: string[]; cleanup: () => void } {
  const stored = listFiles(treeDirectory);
  const files = stored.map((file) => file.slice(0, -FIXTURE_SUFFIX.length));
  const clash = files.find((file) => existsSync(path.join(repositoryRoot, file)));
  if (clash !== undefined) {
    throw new Error(`Fixture ${clash} would overwrite an existing repo file`);
  }
  const created: string[] = [];
  const cleanup = () => {
    for (const target of created) rmSync(target, { force: true });
  };
  try {
    for (const [index, file] of files.entries()) {
      const target = path.join(repositoryRoot, file);
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(path.join(treeDirectory, stored[index] ?? ""), target);
      created.push(target);
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  return { files, cleanup };
}

/**
 * The raw output of one harness section before it is gated.
 */
export interface RawSection {
  name: string;
  eslint: Finding[];
  candidate: Finding[] | undefined;
  problems: string[];
  isTypeAware: boolean;
}

/**
 * Gates one section. Unless the run is type-aware, baseline findings from
 * rules that need type information are left out, since the candidate does
 * not run them. Both sides are then compared under canonical rule ids.
 * @param raw The section output.
 * @param accepted Explained gaps from `accepted.json`.
 * @param typedRules Rule ids that need type information.
 * @param canonicalRuleId Maps a rule id to the id both sides compare under.
 * @returns The classified section report.
 */
export function toSectionReport(
  raw: RawSection,
  accepted: readonly AcceptedEntry[],
  typedRules: ReadonlySet<string>,
  canonicalRuleId: (rule: string) => string = (rule) => rule,
): SectionReport {
  const canonical = (findings: readonly Finding[]): Finding[] =>
    findings.map((finding) => ({
      ...finding,
      rule: canonicalRuleId(finding.rule),
    }));
  const eslint = raw.isTypeAware
    ? raw.eslint
    : raw.eslint.filter((finding) => !typedRules.has(finding.rule));
  return buildSectionReport({
    name: raw.name,
    eslint: canonical(eslint),
    candidate: raw.candidate && canonical(raw.candidate),
    accepted,
    problems: raw.problems,
  });
}

/**
 * Summarizes a section as console lines: the candidate notice, counts per
 * classification, then unexplained findings, harness problems and stale
 * entries.
 * @param section The section report.
 * @returns The lines to print.
 */
export function summarizeSection(section: SectionReport): string[] {
  const counts = Object.entries(Object.groupBy(section.rows, (row) => row.classification)).map(
    ([classification, rows]) => `${classification}: ${String(rows.length)}`,
  );
  return [
    `== ${section.name} ==`,
    ...(section.isCandidatePresent
      ? []
      : ["Candidate stack (Oxlint) not installed: ESLint baseline only, nothing to compare."]),
    ...counts,
    ...section.unexplained.map(
      (finding) =>
        `UNEXPLAINED ESLint-only: ${finding.file}:${String(finding.line)} ${finding.rule}`,
    ),
    ...section.problems.map((problem) => `HARNESS: ${problem}`),
    ...section.stale.map((entry) => `stale accepted entry: ${entry.file} ${entry.rule}`),
  ];
}
