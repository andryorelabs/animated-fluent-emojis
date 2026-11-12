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
  security_and_analysis: {
    secret_scanning: { status: "enabled" },
    secret_scanning_push_protection: { status: "enabled" },
    dependabot_security_updates: { status: "enabled" },
  },
};

function createResponses(
  repository: JsonObject,
  rulesets: Readonly<Record<string, JsonObject>>,
): Record<string, unknown> {
  const names = Object.keys(rulesets);
  const responses: Record<string, unknown> = {
    [REPOSITORY_ENDPOINT]: repository,
    [`${REPOSITORY_ENDPOINT}/private-vulnerability-reporting`]: {
      enabled: true,
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
    run: (commandArguments) =>
      Promise.resolve(JSON.stringify(responses[commandArguments.at(-1) ?? ""])),
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
        "repo-settings: settings.has_wiki: expected false, live true",
        'repo-settings: settings.homepage: expected "https://animated-fluent-emojis.andryore.dev", live ""',
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
        "repo-settings: settings.allow_merge_commit: expected true, live false",
        "repo-settings: 1 difference(s). Re-apply from the files, see docs/brand/apply-spec.md.",
      ],
    });
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
