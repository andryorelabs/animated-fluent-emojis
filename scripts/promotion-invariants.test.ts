import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

import { readWorkflow, type Workflow, type WorkflowStep } from "./workflow-files";

const PROMOTION_TITLE = "chore: 🔀 promote develop to main";
const TRUNK_BRANCHES = ["main", "develop"];
const COMMITLINT_CONDITION =
  "github.event_name == 'pull_request' && !(github.base_ref == 'main' && github.head_ref == 'develop')";
const NEVER_CANCEL_ON_TRUNK =
  "${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}";
const JOB_RESULTS = ["success", "failure", "cancelled", "skipped"] as const;

type JobResult = (typeof JOB_RESULTS)[number];

interface TriggeredWorkflow extends Workflow {
  readonly on?: { readonly push?: { readonly branches?: unknown } };
  readonly concurrency?: { readonly "cancel-in-progress"?: unknown };
}

function readTriggeredWorkflow(fileName: string): TriggeredWorkflow {
  return readWorkflow(fileName) as TriggeredWorkflow;
}

function pushBranches(fileName: string): unknown {
  return readTriggeredWorkflow(fileName).on?.push?.branches;
}

function resultVariableName(jobName: string): string {
  return `${jobName.toUpperCase()}_RESULT`;
}

function ciPassedNeeds(): string[] {
  return readWorkflow("ci.yml").jobs?.["ci-passed"]?.needs as string[];
}

function ciPassedStep(): WorkflowStep {
  const [step] = readWorkflow("ci.yml").jobs?.["ci-passed"]?.steps ?? [];
  if (step === undefined) throw new Error("ci-passed has no step");
  return step;
}

function runCiPassedCheck(results: Record<string, JobResult>): number | null {
  const environment = Object.fromEntries(
    Object.entries(results).map(([jobName, result]) => [resultVariableName(jobName), result]),
  );
  const outcome = spawnSync("bash", ["-euo", "pipefail", "-c", ciPassedStep().run ?? ""], {
    env: { PATH: process.env.PATH, ...environment },
    encoding: "utf8",
  });
  return outcome.status;
}

function allSucceeded(): Record<string, JobResult> {
  return Object.fromEntries(ciPassedNeeds().map((jobName) => [jobName, "success"]));
}

interface PullRequestTitleRule {
  readonly types: ReadonlySet<string>;
  readonly subjectPattern: RegExp;
}

function stringInput(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readPullRequestTitleRule(): PullRequestTitleRule {
  const step = readWorkflow("lint-pr.yml").jobs?.["validate-title"]?.steps?.find((candidate) =>
    candidate.uses?.startsWith("amannn/action-semantic-pull-request@"),
  );
  const types = stringInput(step?.with?.types)
    .split("\n")
    .map((type) => type.trim())
    .filter((type) => type !== "");
  const subjectPattern = stringInput(step?.with?.subjectPattern);
  if (subjectPattern === "" || types.length === 0) {
    throw new Error("lint-pr.yml has no semantic pull request title rule");
  }
  return { types: new Set(types), subjectPattern: new RegExp(subjectPattern) };
}

function satisfiesTitleRule(title: string, rule: PullRequestTitleRule): boolean {
  const header = /^(?<type>\w+)(?:\([^)]+\))?!?: (?<subject>.+)$/.exec(title);
  const type = header?.groups?.type ?? "";
  const subject = header?.groups?.subject ?? "";
  return rule.types.has(type) && rule.subjectPattern.test(subject);
}

describe("S4: CI and CodeQL run on the trunk branches", () => {
  test.each(["ci.yml", "codeql.yml"])("%s runs on push to main and develop", (fileName) => {
    expect(pushBranches(fileName)).toEqual(TRUNK_BRANCHES);
  });

  test.each(["ci.yml", "codeql.yml"])(
    "%s never cancels an in-progress run on main or develop",
    (fileName) => {
      const concurrency = readTriggeredWorkflow(fileName).concurrency;
      expect(concurrency?.["cancel-in-progress"]).toBe(NEVER_CANCEL_ON_TRUNK);
    },
  );

  test.each(["labels.yml", "scorecard.yml", "deploy-site.yml"])(
    "%s still runs on main only",
    (fileName) => {
      expect(pushBranches(fileName)).toEqual(["main"]);
    },
  );
});

describe("S5: a promotion pull request skips commitlint and still passes", () => {
  test("commitlint is skipped on a pull request from develop to main", () => {
    expect(readWorkflow("ci.yml").jobs?.commitlint?.if).toBe(COMMITLINT_CONDITION);
  });

  test("CI passed needs commitlint", () => {
    expect(ciPassedNeeds()).toContain("commitlint");
  });

  test("CI passed reads the result of every job it needs", () => {
    const expected = Object.fromEntries(
      ciPassedNeeds().map((jobName) => [
        resultVariableName(jobName),
        `\${{ needs.${jobName}.result }}`,
      ]),
    );
    expect(ciPassedStep().env).toEqual(expected);
  });

  test("CI passed succeeds when every job succeeded", () => {
    expect(runCiPassedCheck(allSucceeded())).toBe(0);
  });

  test("CI passed succeeds when only commitlint was skipped", () => {
    expect(runCiPassedCheck({ ...allSucceeded(), commitlint: "skipped" })).toBe(0);
  });

  test.each(["failure", "cancelled"] as const)(
    "CI passed fails when commitlint is %s",
    (result) => {
      expect(runCiPassedCheck({ ...allSucceeded(), commitlint: result })).toBe(1);
    },
  );

  test("CI passed treats skipped as failing for every job but commitlint", () => {
    const otherJobs = ciPassedNeeds().filter((jobName) => jobName !== "commitlint");
    const unsuccessfulResults = JOB_RESULTS.filter((candidate) => candidate !== "success");
    expect(otherJobs.length).toBeGreaterThan(0);
    for (const jobName of otherJobs) {
      for (const result of unsuccessfulResults) {
        expect(
          runCiPassedCheck({ ...allSucceeded(), [jobName]: result }),
          `${jobName} ${result}`,
        ).toBe(1);
      }
    }
  });

  test("the promotion title satisfies the rule Validate PR title enforces", () => {
    expect(satisfiesTitleRule(PROMOTION_TITLE, readPullRequestTitleRule())).toBe(true);
  });

  test("the title rule still rejects an uppercase subject and an unknown type", () => {
    const rule = readPullRequestTitleRule();
    expect(satisfiesTitleRule("chore: Promote develop to main", rule)).toBe(false);
    expect(satisfiesTitleRule("promote: develop to main", rule)).toBe(false);
  });
});

describe("S6: the weekly emoji-lists pull request targets develop", () => {
  const job = readWorkflow("sync-assets.yml").jobs?.["emoji-lists"];
  const steps = job?.steps ?? [];

  test("checks out develop", () => {
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout?.with?.ref).toBe("develop");
  });

  test("opens the pull request against develop", () => {
    const script = steps.map((step) => step.run ?? "").join("\n");
    expect(script).toMatch(/gh pr create[^\n]*\\\n\s+--base develop \\/);
    expect(script).not.toContain("--base main");
  });

  test("the Cloudflare Pages deploys still target main", () => {
    const deploys = (readWorkflow("sync-assets.yml").jobs?.sync?.steps ?? []).filter((step) =>
      stringInput(step.with?.command).includes("pages deploy"),
    );
    expect(deploys.length).toBeGreaterThan(0);
    for (const deploy of deploys) {
      expect(stringInput(deploy.with?.command)).toContain("--branch=main");
    }
  });
});
