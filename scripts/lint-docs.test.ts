import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildLycheeCacheRelativePath,
  buildLycheeDownloadUrl,
  ensureLycheeBinary,
  EXPECTED_LYCHEE_ACTION_VERSION,
  LYCHEE_ARGS,
  LYCHEE_VERSION,
  resolveLycheeArch,
  runDocumentationLint,
  type LycheeBinaryDependencies,
} from "./lint-docs";
import { readWorkflow, readWorkflowText } from "./workflow-files";

const WORKFLOW_FILE = "lint-docs.yml";
const LYCHEE_ACTION_PREFIX = "lycheeverse/lychee-action@";

function findLycheeArguments(): string {
  const jobs = Object.values(readWorkflow(WORKFLOW_FILE).jobs ?? {});
  const steps = jobs.flatMap((job) => job.steps ?? []);
  const lycheeStep = steps.find((step) => step.uses?.startsWith(LYCHEE_ACTION_PREFIX));
  const lycheeArguments = lycheeStep?.with?.args;
  if (typeof lycheeArguments !== "string") {
    throw new TypeError(`No lychee-action step with string args in ${WORKFLOW_FILE}.`);
  }
  return lycheeArguments;
}

function tokenizeShellLikeArguments(input: string): string[] {
  return Array.from(input.matchAll(/'([^']*)'|(\S+)/g), (match) => match[1] ?? match[2] ?? "");
}

describe("LYCHEE_ARGS parity with the lint-docs workflow", () => {
  test("the script args match the lychee-action args", () => {
    expect(tokenizeShellLikeArguments(findLycheeArguments())).toEqual([...LYCHEE_ARGS]);
  });

  test("the workflow still pins the action version LYCHEE_VERSION assumes", () => {
    const match = new RegExp(String.raw`uses:\s*${LYCHEE_ACTION_PREFIX}\S+\s*#\s*(v[\d.]+)`).exec(
      readWorkflowText(WORKFLOW_FILE),
    );
    expect(match?.[1]).toBe(EXPECTED_LYCHEE_ACTION_VERSION);
  });
});

describe("resolveLycheeArch", () => {
  test("maps arm64 and x64 on linux", () => {
    expect(resolveLycheeArch("arm64", "linux")).toBe("aarch64");
    expect(resolveLycheeArch("x64", "linux")).toBe("x86_64");
  });

  test("throws for an unsupported architecture", () => {
    expect(() => resolveLycheeArch("ia32", "linux")).toThrow(/unsupported architecture/);
  });

  test("throws for a non-linux platform", () => {
    expect(() => resolveLycheeArch("x64", "darwin")).toThrow(/unsupported platform/);
  });
});

describe("lychee paths", () => {
  test("builds the release asset URL", () => {
    expect(buildLycheeDownloadUrl(LYCHEE_VERSION, "x86_64")).toBe(
      `https://github.com/lycheeverse/lychee/releases/download/lychee-${LYCHEE_VERSION}/lychee-x86_64-unknown-linux-gnu.tar.gz`,
    );
  });

  test("nests the cached binary under lychee/<version>/lychee", () => {
    expect(buildLycheeCacheRelativePath("v0.24.2")).toBe("lychee/v0.24.2/lychee");
  });
});

function createArchive(directory: string, files: Record<string, string>): Buffer {
  const source = path.join(directory, "source");
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(source, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  const archivePath = path.join(directory, "fixture.tar.gz");
  const tar = spawnSync("tar", ["-czf", archivePath, "-C", source, "."]);
  if (tar.status !== 0) throw new Error(tar.stderr.toString());
  return readFileSync(archivePath);
}

describe("ensureLycheeBinary", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "lint-docs-test-"));
    vi.spyOn(console, "log").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  function createDependencies(
    fetchArchive: LycheeBinaryDependencies["fetchArchive"],
    overrides: Partial<LycheeBinaryDependencies> = {},
  ): LycheeBinaryDependencies {
    return {
      resolveCacheRoot: () => path.join(root, "cache"),
      fetchArchive,
      arch: "x64",
      platform: "linux",
      ...overrides,
    };
  }

  test("reuses a cached binary without fetching", async () => {
    const binaryPath = path.join(root, "cache", "lychee", "v1", "lychee");
    mkdirSync(path.dirname(binaryPath), { recursive: true });
    writeFileSync(binaryPath, "cached");
    const fetchArchive = vi.fn();
    await expect(ensureLycheeBinary("v1", createDependencies(fetchArchive))).resolves.toBe(
      binaryPath,
    );
    expect(fetchArchive).not.toHaveBeenCalled();
  });

  test("downloads, extracts and caches an executable binary", async () => {
    const archive = createArchive(root, { "nested/lychee": "binary" });
    const fetchArchive = vi.fn().mockResolvedValue(new Response(archive));
    const binaryPath = await ensureLycheeBinary("v1", createDependencies(fetchArchive));
    expect(fetchArchive).toHaveBeenCalledWith(buildLycheeDownloadUrl("v1", "x86_64"));
    expect(binaryPath).toBe(path.join(root, "cache", "lychee", "v1", "lychee"));
    expect(existsSync(binaryPath)).toBe(true);
    expect(statSync(binaryPath).mode & 0o111).not.toBe(0);
  });

  test("releases the download lock after fetching", async () => {
    const archive = createArchive(root, { lychee: "binary" });
    const fetchArchive = vi.fn().mockResolvedValue(new Response(archive));
    await ensureLycheeBinary("v1", createDependencies(fetchArchive));
    expect(existsSync(path.join(root, "cache", "lychee-v1.lock"))).toBe(false);
  });

  test("releases the download lock when the download fails", async () => {
    const fetchArchive = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(ensureLycheeBinary("v1", createDependencies(fetchArchive))).rejects.toThrow(
      /HTTP 500/,
    );
    expect(existsSync(path.join(root, "cache", "lychee-v1.lock"))).toBe(false);
  });

  test("throws on an HTTP error", async () => {
    const fetchArchive = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    await expect(ensureLycheeBinary("v1", createDependencies(fetchArchive))).rejects.toThrow(
      /HTTP 404/,
    );
  });

  test("throws when the archive has no lychee binary", async () => {
    const archive = createArchive(root, { "readme.txt": "hello" });
    const fetchArchive = vi.fn().mockResolvedValue(new Response(archive));
    await expect(ensureLycheeBinary("v1", createDependencies(fetchArchive))).rejects.toThrow(
      /no "lychee" binary found/,
    );
  });

  test("throws when the payload is not a tar archive", async () => {
    const fetchArchive = vi.fn().mockResolvedValue(new Response("not a tarball"));
    await expect(ensureLycheeBinary("v1", createDependencies(fetchArchive))).rejects.toThrow(
      /failed to extract/,
    );
  });

  test("throws for an unsupported architecture before fetching", async () => {
    const fetchArchive = vi.fn();
    await expect(
      ensureLycheeBinary("v1", createDependencies(fetchArchive, { arch: "ia32" })),
    ).rejects.toThrow(/unsupported architecture/);
    expect(fetchArchive).not.toHaveBeenCalled();
  });
});

describe("runDocumentationLint", () => {
  test("runs lychee with the shared args plus the extra ones", async () => {
    const ensureBinary = vi.fn().mockResolvedValue("/bin/lychee");
    const spawnBinary = vi.fn().mockResolvedValue(2);
    await expect(runDocumentationLint(["--verbose"], ensureBinary, spawnBinary)).resolves.toBe(2);
    expect(ensureBinary).toHaveBeenCalledWith(LYCHEE_VERSION);
    expect(spawnBinary).toHaveBeenCalledWith("/bin/lychee", [...LYCHEE_ARGS, "--verbose"]);
  });
});
