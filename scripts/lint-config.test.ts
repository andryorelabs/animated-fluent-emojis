import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

import {
  shadcnAllowedInlineProperties,
  shadcnAllowedUnknownClasses,
  shadcnNoRestyleContracts,
} from "../lint-policy.mjs";
import oxlintConfig from "../oxlint.config";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

type RuleEntry = unknown;
type RuleMap = Record<string, RuleEntry>;

interface OxlintOverride {
  readonly files: readonly string[];
  readonly rules?: RuleMap;
}

interface FlatConfigBlock {
  readonly files?: readonly (string | readonly string[])[];
  readonly ignores?: readonly string[];
  readonly rules?: RuleMap;
}

const rootRules: RuleMap = oxlintConfig.rules;
const overrides: readonly OxlintOverride[] = oxlintConfig.overrides;

function overrideIndex(files: readonly string[]): number {
  const index = overrides.findIndex(
    (override) => JSON.stringify(override.files) === JSON.stringify(files),
  );
  if (index === -1) throw new Error(`no override for ${files.join(", ")}`);
  return index;
}

function overrideRules(files: readonly string[]): RuleMap {
  return overrides[overrideIndex(files)]?.rules ?? {};
}

const siteShadcnRules = {
  "shadcn/no-restyle": ["error", { allow: ["layout"], contracts: shadcnNoRestyleContracts }],
  "shadcn/no-raw-colors": "error",
  "shadcn/no-arbitrary-values": "error",
  "shadcn/no-inline-styles": ["error", { allow: shadcnAllowedInlineProperties }],
  "shadcn/no-unknown-classes": ["error", { allow: shadcnAllowedUnknownClasses }],
  "shadcn/require-static-classes": "error",
};

const uiExemptions = {
  "shadcn/no-restyle": "off",
  "shadcn/no-arbitrary-values": "off",
  "shadcn/require-static-classes": "off",
};

const nameReplacementsAllowList = {
  props: true,
  Props: true,
  ref: true,
  Ref: true,
  acc: true,
  doc: true,
  docs: true,
};

const filenameCaseOptions = { cases: { kebabCase: true, pascalCase: true } };

describe("oxlint.config.ts", () => {
  test("loads in the oxlint binary", () => {
    const printed = JSON.parse(
      execFileSync(path.join(ROOT, "node_modules/.bin/oxlint"), ["--print-config"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    ) as { jsPlugins: readonly { name: string }[] };
    expect(printed.jsPlugins.map((plugin) => plugin.name)).toContain("typed-react");
  }, 60_000);

  test("keeps the shadcn contracts on the site", () => {
    expect(overrideRules(["apps/site/**/*.{ts,tsx}"])).toStrictEqual(siteShadcnRules);
  });

  test("keeps the shared shadcn contract and allow-lists", () => {
    expect(shadcnNoRestyleContracts).toStrictEqual([
      {
        pattern: "^TooltipTrigger$",
        allow: [
          "layout",
          "rounded-10",
          "border",
          "border-transparent",
          "p-1",
          "transition-bg-transform",
          "duration-100",
          "ease-(--ease-out-strong)",
          "hover:bg-muted",
          "active:bg-muted",
          "aria-pressed:border-primary",
        ],
      },
    ]);
    expect(shadcnAllowedInlineProperties).toStrictEqual(["--*"]);
    expect(shadcnAllowedUnknownClasses).toEqual(
      expect.arrayContaining(["sl-flex", "bento-*", "demo-code", "edit-link"]),
    );
  });

  test("exempts the shadcn/ui registry after the site rules", () => {
    const uiFiles = ["apps/site/src/components/ui/**"];
    expect(overrideRules(uiFiles)).toStrictEqual(uiExemptions);
    expect(overrideIndex(uiFiles)).toBeGreaterThan(overrideIndex(["apps/site/**/*.{ts,tsx}"]));
  });

  test("keeps the unicorn name and filename policies", () => {
    expect(rootRules["unicorn-js/name-replacements"]).toStrictEqual([
      "error",
      { allowList: nameReplacementsAllowList },
    ]);
    expect(rootRules["unicorn-js/filename-case"]).toStrictEqual(["error", filenameCaseOptions]);
  });

  test("runs the leaked-render rule through the typed-react shim", () => {
    expect(oxlintConfig.jsPlugins).toContainEqual({
      name: "typed-react",
      specifier: "./oxlint-plugins/typed-react.mjs",
    });
    const typeScriptRules = overrideRules(["**/*.{ts,tsx}"]);
    expect(typeScriptRules["@eslint-react/no-leaked-conditional-rendering"]).toBe("off");
    expect(typeScriptRules["typed-react/no-leaked-conditional-rendering"]).toBe("error");
  });

  test("keeps the vitest options", () => {
    const testRules = overrideRules(["**/*.test.{ts,tsx}"]);
    expect(testRules["vitest/valid-expect"]).toEqual([
      "error",
      expect.objectContaining({ maxArgs: 2 }),
    ]);
    expect(testRules["vitest/expect-expect"]).toEqual([
      "error",
      expect.objectContaining({
        assertFunctionNames: ["expect", "expectTypeOf"],
      }),
    ]);
  });

  test("lets config files register side effects only after the root rule", () => {
    expect(rootRules["unicorn-js/no-top-level-side-effects"]).toBe("error");
    expect(overrideRules(["**/*.config.{ts,mjs}"])).toStrictEqual({
      "unicorn-js/no-top-level-side-effects": "off",
    });
  });

  test("declares no no-restricted-* rule that could shadow another", () => {
    const restricted = [
      ...Object.keys(rootRules),
      ...overrides.flatMap((override) => Object.keys(override.rules ?? {})),
    ].filter((rule) => /(^|\/)no-restricted-/.test(rule));
    expect(restricted).toStrictEqual([]);
  });
});

describe("eslint.config.mjs", { timeout: 60_000 }, () => {
  const liveLinter = new ESLint({
    cwd: ROOT,
    overrideConfigFile: path.join(ROOT, "eslint.config.mjs"),
  });
  const baselineLinter = new ESLint({
    cwd: ROOT,
    overrideConfigFile: path.join(ROOT, "scripts/lint-parity/eslint.baseline.config.mjs"),
  });
  let liveBlocks: readonly FlatConfigBlock[] = [];

  beforeAll(async () => {
    const module = (await import(pathToFileURL(path.join(ROOT, "eslint.config.mjs")).href)) as {
      default: readonly FlatConfigBlock[];
    };
    liveBlocks = module.default;
  });

  test("scopes every block to .astro files", () => {
    const configBlocks = liveBlocks.filter((block) =>
      Object.keys(block).some((key) => key !== "name" && key !== "ignores"),
    );
    expect(configBlocks.length).toBeGreaterThan(0);
    for (const block of configBlocks) {
      expect(block.files).toBeDefined();
      const groups = block.files ?? [];
      for (const group of groups) {
        const patterns = typeof group === "string" ? [group] : group;
        expect(patterns.some((pattern) => /\.astro(\/|$)/.test(pattern))).toBe(true);
      }
    }
  });

  test.each([
    "scripts/locks.ts",
    "apps/site/src/components/CodeBlock.tsx",
    "lint-policy.mjs",
    "eslint-rules/index.mjs",
  ])("enforces no rule on %s", async (filePath) => {
    const config = (await liveLinter.calculateConfigForFile(filePath)) as
      | { rules?: Record<string, readonly unknown[]> }
      | undefined;
    const active = Object.entries(config?.rules ?? {}).filter(([, entry]) => entry[0] !== 0);
    expect(active).toStrictEqual([]);
  });

  /**
   * Rules active (not `off`) for a path, keyed by id.
   * @param linter - The ESLint instance holding the config under test.
   * @param filePath - Repo-relative path, real or virtual.
   * @returns Active rule entries.
   */
  async function activeRules(linter: ESLint, filePath: string): Promise<RuleMap> {
    const config = (await linter.calculateConfigForFile(filePath)) as {
      rules: Record<string, readonly unknown[]>;
    };
    return Object.fromEntries(Object.entries(config.rules).filter(([, entry]) => entry[0] !== 0));
  }

  test.each([
    "apps/site/src/pages/index.astro",
    "apps/site/src/components/ui/Probe.astro",
    "packages/animated-fluent-emojis/src/astro/Emoji.astro",
    "apps/site/src/layouts/Layout.astro/1_1.ts",
    "apps/site/src/layouts/Layout.astro/1_1.js",
  ])("enforces on %s every rule the full config did", async (filePath) => {
    const live = await activeRules(liveLinter, filePath);
    const baseline = await activeRules(baselineLinter, filePath);
    for (const [rule, entry] of Object.entries(baseline)) {
      expect({ rule, entry: live[rule] }).toStrictEqual({ rule, entry });
    }
    const baselineRules = new Set(Object.keys(baseline));
    const added = Object.keys(live).filter((rule) => !baselineRules.has(rule));
    for (const rule of added) {
      expect(rule).toMatch(/^@eslint-community\/eslint-comments\//);
    }
  });
});
