import { describe, expect, test } from "vitest";

import { formatDifference, runRepositorySettingsCheck } from "./check.ts";
import { readExpectedSettings, type JsonObject } from "./settings.ts";

const REPOSITORY_ENDPOINT = "repos/andryorelabs/animated-fluent-emojis";

const EXPECTED = readExpectedSettings();

const MATCHING_REPOSITORY: JsonObject = {
  allow_squash_merge: true,
  allow_merge_commit: true,
  allow_rebase_merge: false,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
  merge_commit_title: "PR_TITLE",
  merge_commit_message: "PR_BODY",
  delete_branch_on_merge: true,
  allow_auto_merge: true,
  allow_update_branch: true,
  has_wiki: false,
  has_projects: false,
  has_discussions: false,
  homepage: "https://animated-fluent-emojis.andryore.dev",
  description:
    "Fluent emojis, but they move: Microsoft's animated emojis as one component. Not affiliated with or endorsed by Microsoft.",
  topics: [
    "typescript",
    "react",
    "fluent-emojis",
    "fluent-emoji",
    "emojis",
    "emoji",
    "animation",
    "animated-emojis",
  ],
  default_branch: "main",
  security_and_analysis: {
    secret_scanning: { status: "enabled" },
    secret_scanning_push_protection: { status: "enabled" },
    dependabot_security_updates: { status: "enabled" },
  },
};

const ALERTS_OFF = new Error(
  "Command failed: gh api --method GET repos/andryorelabs/animated-fluent-emojis/vulnerability-alerts\ngh: Vulnerability alerts are disabled. (HTTP 404)",
);

function createResponses(
  repository: JsonObject,
  rulesets: Readonly<Record<string, JsonObject>>,
): Record<string, unknown> {
  const names = Object.keys(rulesets);
  const responses: Record<string, unknown> = {
    [REPOSITORY_ENDPOINT]: repository,
    [`${REPOSITORY_ENDPOINT}/vulnerability-alerts`]: "",
    [`${REPOSITORY_ENDPOINT}/private-vulnerability-reporting`]: {
      enabled: true,
    },
    [`${REPOSITORY_ENDPOINT}/actions/permissions/workflow`]: {
      default_workflow_permissions: "read",
      can_approve_pull_request_reviews: false,
    },
    [`${REPOSITORY_ENDPOINT}/actions/permissions/fork-pr-contributor-approval`]: {
      approval_policy: "all_external_contributors",
    },
    [`${REPOSITORY_ENDPOINT}/code-scanning/default-setup`]: {
      state: "not-configured",
    },
    [`${REPOSITORY_ENDPOINT}/rulesets`]: names.map((name, index) => ({
      id: index + 1,
      name,
    })),
  };
  for (const [index, name] of names.entries()) {
    responses[`${REPOSITORY_ENDPOINT}/rulesets/${String(index + 1)}`] = {
      id: index + 1,
      node_id: `RRS_${String(index)}`,
      ...rulesets[name],
    };
  }
  return responses;
}

async function runWith(
  responses: Readonly<Record<string, unknown>>,
): Promise<{ readonly exitCode: number; readonly lines: string[] }> {
  const lines: string[] = [];
  const exitCode = await runRepositorySettingsCheck({
    expected: EXPECTED,
    report: (line) => {
      lines.push(line);
    },
    run: (commandArguments) => {
      const response = responses[commandArguments.at(-1) ?? ""];
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve(response === "" ? "" : JSON.stringify(response));
    },
  });
  return { exitCode, lines };
}

describe("runRepositorySettingsCheck", () => {
  test("exits 0 when the live settings match the files", async () => {
    const result = await runWith(createResponses(MATCHING_REPOSITORY, EXPECTED.rulesets));

    expect(result).toEqual({
      exitCode: 0,
      lines: ["repo-settings: live settings match the files."],
    });
  });

  test("lists each difference and exits 1 when live differs", async () => {
    const { main, ...withoutMain } = EXPECTED.rulesets;
    const result = await runWith(
      createResponses(
        { ...MATCHING_REPOSITORY, has_wiki: true, homepage: "" },
        { ...withoutMain, main: { ...main, enforcement: "disabled" } },
      ),
    );

    expect(result).toEqual({
      exitCode: 1,
      lines: [
        'repo-settings: settings.repository.homepage: expected "https://animated-fluent-emojis.andryore.dev", live ""',
        "repo-settings: settings.repository.has_wiki: expected false, live true",
        'repo-settings: rulesets.main.enforcement: expected "active", live "disabled"',
        "repo-settings: 3 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
      ],
    });
  });

  test("exits 1 and names the setting when merge commits are off", async () => {
    const result = await runWith(
      createResponses({ ...MATCHING_REPOSITORY, allow_merge_commit: false }, EXPECTED.rulesets),
    );

    expect(result).toEqual({
      exitCode: 1,
      lines: [
        "repo-settings: settings.repository.allow_merge_commit: expected true, live false",
        "repo-settings: 1 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
      ],
    });
  });

  test("exits 1 and names Dependabot alerts when they are off", async () => {
    const result = await runWith({
      ...createResponses(MATCHING_REPOSITORY, EXPECTED.rulesets),
      [`${REPOSITORY_ENDPOINT}/vulnerability-alerts`]: ALERTS_OFF,
    });

    expect(result).toEqual({
      exitCode: 1,
      lines: [
        "repo-settings: settings.security.dependabot_alerts: expected true, live false",
        "repo-settings: 1 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
      ],
    });
  });

  test("exits 1 and names Dependabot security updates when they are off", async () => {
    const result = await runWith(
      createResponses(
        {
          ...MATCHING_REPOSITORY,
          security_and_analysis: {
            secret_scanning: { status: "enabled" },
            secret_scanning_push_protection: { status: "enabled" },
            dependabot_security_updates: { status: "disabled" },
          },
        },
        EXPECTED.rulesets,
      ),
    );

    expect(result).toEqual({
      exitCode: 1,
      lines: [
        "repo-settings: settings.security.dependabot_security_updates: expected true, live false",
        "repo-settings: 1 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
      ],
    });
  });

  test("exits 1 and names each drifted Actions, CodeQL and metadata setting", async () => {
    const result = await runWith({
      ...createResponses(
        {
          ...MATCHING_REPOSITORY,
          default_branch: "develop",
          topics: ["react"],
        },
        EXPECTED.rulesets,
      ),
      [`${REPOSITORY_ENDPOINT}/actions/permissions/workflow`]: {
        default_workflow_permissions: "write",
        can_approve_pull_request_reviews: false,
      },
      [`${REPOSITORY_ENDPOINT}/actions/permissions/fork-pr-contributor-approval`]: {
        approval_policy: "first_time_contributors",
      },
      [`${REPOSITORY_ENDPOINT}/code-scanning/default-setup`]: {
        state: "configured",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.lines.map((line) => line.split(":", 2)[1]?.trim())).toEqual([
      "settings.repository.topics",
      "settings.repository.default_branch",
      "settings.actions.default_workflow_permissions",
      "settings.actions.fork_pr_contributor_approval",
      "settings.code_scanning.default_setup",
      "5 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
    ]);
  });

  test("exits 1 and names a ruleset file that has no live ruleset", async () => {
    const { develop, ...withoutDevelop } = EXPECTED.rulesets;
    const result = await runWith(createResponses(MATCHING_REPOSITORY, withoutDevelop));

    expect(develop).toBeDefined();
    expect(result.exitCode).toBe(1);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatch(
      /^repo-settings: rulesets\.develop: expected \{.*\}, live absent$/,
    );
  });

  test("exits 1 and names a live ruleset that has no file", async () => {
    const legacy: JsonObject = {
      name: "legacy",
      target: "branch",
      enforcement: "active",
    };
    const result = await runWith(
      createResponses(MATCHING_REPOSITORY, { ...EXPECTED.rulesets, legacy }),
    );

    expect(result).toEqual({
      exitCode: 1,
      lines: [
        'repo-settings: rulesets.legacy: expected absent, live {"name":"legacy","target":"branch","enforcement":"active"}',
        "repo-settings: 1 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
      ],
    });
  });
});

describe("formatDifference", () => {
  test("marks a side that has no value as absent", () => {
    expect(
      formatDifference({
        path: "rulesets.legacy",
        expected: undefined,
        live: { name: "legacy" },
      }),
    ).toBe('rulesets.legacy: expected absent, live {"name":"legacy"}');
  });
});
