import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { listWorkflowFiles, readWorkflow } from "./workflow-files.ts";

interface RequiredStatusCheck {
  readonly context: string;
  readonly integration_id?: number;
}

interface RulesetRule {
  readonly type: string;
  readonly parameters?: {
    readonly allowed_merge_methods?: readonly string[];
    readonly strict_required_status_checks_policy?: boolean;
    readonly required_status_checks?: readonly RequiredStatusCheck[];
  };
}

interface Ruleset {
  readonly name: string;
  readonly target: string;
  readonly conditions: {
    readonly ref_name: { readonly include: readonly string[] };
  };
  readonly bypass_actors: readonly unknown[];
  readonly rules: readonly RulesetRule[];
}

interface NamedJob {
  readonly name?: string;
  readonly strategy?: { readonly matrix?: Record<string, unknown> };
}

const RULESETS_DIRECTORY = path.resolve(import.meta.dirname, "../.github/rulesets");
const MATRIX_EXPRESSION = /\$\{\{\s*matrix\.([\w-]+)\s*\}\}/;
const REQUIRED_CHECKS = ["CI passed", "Validate PR title", "Check markdown links"];

function readRuleset(fileName: string): Ruleset {
  return JSON.parse(readFileSync(path.join(RULESETS_DIRECTORY, fileName), "utf8")) as Ruleset;
}

function expandMatrixName(name: string, matrix: Record<string, unknown>): string[] {
  const match = MATRIX_EXPRESSION.exec(name);
  if (match === null) return [name];
  const [expression, key = ""] = match;
  const values: unknown = matrix[key];
  return Array.isArray(values)
    ? values.flatMap((value: unknown) => {
        const expanded = name.replaceAll(expression, () => String(value));
        return expandMatrixName(expanded, matrix);
      })
    : [name];
}

function listWorkflowJobNames(): Set<string> {
  const names = new Set<string>();
  for (const fileName of listWorkflowFiles()) {
    const jobs: Record<string, NamedJob> = readWorkflow(fileName).jobs ?? {};
    for (const [jobId, job] of Object.entries(jobs)) {
      const matrix = job.strategy?.matrix ?? {};
      const expandedNames = expandMatrixName(job.name ?? jobId, matrix);
      for (const name of expandedNames) names.add(name);
    }
  }
  return names;
}

function listRequiredChecks(ruleset: Ruleset): string[] {
  return ruleset.rules.flatMap((rule) =>
    (rule.parameters?.required_status_checks ?? []).map((check) => check.context),
  );
}

function findRule(ruleset: Ruleset, type: string): RulesetRule | undefined {
  return ruleset.rules.find((rule) => rule.type === type);
}

describe("repository rulesets", () => {
  const jobNames = listWorkflowJobNames();

  test.each(["develop.json", "main.json"])(
    "every required check of %s is a workflow job name",
    (fileName) => {
      const requiredChecks = listRequiredChecks(readRuleset(fileName));

      expect(requiredChecks).toEqual(REQUIRED_CHECKS);
      expect(requiredChecks.filter((check) => !jobNames.has(check))).toEqual([]);
    },
  );

  test("the develop ruleset protects the trunk with squash merges and strict checks", () => {
    const develop = readRuleset("develop.json");

    expect(develop.name).toBe("develop");
    expect(develop.target).toBe("branch");
    expect(develop.conditions.ref_name.include).toEqual(["refs/heads/develop"]);
    expect(develop.rules.map((rule) => rule.type)).toEqual([
      "deletion",
      "non_fast_forward",
      "required_linear_history",
      "required_signatures",
      "pull_request",
      "required_status_checks",
    ]);
    expect(findRule(develop, "pull_request")?.parameters?.allowed_merge_methods).toEqual([
      "squash",
    ]);
    expect(
      findRule(develop, "required_status_checks")?.parameters?.strict_required_status_checks_policy,
    ).toBe(true);
  });

  test("the main ruleset only takes promotion merge commits without strict checks", () => {
    const main = readRuleset("main.json");

    expect(main.name).toBe("main");
    expect(main.conditions.ref_name.include).toEqual(["~DEFAULT_BRANCH"]);
    expect(findRule(main, "required_linear_history")).toBeUndefined();
    expect(findRule(main, "required_signatures")).toBeDefined();
    expect(findRule(main, "pull_request")?.parameters?.allowed_merge_methods).toEqual(["merge"]);
    expect(
      findRule(main, "required_status_checks")?.parameters?.strict_required_status_checks_policy,
    ).toBe(false);
  });

  test("matrix job names are expanded to the names GitHub reports", () => {
    const expanded = expandMatrixName("Shard ${{ matrix.shard }} on ${{ matrix.os }}", {
      shard: [1, 2],
      os: ["linux"],
    });

    expect(expanded).toEqual(["Shard 1 on linux", "Shard 2 on linux"]);
    expect([...jobNames].filter((name) => name.includes("${{"))).toEqual([]);
  });

  test.each(["develop.json", "main.json", "tags.json"])("%s has no bypass actors", (fileName) => {
    expect(readRuleset(fileName).bypass_actors).toEqual([]);
  });
});
