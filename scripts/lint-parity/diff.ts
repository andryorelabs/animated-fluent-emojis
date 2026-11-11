import path from "node:path";

/**
 * One lint finding, identified by `(file, line, rule)` in ESLint rule ids.
 */
export interface Finding {
  file: string;
  line: number;
  rule: string;
}

/**
 * A documented, explained gap. Omitting `line` accepts every line of that
 * `(file, rule)`; `reason` is mandatory and must not be blank.
 */
export interface AcceptedEntry {
  file: string;
  line?: number;
  rule: string;
  reason: string;
}

export interface FindingsDiff {
  common: Finding[];
  eslintOnly: Finding[];
  oxlintOnly: Finding[];
}

export interface GateResult {
  unexplained: Finding[];
  explained: (Finding & { reason: string })[];
  stale: AcceptedEntry[];
  exitCode: 0 | 1;
}

export const findingKey = (finding: Finding): string =>
  `${finding.file}:${String(finding.line)}:${finding.rule}`;

const compareFindings = (left: Finding, right: Finding): number =>
  left.file.localeCompare(right.file) ||
  left.line - right.line ||
  left.rule.localeCompare(right.rule);

function uniqueSorted(findings: readonly Finding[]): Finding[] {
  const byKey = new Map(findings.map((item) => [findingKey(item), item]));
  return byKey.values().toArray().toSorted(compareFindings);
}

/**
 * Splits two finding sets by exact `(file, line, rule)` identity. Duplicates
 * collapse and every list comes back sorted, so output is deterministic.
 * @param eslint Findings from the baseline ESLint config.
 * @param oxlint Findings from the candidate stack.
 * @returns The findings split into common, ESLint-only and Oxlint-only.
 */
export function diffFindings(eslint: readonly Finding[], oxlint: readonly Finding[]): FindingsDiff {
  const eslintUnique = uniqueSorted(eslint);
  const oxlintUnique = uniqueSorted(oxlint);
  const eslintKeys = new Set(eslintUnique.map((item) => findingKey(item)));
  const oxlintKeys = new Set(oxlintUnique.map((item) => findingKey(item)));
  return {
    common: eslintUnique.filter((item) => oxlintKeys.has(findingKey(item))),
    eslintOnly: eslintUnique.filter((item) => !oxlintKeys.has(findingKey(item))),
    oxlintOnly: oxlintUnique.filter((item) => !eslintKeys.has(findingKey(item))),
  };
}

/**
 * Parses an `accepted.json` document. Throws on a non-array, a malformed
 * entry, or an entry whose `reason` is missing or blank: a gap is never
 * accepted without an explanation.
 * @param text The raw `accepted.json` text.
 * @returns The validated entries.
 */
export function parseAccepted(text: string): AcceptedEntry[] {
  const document: unknown = JSON.parse(text);
  if (!Array.isArray(document)) {
    throw new TypeError("accepted.json must be a JSON array");
  }
  return (document as unknown[]).map((raw, index) => {
    const entry = raw as Partial<AcceptedEntry> | null;
    const label = `accepted.json entry ${String(index)}`;
    if (typeof entry?.file !== "string" || typeof entry.rule !== "string") {
      throw new TypeError(`${label} needs string "file" and "rule"`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new TypeError(`${label} needs a non-empty "reason"`);
    }
    if (entry.line !== undefined && typeof entry.line !== "number") {
      throw new TypeError(`${label} "line" must be a number`);
    }
    return {
      file: entry.file,
      ...(entry.line !== undefined && { line: entry.line }),
      rule: entry.rule,
      reason: entry.reason,
    };
  });
}

const isCoveredBy = (entry: AcceptedEntry, finding: Finding): boolean =>
  entry.file === finding.file &&
  entry.rule === finding.rule &&
  (entry.line === undefined || entry.line === finding.line);

/**
 * Applies the accepted gaps to the ESLint-only findings. Anything left
 * unexplained fails the gate (exit code 1); accepted entries that matched
 * nothing are reported as stale so the list cannot rot silently.
 * @param eslintOnly Findings only ESLint reported.
 * @param accepted Explained gaps from `accepted.json`.
 * @returns The explained, unexplained and stale findings plus the exit code.
 */
export function resolveGate(
  eslintOnly: readonly Finding[],
  accepted: readonly AcceptedEntry[],
): GateResult {
  const unexplained: Finding[] = [];
  const explained: GateResult["explained"] = [];
  const used = new Set<AcceptedEntry>();
  for (const finding of eslintOnly) {
    const match = accepted.find((entry) => isCoveredBy(entry, finding));
    if (match) {
      used.add(match);
      explained.push({ ...finding, reason: match.reason });
    } else {
      unexplained.push(finding);
    }
  }
  return {
    unexplained,
    explained,
    stale: accepted.filter((entry) => !used.has(entry)),
    exitCode: unexplained.length > 0 ? 1 : 0,
  };
}

const OXLINT_PLUGIN_PREFIX: Record<string, string> = {
  eslint: "",
  "eslint-js": "",
  typescript: "@typescript-eslint/",
  "typescript-eslint": "@typescript-eslint/",
  nextjs: "@next/next/",
  next: "@next/next/",
  "unicorn-js": "unicorn/",
  "jsdoc-js": "jsdoc/",
  "react-hooks-js": "react-hooks/",
  "vitest-js": "vitest/",
  "typed-react": "@eslint-react/",
  "typescript-js": "@typescript-eslint/",
};

/**
 * Maps an Oxlint diagnostic `code` (`plugin(rule)`) to the ESLint rule id the
 * same rule has under the current config, including the jsPlugin aliases
 * that run an original ESLint rule (`eslint-js`, `unicorn-js`, `jsdoc-js`,
 * `react-hooks-js`, `vitest-js`, `typescript-js`, and `typed-react` for
 * `@eslint-react`). Unknown plugins map to
 * `plugin/rule`, which is how every other plugin names its rules.
 * @param code The Oxlint diagnostic code, such as `eslint(no-console)`.
 * @returns The ESLint rule id.
 */
export function normalizeOxlintRule(code: string): string {
  const match = /^([^()]+)\((.+)\)$/.exec(code);
  if (!match) return code;
  const [, plugin = "", rule = ""] = match;
  return `${OXLINT_PLUGIN_PREFIX[plugin] ?? `${plugin}/`}${rule}`;
}

/**
 * Pseudo rule id for "unused disable directive" reports: ESLint emits them
 * without a rule id, Oxlint with an empty code, and both are enforced
 * (`reportUnusedDisableDirectives`).
 */
export const UNUSED_DIRECTIVE_RULE = "unused-disable-directive";

const UNUSED_DIRECTIVE_MESSAGE = /^Unused (?:eslint|oxlint)-(?:disable|enable) directive/;

interface EslintResult {
  filePath: string;
  messages: {
    ruleId: string | null;
    line: number;
    message?: string;
    fatal?: boolean;
  }[];
}

/**
 * Reads `eslint --format json` output. Fatal messages (parse errors) throw so
 * a file ESLint could not analyse never silently drops out of the comparison;
 * other messages without a rule id are skipped. Paths become repo-relative.
 * @param text The `eslint --format json` output.
 * @param root Directory the file paths are made relative to.
 * @returns The findings, one per rule message.
 */
export function parseEslintJson(text: string, root: string): Finding[] {
  const results = JSON.parse(text) as EslintResult[];
  const fatal = results.flatMap((result) =>
    result.messages
      .filter((message) => message.fatal === true)
      .map((message) => `${result.filePath}: ${message.message ?? "fatal"}`),
  );
  if (fatal.length > 0) {
    throw new Error(`ESLint reported fatal errors:\n${fatal.join("\n")}`);
  }
  return results.flatMap((result) =>
    result.messages
      .map((message) => ({
        line: message.line,
        rule:
          message.ruleId ??
          (UNUSED_DIRECTIVE_MESSAGE.test(message.message ?? "")
            ? UNUSED_DIRECTIVE_RULE
            : undefined),
      }))
      .filter((item) => item.rule !== undefined)
      .map((item) => ({
        file: path.relative(root, result.filePath),
        line: item.line,
        rule: item.rule ?? UNUSED_DIRECTIVE_RULE,
      })),
  );
}

interface OxlintOutput {
  diagnostics: {
    code: string | null;
    message?: string;
    filename: string;
    labels?: { span: { line: number } }[];
  }[];
}

/**
 * Reads `oxlint --format json` output. A diagnostic without a label has no
 * location and is kept at line 0 so it still shows up in the diff.
 * @param text The `oxlint --format json` output.
 * @param root Directory the file paths are made relative to.
 * @returns The findings, one per diagnostic.
 */
export function parseOxlintJson(text: string, root: string): Finding[] {
  const output = JSON.parse(text) as OxlintOutput;
  return output.diagnostics.map((diagnostic) => {
    const code = diagnostic.code ?? "";
    return {
      file: path.isAbsolute(diagnostic.filename)
        ? path.relative(root, diagnostic.filename)
        : diagnostic.filename,
      line: diagnostic.labels?.[0]?.span.line ?? 0,
      rule:
        code === "" && UNUSED_DIRECTIVE_MESSAGE.test(diagnostic.message ?? "")
          ? UNUSED_DIRECTIVE_RULE
          : normalizeOxlintRule(code),
    };
  });
}
