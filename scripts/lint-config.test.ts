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

const baselineErrorRules = [
  "typescript/await-thenable",
  "typescript/ban-ts-comment",
  "eslint/no-array-constructor",
  "typescript/no-array-delete",
  "typescript/no-base-to-string",
  "typescript/no-confusing-void-expression",
  "typescript/no-deprecated",
  "typescript/no-duplicate-enum-values",
  "typescript/no-duplicate-type-constituents",
  "typescript/no-dynamic-delete",
  "typescript/no-empty-object-type",
  "typescript/no-explicit-any",
  "typescript/no-extra-non-null-assertion",
  "typescript/no-extraneous-class",
  "typescript/no-floating-promises",
  "typescript/no-for-in-array",
  "typescript/no-implied-eval",
  "typescript/no-invalid-void-type",
  "typescript/no-meaningless-void-operator",
  "typescript/no-misused-new",
  "typescript/no-misused-promises",
  "typescript/no-misused-spread",
  "typescript/no-mixed-enums",
  "typescript/no-namespace",
  "typescript/no-non-null-asserted-nullish-coalescing",
  "typescript/no-non-null-asserted-optional-chain",
  "typescript/no-non-null-assertion",
  "typescript/no-redundant-type-constituents",
  "typescript/no-require-imports",
  "typescript/no-this-alias",
  "typescript/no-unnecessary-boolean-literal-compare",
  "typescript/no-unnecessary-condition",
  "typescript/no-unnecessary-template-expression",
  "typescript/no-unnecessary-type-arguments",
  "typescript/no-unnecessary-type-assertion",
  "typescript/no-unnecessary-type-conversion",
  "typescript/no-useless-default-assignment",
  "typescript/no-unsafe-enum-assignment",
  "typescript/no-generated-empty-object-type",
  "typescript/no-unnecessary-type-constraint",
  "typescript/no-unnecessary-type-parameters",
  "typescript/no-unsafe-argument",
  "typescript/no-unsafe-assignment",
  "typescript/no-unsafe-call",
  "typescript/no-unsafe-declaration-merging",
  "typescript/no-unsafe-enum-comparison",
  "typescript/no-unsafe-function-type",
  "typescript/no-unsafe-member-access",
  "typescript/no-unsafe-return",
  "typescript/no-unsafe-unary-minus",
  "eslint/no-unused-expressions",
  "eslint/no-unused-vars",
  "eslint/no-useless-constructor",
  "typescript/no-wrapper-object-types",
  "typescript/only-throw-error",
  "typescript/prefer-as-const",
  "typescript/prefer-literal-enum-member",
  "typescript/prefer-namespace-keyword",
  "typescript/prefer-promise-reject-errors",
  "typescript/prefer-reduce-type-parameter",
  "typescript/prefer-return-this-type",
  "typescript/related-getter-setter-pairs",
  "typescript/require-await",
  "typescript/restrict-plus-operands",
  "typescript/restrict-template-expressions",
  "typescript/return-await",
  "typescript/triple-slash-reference",
  "typescript/unbound-method",
  "typescript/unified-signatures",
  "typescript/use-unknown-in-catch-callback-variable",
  "typescript/adjacent-overload-signatures",
  "typescript/array-type",
  "typescript/ban-tslint-comment",
  "typescript/class-literal-property-style",
  "typescript/consistent-generic-constructors",
  "typescript/consistent-indexed-object-style",
  "typescript/consistent-type-assertions",
  "typescript/consistent-type-definitions",
  "typescript/dot-notation",
  "typescript/no-confusing-non-null-assertion",
  "eslint/no-empty-function",
  "typescript/no-inferrable-types",
  "typescript/non-nullable-type-assertion-style",
  "typescript/prefer-find",
  "typescript/prefer-for-of",
  "typescript/prefer-function-type",
  "typescript/prefer-nullish-coalescing",
  "typescript/prefer-optional-chain",
  "typescript/prefer-regexp-exec",
  "typescript/switch-exhaustiveness-check",
  "typescript/consistent-type-imports",
  "jsdoc/check-tag-names",
  "jsdoc/empty-tags",
  "jsdoc/implements-on-classes",
  "jsdoc/no-defaults",
  "jsdoc/require-param-name",
  "jsdoc/require-property-name",
  "jsdoc/require-returns-description",
  "unicorn/no-abusive-eslint-disable",
  "local/no-unawaited-async-matcher",
  "local/no-bun-test-only",
  "import/no-unassigned-import",
];

const baselineEquivalents: Readonly<Record<string, string>> = {
  "jest/no-focused-tests": "vitest-js/no-focused-tests",
  "jest/no-identical-title": "vitest/no-identical-title",
  "local/require-description": "@eslint-community/eslint-comments/require-description",
  "typescript/prefer-includes": "unicorn-js/prefer-includes",
  "typescript/prefer-string-starts-ends-with": "unicorn/prefer-string-starts-ends-with",
};

const allConfiguredRules: RuleMap = {
  ...rootRules,
  ...Object.fromEntries(overrides.flatMap((override) => Object.entries(override.rules ?? {}))),
};

function severityOf(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

describe("aokit E10 baseline", () => {
  test.each([...baselineErrorRules, ...Object.keys(baselineEquivalents)])(
    "enforces %s as an error",
    (rule) => {
      const configured = baselineEquivalents[rule] ?? rule;
      const candidates = [
        configured,
        configured.replace(/^eslint\//, ""),
        configured.replace(/^eslint\//, "typescript-js/"),
        configured.replace(/^typescript\//, "typescript-js/"),
      ];
      const severities = candidates.map((name) => severityOf(allConfiguredRules[name]));
      expect(severities, configured).toContain("error");
    },
  );

  test("keeps the baseline options", () => {
    expect(allConfiguredRules["typescript/return-await"]).toStrictEqual(["error", "in-try-catch"]);
    expect(allConfiguredRules["import/no-unassigned-import"]).toStrictEqual([
      "error",
      { allow: ["**/*.css", "@fontsource/**", "@fontsource-variable/**"] },
    ]);
    expect(allConfiguredRules["typescript/no-misused-promises"]).toBe("error");
  });

  test("runs type-aware and reports unused disable directives as errors", () => {
    expect(oxlintConfig.options).toStrictEqual({
      typeAware: true,
      reportUnusedDisableDirectives: "error",
    });
    expect(oxlintConfig.plugins).toEqual(
      expect.arrayContaining(["typescript", "jsdoc", "import", "vitest"]),
    );
  });

  test("loads the local baseline rules from the oxlint plugin", () => {
    expect(oxlintConfig.jsPlugins).toContainEqual({
      name: "local",
      specifier: "./oxlint-plugins/local.mjs",
    });
    const testRules = overrideRules(["**/*.test.{ts,tsx}"]);
    expect(testRules["local/no-bun-test-only"]).toBe("error");
    expect(testRules["local/no-unawaited-async-matcher"]).toBe("error");
    expect(testRules["vitest-js/no-focused-tests"]).toStrictEqual(["error", { fixable: true }]);
  });
});
