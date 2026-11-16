import { describe, expect, test } from "vitest";
import { parse } from "yaml";

import { readWorkflow } from "./workflow-files";
import {
  checksChangelogBeforeBuild,
  codeqlInitsWithoutBuildModeNone,
  concurrencyGroup,
  deployJobsRunningOnRef,
  jobsOffRunnerExpression,
  jobsRunningOnPrivateRepositories,
  jobsRunningOnRef,
  pushBranches,
  ROUTED_RUNS_ON,
  type RuleJob,
  type RuleWorkflow,
  triggerNames,
  uploadsSarif,
} from "./workflow-rules";

function workflowFrom(source: string): RuleWorkflow {
  return parse(source) as RuleWorkflow;
}

const FEATURE_REF = "refs/heads/feat/new-emoji";
const MAIN_REF = "refs/heads/main";

const GUARDED_DEPLOY = [
  "jobs:",
  "  build:",
  "    steps: [{ run: bun run build }]",
  "  deploy:",
  "    needs: build",
  "    if: github.ref == 'refs/heads/main'",
  "    steps: [{ run: bash .github/scripts/deploy-coolify.sh }]",
  "  after:",
  "    needs: deploy",
  "    steps: [{ uses: cloudflare/wrangler-action@0000000000000000000000000000000000000000 }]",
  "  report:",
  "    needs: deploy",
  "    if: failure()",
  "    steps: [{ run: gh issue create }]",
  "  always:",
  "    needs: deploy",
  "    if: ${{ !failure() && !cancelled() }}",
  "    steps: [{ run: echo done }]",
].join("\n");

describe("jobsRunningOnRef", () => {
  test("skips a job pinned to main, and every job that needs it, on a feature branch", () => {
    expect(jobsRunningOnRef(workflowFrom(GUARDED_DEPLOY), FEATURE_REF)).toEqual([
      "build",
      "always",
    ]);
  });

  test("runs the pinned job and its dependents on main, never a failure-only job", () => {
    expect(jobsRunningOnRef(workflowFrom(GUARDED_DEPLOY), MAIN_REF)).toEqual([
      "build",
      "deploy",
      "after",
      "always",
    ]);
  });

  test("ignores a ref pin inside an expression that also uses ||", () => {
    const workflow = workflowFrom(
      [
        "jobs:",
        "  either:",
        "    if: github.ref == 'refs/heads/main' || github.event_name == 'schedule'",
        "    steps: []",
      ].join("\n"),
    );
    expect(jobsRunningOnRef(workflow, FEATURE_REF)).toEqual(["either"]);
  });

  test("runs a job whose needs are a single string or a list", () => {
    const workflow = workflowFrom(
      [
        "jobs:",
        "  first: { steps: [] }",
        "  second: { needs: first, steps: [] }",
        "  third: { needs: [first, second], steps: [] }",
      ].join("\n"),
    );
    expect(jobsRunningOnRef(workflow, FEATURE_REF)).toEqual(["first", "second", "third"]);
  });
});

describe("deployJobsRunningOnRef", () => {
  test("lists the jobs that deploy through Coolify or Wrangler on that ref", () => {
    const workflow = workflowFrom(GUARDED_DEPLOY);
    expect(deployJobsRunningOnRef(workflow, MAIN_REF)).toEqual(["deploy", "after"]);
    expect(deployJobsRunningOnRef(workflow, FEATURE_REF)).toEqual([]);
  });

  test("flags an unguarded deploy job on a feature branch", () => {
    const workflow = workflowFrom(
      ["jobs:", "  deploy:", "    steps: [{ run: bash .github/scripts/deploy-coolify.sh }]"].join(
        "\n",
      ),
    );
    expect(deployJobsRunningOnRef(workflow, FEATURE_REF)).toEqual(["deploy"]);
  });

  test("sync-assets dispatched from a feature branch skips every deploy job", () => {
    const workflow = readWorkflow("sync-assets.yml");
    expect(deployJobsRunningOnRef(workflow, MAIN_REF)).toEqual(["sync"]);
    expect(deployJobsRunningOnRef(workflow, FEATURE_REF)).toEqual([]);
  });

  test("deploy-site dispatched from a feature branch skips the deploy job", () => {
    const workflow = readWorkflow("deploy-site.yml");
    expect(deployJobsRunningOnRef(workflow, MAIN_REF)).toEqual(["deploy"]);
    expect(deployJobsRunningOnRef(workflow, FEATURE_REF)).toEqual([]);
  });
});

describe("jobsOffRunnerExpression", () => {
  test("flags a literal ubuntu-latest and a missing runs-on", () => {
    const workflow = workflowFrom(
      ["jobs:", "  literal:", "    runs-on: ubuntu-latest", "  missing: {}"].join("\n"),
    );
    expect(jobsOffRunnerExpression(workflow)).toEqual(["literal", "missing"]);
  });

  test("accepts the runner expression, even when YAML folds it over two lines", () => {
    const workflow = workflowFrom(
      [
        "jobs:",
        "  routed:",
        "    runs-on: ${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' ||",
        "      vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}",
      ].join("\n"),
    );
    expect(jobsOffRunnerExpression(workflow)).toEqual([]);
    expect(ROUTED_RUNS_ON).toContain("vars.BLACKSMITH_RUNNER");
  });

  test.each([
    "codeql.yml",
    "scorecard.yml",
    "release.yml",
    "sync-assets.yml",
    "deploy-site.yml",
    "labels.yml",
    "lint-workflows.yml",
  ])("every job in %s uses the runner expression", (fileName) => {
    expect(jobsOffRunnerExpression(readWorkflow(fileName))).toEqual([]);
  });
});

describe("jobsRunningOnPrivateRepositories", () => {
  test("flags a job without the private-repository skip", () => {
    const workflow = workflowFrom(
      [
        "jobs:",
        "  skipped:",
        "    if: ${{ !github.event.repository.private }}",
        "  plain: {}",
        "  other:",
        "    if: github.ref == 'refs/heads/main'",
      ].join("\n"),
    );
    expect(jobsRunningOnPrivateRepositories(workflow)).toEqual(["plain", "other"]);
  });

  test.each(["codeql.yml", "scorecard.yml"])("%s skips private repositories", (fileName) => {
    expect(jobsRunningOnPrivateRepositories(readWorkflow(fileName))).toEqual([]);
  });
});

describe("codeqlInitsWithoutBuildModeNone", () => {
  test("flags an init step with no build mode or another one", () => {
    const workflow = workflowFrom(
      [
        "jobs:",
        "  analyze:",
        "    steps:",
        "      - uses: github/codeql-action/init@abc",
        "      - uses: github/codeql-action/init@abc",
        "        with: { build-mode: autobuild }",
        "      - uses: github/codeql-action/init@abc",
        "        with: { build-mode: none }",
        "      - uses: github/codeql-action/analyze@abc",
        "  empty: {}",
      ].join("\n"),
    );
    expect(codeqlInitsWithoutBuildModeNone(workflow)).toEqual(["analyze", "analyze"]);
  });

  test("codeql.yml initializes with build-mode none and keeps the required job name", () => {
    const workflow = readWorkflow("codeql.yml");
    expect(codeqlInitsWithoutBuildModeNone(workflow)).toEqual([]);
    expect(workflow.jobs?.analyze?.name).toBe("Analyze (${{ matrix.language }})");
  });
});

describe("triggerNames and pushBranches", () => {
  test("read triggers written as a mapping, a list or a single name", () => {
    expect(triggerNames(workflowFrom("on:\n  push:\n  workflow_dispatch:\n"))).toEqual([
      "push",
      "workflow_dispatch",
    ]);
    expect(triggerNames(workflowFrom("on: [push, schedule]\n"))).toEqual(["push", "schedule"]);
    expect(triggerNames(workflowFrom("on: push\n"))).toEqual(["push"]);
    expect(triggerNames(workflowFrom("name: none\n"))).toEqual([]);
  });

  test("read push branches, or none when push has no branch filter", () => {
    expect(pushBranches(workflowFrom("on:\n  push:\n    branches: [main, develop]\n"))).toEqual([
      "main",
      "develop",
    ]);
    expect(pushBranches(workflowFrom("on:\n  push:\n"))).toEqual([]);
    expect(pushBranches(workflowFrom("on: push\n"))).toEqual([]);
  });

  test("codeql.yml can be started by hand", () => {
    expect(triggerNames(readWorkflow("codeql.yml"))).toContain("workflow_dispatch");
  });

  test("scorecard.yml runs on main pushes and branch protection changes", () => {
    const workflow = readWorkflow("scorecard.yml");
    expect(pushBranches(workflow)).toEqual(["main"]);
    expect(triggerNames(workflow)).toContain("branch_protection_rule");
  });

  test("lint-workflows.yml also runs on pushes to the trunk branches", () => {
    const workflow = readWorkflow("lint-workflows.yml");
    expect(pushBranches(workflow)).toEqual(["main", "develop"]);
    expect(triggerNames(workflow)).toContain("pull_request");
  });
});

describe("uploadsSarif", () => {
  test("finds an upload-sarif step", () => {
    const uploads = "jobs:\n  a:\n    steps: [{ uses: github/codeql-action/upload-sarif@abc }]\n";
    expect(uploadsSarif(workflowFrom(uploads))).toBe(true);
    expect(uploadsSarif(workflowFrom("jobs:\n  a:\n    steps: [{ run: echo }]\n"))).toBe(false);
    expect(uploadsSarif(workflowFrom("jobs:\n  a: {}\n"))).toBe(false);
  });

  test("scorecard.yml uploads its SARIF to code scanning", () => {
    expect(uploadsSarif(readWorkflow("scorecard.yml"))).toBe(true);
  });
});

describe("concurrencyGroup", () => {
  test("reads the group from a mapping or the string shorthand", () => {
    expect(concurrencyGroup(workflowFrom("concurrency:\n  group: release\n"))).toBe("release");
    expect(concurrencyGroup(workflowFrom("concurrency: release\n"))).toBe("release");
    expect(concurrencyGroup(workflowFrom("concurrency:\n  group: ' '\n"))).toBeUndefined();
    expect(
      concurrencyGroup(workflowFrom("concurrency:\n  cancel-in-progress: true\n")),
    ).toBeUndefined();
    expect(concurrencyGroup(workflowFrom("name: none\n"))).toBeUndefined();
  });

  test("release.yml declares a concurrency group and never cancels a release", () => {
    const workflow: RuleWorkflow = readWorkflow("release.yml");
    expect(concurrencyGroup(workflow)).toBeDefined();
    expect(workflow.concurrency).toMatchObject({ "cancel-in-progress": false });
  });
});

function verifyJob(runs: readonly string[]): RuleJob {
  return { steps: runs.map((run) => ({ run })) };
}

describe("checksChangelogBeforeBuild", () => {
  test("accepts a CHANGELOG.md check before bun run build", () => {
    expect(checksChangelogBeforeBuild(verifyJob(["grep x CHANGELOG.md", "bun run build"]))).toBe(
      true,
    );
  });

  test("rejects a CHANGELOG.md check after the build, or a missing one", () => {
    expect(checksChangelogBeforeBuild(verifyJob(["bun run build", "grep x CHANGELOG.md"]))).toBe(
      false,
    );
    expect(checksChangelogBeforeBuild(verifyJob(["bun run build"]))).toBe(false);
    expect(checksChangelogBeforeBuild(verifyJob(["grep x CHANGELOG.md"]))).toBe(false);
    expect(checksChangelogBeforeBuild({})).toBe(false);
  });

  test("release.yml checks the CHANGELOG section before the build", () => {
    expect(checksChangelogBeforeBuild(readWorkflow("release.yml").jobs?.verify ?? {})).toBe(true);
  });
});
