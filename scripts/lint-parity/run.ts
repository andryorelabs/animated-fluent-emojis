import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CORPUS } from "./corpus";
import { parseAccepted, parseEslintJson, parseOxlintJson, type Finding } from "./diff";
import {
  canonicalRuleIdFunction,
  checkExpectedFixtures,
  HELP,
  materializeFixtures,
  parseOptions,
  ruleIdsRequiringTypes,
  splitCandidateTargets,
  summarizeSection,
  toSectionReport,
  type Options,
  type RawSection,
} from "./harness";
import { renderMarkdown } from "./report";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PARITY_DIR = import.meta.dirname;
const CACHE_DIR = path.join(REPO_ROOT, ".cache", "lint-parity");
const BASELINE_CONFIG = "scripts/lint-parity/eslint.baseline.config.mjs";
const CANDIDATE_ESLINT_CONFIGS = ["eslint.astro.config.mjs", "eslint.config.mjs"];
const OXLINT_CONFIGS = [".oxlintrc.json", "oxlint.config.ts"];

function runProcess(
  command: string,
  arguments_: string[],
  environment: Record<string, string> = {},
): { stdout: string; status: number | null } {
  const result = spawnSync(command, arguments_, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 512,
    env: { ...process.env, ...environment },
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} was stopped by ${result.signal}`);
  return { stdout: result.stdout, status: result.status };
}

function runEslint(
  config: string,
  targets: string[],
  environment: Record<string, string> = {},
): Finding[] {
  const { stdout, status } = runProcess(
    "bunx",
    [
      "eslint",
      "--config",
      config,
      "--no-cache",
      "--no-warn-ignored",
      "--no-error-on-unmatched-pattern",
      "--format",
      "json",
      ...targets,
    ],
    environment,
  );
  if (status !== 0 && status !== 1) {
    throw new Error(`eslint exited with status ${String(status)}`);
  }
  return parseEslintJson(stdout, REPO_ROOT);
}

const firstExisting = (names: readonly string[]): string | undefined =>
  names.find((name) => existsSync(path.join(REPO_ROOT, name)));

function isCandidateAvailable(): boolean {
  return (
    existsSync(path.join(REPO_ROOT, "node_modules", ".bin", "oxlint")) &&
    firstExisting(OXLINT_CONFIGS) !== undefined
  );
}

function runOxlint(
  targets: string[],
  options: {
    isTypeAware: boolean;
    isIgnoreFileHonored: boolean;
    environment?: Record<string, string>;
  },
): Finding[] {
  const config = firstExisting(OXLINT_CONFIGS);
  if (config === undefined) throw new Error("No Oxlint config found");
  const { stdout, status } = runProcess(
    "bunx",
    [
      "oxlint",
      "--config",
      config,
      "--format",
      "json",
      ...(options.isTypeAware ? ["--type-aware"] : []),
      ...(options.isIgnoreFileHonored ? [] : ["--no-ignore"]),
      ...targets,
    ],
    options.environment,
  );
  if (status !== 0 && status !== 1) {
    throw new Error(`oxlint exited with status ${String(status)}`);
  }
  return parseOxlintJson(stdout, REPO_ROOT);
}

function runCandidate(
  targets: string[],
  options: {
    isTypeAware: boolean;
    isIgnoreFileHonored: boolean;
    isExplicitFiles: boolean;
    environment?: Record<string, string>;
  },
): Finding[] {
  const split = splitCandidateTargets(targets, options.isExplicitFiles);
  const config = firstExisting(CANDIDATE_ESLINT_CONFIGS);
  return [
    ...(split.oxlint.length > 0 ? runOxlint(split.oxlint, options) : []),
    ...(config !== undefined && split.astro.length > 0
      ? runEslint(config, split.astro, options.environment)
      : []),
  ];
}

function isCheckedOutAt(target: string, commit: string): boolean {
  const { stdout, status } = runProcess("git", ["-C", target, "rev-parse", "HEAD"]);
  return status === 0 && stdout.trim() === commit;
}

function ensureCorpus(directory: string): string[] {
  mkdirSync(directory, { recursive: true });
  return CORPUS.map((repository) => {
    const target = path.join(directory, repository.name);
    if (existsSync(target) && !isCheckedOutAt(target, repository.commit)) {
      rmSync(target, { recursive: true, force: true });
    }
    if (!existsSync(target)) {
      const steps = [
        ["init", target],
        ["-C", target, "fetch", "--depth", "1", repository.url, repository.commit],
        ["-C", target, "checkout", "--detach", "FETCH_HEAD"],
      ];
      for (const step of steps) {
        const { status } = runProcess("git", step);
        if (status !== 0) {
          rmSync(target, { recursive: true, force: true });
          throw new Error(`git ${step[0] ?? ""} failed: ${repository.url}`);
        }
      }
    }
    return path.relative(REPO_ROOT, path.join(target, repository.subdirectory));
  });
}

function runFixtures(options: Options): RawSection {
  const { files, cleanup } = materializeFixtures(
    path.join(PARITY_DIR, "fixtures", "tree"),
    REPO_ROOT,
  );
  const removeOnSignal = (signal: NodeJS.Signals) => {
    cleanup();
    process.kill(process.pid, signal);
  };
  process.once("SIGINT", removeOnSignal);
  try {
    const eslint = runEslint(BASELINE_CONFIG, files);
    const expected = JSON.parse(
      readFileSync(path.join(PARITY_DIR, "fixtures", "expected.json"), "utf8"),
    ) as Record<string, string[]>;
    return {
      name: "fixtures",
      eslint,
      candidate: isCandidateAvailable()
        ? runCandidate(files, {
            isTypeAware: options.isTypeAware,
            isIgnoreFileHonored: true,
            isExplicitFiles: true,
          })
        : undefined,
      problems: checkExpectedFixtures(expected, eslint, files),
      isTypeAware: options.isTypeAware,
    };
  } finally {
    process.off("SIGINT", removeOnSignal);
    cleanup();
  }
}

function runRepository(options: Options): RawSection {
  return {
    name: "repo",
    eslint: runEslint(BASELINE_CONFIG, ["."]),
    candidate: isCandidateAvailable()
      ? runCandidate(["."], {
          isTypeAware: options.isTypeAware,
          isIgnoreFileHonored: true,
          isExplicitFiles: false,
        })
      : undefined,
    problems: [],
    isTypeAware: options.isTypeAware,
  };
}

function runCorpus(options: Options): RawSection {
  const targets = ensureCorpus(options.corpusDirectory);
  const environment = { PARITY_CORPUS: "1" };
  return {
    name: "corpus",
    eslint: runEslint(BASELINE_CONFIG, targets, environment),
    candidate: isCandidateAvailable()
      ? runCandidate(targets, {
          isTypeAware: false,
          isIgnoreFileHonored: false,
          isExplicitFiles: false,
          environment,
        })
      : undefined,
    problems: [],
    isTypeAware: false,
  };
}

function main(): number {
  const options = parseOptions(process.argv.slice(2), {
    accepted: path.join(PARITY_DIR, "accepted.json"),
    corpusDirectory: path.join(CACHE_DIR, "corpus"),
    report: path.join(CACHE_DIR, "report.json"),
  });
  if (options === undefined) {
    console.info(HELP);
    return 0;
  }
  const accepted = existsSync(options.accepted)
    ? parseAccepted(readFileSync(options.accepted, "utf8"))
    : [];
  const typedRules = ruleIdsRequiringTypes();
  const canonicalRuleId = canonicalRuleIdFunction();
  const runners = {
    fixtures: runFixtures,
    repo: runRepository,
    corpus: runCorpus,
  } satisfies Record<string, (options: Options) => RawSection>;
  const selected: (keyof typeof runners)[] =
    options.mode === "all" ? ["fixtures", "repo", "corpus"] : [options.mode];
  const sections = selected.map((name) =>
    toSectionReport(runners[name](options), accepted, typedRules, canonicalRuleId),
  );
  for (const section of sections) {
    console.info(`\n${summarizeSection(section).join("\n")}`);
  }
  mkdirSync(path.dirname(options.report), { recursive: true });
  writeFileSync(options.report, JSON.stringify(sections, undefined, 2));
  const markdownPath = `${options.report.replace(/\.json$/, "")}.md`;
  writeFileSync(markdownPath, renderMarkdown(sections));
  console.info(
    `\nReport written to ${path.relative(REPO_ROOT, options.report)} and ${path.relative(REPO_ROOT, markdownPath)}`,
  );
  return sections.some((section) => section.exitCode === 1) ? 1 : 0;
}

process.exitCode = main();
