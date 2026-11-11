import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { readWorkflow } from "./workflow-files";

const DEPLOY_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.github/scripts/deploy-coolify.sh",
);

function runDeployScript(environment: Record<string, string>) {
  return spawnSync("bash", [DEPLOY_SCRIPT], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...environment },
  });
}

describe("deploy-coolify.sh", () => {
  test("fails fast naming both inputs when none is set", () => {
    const result = runDeployScript({});
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("COOLIFY_API_TOKEN");
    expect(result.stdout).toContain("SITE_COOLIFY_APP_UUID");
  });

  test("names only the missing secret", () => {
    const result = runDeployScript({ SITE_COOLIFY_APP_UUID: "uuid" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("COOLIFY_API_TOKEN");
    expect(result.stdout).not.toContain("SITE_COOLIFY_APP_UUID");
  });

  test("names only the missing variable", () => {
    const result = runDeployScript({ COOLIFY_API_TOKEN: "token" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("SITE_COOLIFY_APP_UUID");
    expect(result.stdout).not.toContain("COOLIFY_API_TOKEN");
  });
});

describe("deploy-coolify.sh last-modified dates", () => {
  const credentials = {
    COOLIFY_API_TOKEN: "token",
    SITE_COOLIFY_APP_UUID: "app-uuid",
  };

  test("rejects dates that are not a non-empty JSON object", () => {
    for (const dates of ["not json", "[]", "{}"]) {
      const result = runDeployScript({
        ...credentials,
        LAST_MODIFIED_DATES: dates,
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("LAST_MODIFIED_DATES");
    }
  });

  test("publishes the dates as a build variable before triggering the deploy", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "deploy-coolify-"));
    try {
      const log = path.join(directory, "curl.log");
      const curlStub = path.join(directory, "curl");
      writeFileSync(
        curlStub,
        String.raw`#!/usr/bin/env bash
printf '%s\n' "$*" >>"${log}"
case "$*" in
  *envs/bulk*) echo '{}' ;;
  *"/deploy?"*) echo '{"deployments":[{"deployment_uuid":"d1"}]}' ;;
  *) echo '{"status":"finished"}' ;;
esac
`,
      );
      chmodSync(curlStub, 0o755);
      const result = spawnSync("bash", [DEPLOY_SCRIPT], {
        encoding: "utf8",
        env: {
          PATH: `${directory}:${process.env.PATH ?? ""}`,
          ...credentials,
          LAST_MODIFIED_DATES: '{"src/home":"2026-10-19"}',
        },
      });
      expect(result.status).toBe(0);
      const calls = readFileSync(log, "utf8").split("\n");
      const patch = calls.findIndex((call) => call.includes("--request PATCH"));
      const trigger = calls.findIndex((call) => call.includes("/deploy?"));
      expect(patch).toBeGreaterThan(-1);
      expect(trigger).toBeGreaterThan(patch);
      expect(calls[patch]).toContain("applications/app-uuid/envs/bulk");
      expect(calls[patch]).toContain("LAST_MODIFIED_DATES");
      expect(calls[patch]).toContain('"is_buildtime":true');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("skips the build variable update when no dates are provided", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "deploy-coolify-"));
    try {
      const log = path.join(directory, "curl.log");
      const curlStub = path.join(directory, "curl");
      writeFileSync(
        curlStub,
        String.raw`#!/usr/bin/env bash
printf '%s\n' "$*" >>"${log}"
case "$*" in
  *"/deploy?"*) echo '{"deployments":[{"deployment_uuid":"d1"}]}' ;;
  *) echo '{"status":"finished"}' ;;
esac
`,
      );
      chmodSync(curlStub, 0o755);
      const result = spawnSync("bash", [DEPLOY_SCRIPT], {
        encoding: "utf8",
        env: { PATH: `${directory}:${process.env.PATH ?? ""}`, ...credentials },
      });
      expect(result.status).toBe(0);
      expect(readFileSync(log, "utf8")).not.toContain("PATCH");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("deploy-site.yml", () => {
  const workflow = readWorkflow("deploy-site.yml");
  const job = workflow.jobs?.deploy;
  const steps = job?.steps ?? [];

  test("runs on pushes to main that touch the site, docs or library", () => {
    const raw = JSON.stringify(workflow.on);
    expect(raw).toContain('"branches":["main"]');
    for (const path of ["apps/site/**", "docs/**", "packages/animated-fluent-emojis/**"])
      expect(raw).toContain(`"${path}"`);
  });

  test("can be started by hand", () => {
    expect(workflow.on).toHaveProperty("workflow_dispatch");
  });

  test("checks out the full history and passes the dates to the build and the deploy", () => {
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout"));
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    const names = steps.map((step) => step.name);
    expect(names.indexOf("Compute last-modified dates")).toBeLessThan(
      names.indexOf("Build container"),
    );
    const dates = "${{ steps.dates.outputs.map }}";
    const build = steps.find((step) => step.name === "Build container");
    expect(build?.env?.LAST_MODIFIED_DATES).toBe(dates);
    expect(steps.at(-1)?.env?.LAST_MODIFIED_DATES).toBe(dates);
  });

  test("is serialized and never cancels a running deploy", () => {
    expect(JSON.stringify(workflow)).toContain('"cancel-in-progress":false');
  });

  test("builds the image before triggering the deploy", () => {
    const names = steps.map((step) => step.name);
    const build = names.indexOf("Build container");
    const deploy = names.indexOf("Trigger Coolify deploy and wait for the result");
    expect(build).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(build);
  });

  test("passes the token and uuid through env, not the script", () => {
    const deploy = steps.at(-1);
    expect(deploy?.env?.COOLIFY_API_TOKEN).toBe("${{ secrets.COOLIFY_API_TOKEN }}");
    expect(deploy?.env?.SITE_COOLIFY_APP_UUID).toBe("${{ vars.SITE_COOLIFY_APP_UUID }}");
    expect(deploy?.run).not.toContain("${{");
  });
});

describe("sync-assets.yml website redeploy", () => {
  const steps = readWorkflow("sync-assets.yml").jobs?.sync?.steps ?? [];
  const names = steps.map((step) => step.name);
  const redeploy = steps.find((step) => step.name === "Redeploy the website");

  test("runs after the files site smoke test, only when assets changed, and never fails the sync", () => {
    expect(names.indexOf("Redeploy the website")).toBeGreaterThan(
      names.indexOf("Smoke test the files site"),
    );
    expect(redeploy?.if).toBe("steps.detect.outputs.changed == 'true' && success()");
    expect(redeploy?.["continue-on-error"]).toBe(true);
  });

  test("uses the shared deploy script with the same secret and variable", () => {
    expect(redeploy?.run).toContain(".github/scripts/deploy-coolify.sh");
    expect(redeploy?.env?.COOLIFY_API_TOKEN).toBe("${{ secrets.COOLIFY_API_TOKEN }}");
    expect(redeploy?.env?.SITE_COOLIFY_APP_UUID).toBe("${{ vars.SITE_COOLIFY_APP_UUID }}");
  });
});
