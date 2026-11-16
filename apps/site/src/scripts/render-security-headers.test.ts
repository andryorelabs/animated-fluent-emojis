import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT = "run()";
const HASH = `'sha256-${createHash("sha256").update(SCRIPT).digest("base64")}'`;
const META = `<meta http-equiv="content-security-policy" content="script-src 'self' ${HASH}">`;

const workDirectory = mkdtempSync(path.join(tmpdir(), "render-headers-"));
const originalArgv = process.argv;

async function runScript(...cliArguments: string[]): Promise<void> {
  process.argv = [...originalArgv.slice(0, 2), ...cliArguments];
  vi.resetModules();
  await import("./render-security-headers");
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(vi.fn());
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

afterAll(() => {
  rmSync(workDirectory, { recursive: true, force: true });
});

describe("render-security-headers", () => {
  it("rejects missing arguments", async () => {
    await expect(runScript()).rejects.toThrow("Usage: render-security-headers");
  });

  it("renders the snippet and strips the meta tag from every page", async () => {
    const distribution = path.join(workDirectory, "dist");
    mkdirSync(path.join(distribution, "nested"), { recursive: true });
    const page = `<html><head>${META}</head><body><script>${SCRIPT}</script></body></html>`;
    writeFileSync(path.join(distribution, "index.html"), page);
    writeFileSync(path.join(distribution, "nested", "page.html"), page);
    writeFileSync(path.join(distribution, "skip.txt"), "ignored");
    const template = path.join(workDirectory, "template.conf");
    const output = path.join(workDirectory, "out.conf");
    writeFileSync(template, "script-src __SCRIPT_HASHES__;");

    await runScript(distribution, template, output);

    expect(readFileSync(output, "utf8")).toBe(`script-src ${HASH};`);
    expect(readFileSync(path.join(distribution, "nested", "page.html"), "utf8")).not.toContain(
      "content-security-policy",
    );
    expect(console.log).toHaveBeenCalledWith("CSP: header rendered from 2 pages");
  });
});
