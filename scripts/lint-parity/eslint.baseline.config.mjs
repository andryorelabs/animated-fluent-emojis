import path from "node:path";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import eslintReact from "@eslint-react/eslint-plugin";
import { plugin as shadcn } from "@shadcn/lint";
import vitest from "@vitest/eslint-plugin";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import directiveAliasesPlugin from "./baseline-rules/directive-aliases.mjs";
import localPlugin from "./baseline-rules/index.mjs";
import prettierConfig from "./baseline-rules/prettier-config.mjs";

/**
 * Frozen snapshot of the repository `eslint.config.mjs` taken before the Oxc
 * migration, so the differential harness keeps a fixed baseline after the
 * live config shrinks. Only the local plugin import, the frozen
 * `eslint-config-prettier` copy, the directive alias processor, the root
 * directory and the corpus switch differ from the original.
 */
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Set by the harness for the external corpus, which has no tsconfig this
 * config can use: type-checked presets are swapped for their plain twins.
 */
const isCorpusRun = process.env.PARITY_CORPUS === "1";

/**
 * `eslint-plugin-jsdoc`'s TypeScript-flavored recommended rules, with
 * `require-jsdoc` turned off (only non-obvious exports are documented) and
 * `informative-docs` turned on (rejects JSDoc that just restates the
 * declaration's name).
 */
const jsdocRules = {
  ...jsdoc.configs["flat/recommended-typescript-error"].rules,
  "jsdoc/require-jsdoc": "off",
  "jsdoc/informative-docs": "error",
};

/**
 * The recommended `eslint-comments` rules, with `require-description` turned
 * on so every `eslint-disable*` comment must say why.
 */
const eslintCommentsRules = {
  ...eslintComments.configs.recommended.rules,
  "@eslint-community/eslint-comments/require-description": "error",
};

/**
 * Per-component exceptions to `shadcn/no-restyle` on the site; each entry must
 * say why.
 *
 * - `TooltipTrigger`: the gallery tile renders its `<button>` through
 *   `TooltipTrigger`'s `render` prop, so the rule attributes the tile's own
 *   chrome (radius, border, padding, hover and pressed states) to the tooltip.
 *   The classes are the tile's, not a restyle of the tooltip.
 */
const shadcnNoRestyleContracts = [
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
];

/**
 * CSS properties `shadcn/no-inline-styles` lets stay inline on the site: only
 * custom properties, which feed values (delays, hues, counts) into
 * stylesheet rules and cannot be expressed as static classes.
 */
const shadcnAllowedInlineProperties = ["--*"];

/**
 * Classes `shadcn/no-unknown-classes` accepts although Tailwind cannot
 * generate them. Each entry needs a reason.
 */
const shadcnAllowedUnknownClasses = [
  /**
   * Starlight's own flex helper, defined by its stylesheet rather than by
   * Tailwind.
   */
  "sl-flex",
  /**
   * Hook classes in `home.css` that are only ever used inside compound
   * selectors (descendant, sibling, `:has()`, `:hover`, `[data-*]` and
   * reduced-motion media queries) driving the pillars bento, teaser, FAQ
   * mascot and install-step animations. They cannot be a self-contained
   * `@utility` without changing the cascade.
   */
  "bento-*",
  "teaser-cell",
  "teaser-tile",
  "faq-scope",
  "install-step",
  "step-emoji",
  "sc-demo",
  "sc-item",
  "sc-text",
  "sc-emoji",
  /**
   * Style-less marker on the demo's code sample, asserted by
   * `DemoPlayground.test.tsx`; no CSS is declared for it.
   */
  "demo-code",
  /**
   * Hook classes in `docs-chrome.css` and `docs.css` that restyle Starlight's
   * own markup from outside its cascade layers, so they must stay plain rules
   * instead of `@utility` (which would land inside Tailwind's layers).
   */
  "pagination-nav",
  "pagination-label",
  "pagination-title",
  "translation-notice",
  "edit-link",
];

/**
 * Unicorn rules relaxed for this repo. `props`/`ref` are React's own
 * vocabulary (`EmojiProps` is public API), `acc` is the conventional
 * reducer name, and `consistent-boolean-name` would force renaming the
 * public `playOnHover`/`autoPlay` props. The single-line block style rule
 * conflicts with the one-line TSDoc comments used on interface members.
 * `doc`/`docs` stays valid so the local `no-non-doc-comments` rule keeps its name.
 */
export default defineConfig([
  {
    files: ["**/*.{ts,tsx}"],
    extends: isCorpusRun
      ? [tseslint.configs.strict, tseslint.configs.stylistic]
      : [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: repositoryRoot,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      ...(!isCorpusRun && {
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false } },
        ],
        "@typescript-eslint/no-deprecated": "warn",
      }),
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [eslintReact.configs[isCorpusRun ? "recommended" : "recommended-type-checked"]],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },
  jsxA11y.flatConfigs.recommended,
  unicorn.configs.recommended,
  {
    rules: {
      "unicorn/no-null": "off",
      "unicorn/name-replacements": [
        "error",
        {
          allowList: {
            props: true,
            Props: true,
            ref: true,
            Ref: true,
            acc: true,
            doc: true,
            docs: true,
          },
        },
      ],
      "unicorn/consistent-boolean-name": "off",
      "unicorn/single-line-block-comment-style": "off",
      "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
      "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expectTypeOf"] }],
    },
  },
  {
    /**
     * Registered for every file so a CLI `--rule 'shadcn/...: error'`
     * override, which applies to all files, can resolve the plugin.
     */
    plugins: { shadcn },
  },
  {
    files: ["apps/site/**/*.{ts,tsx,astro}"],
    rules: {
      "shadcn/no-restyle": ["error", { allow: ["layout"], contracts: shadcnNoRestyleContracts }],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": ["error", { allow: shadcnAllowedInlineProperties }],
      "shadcn/no-unknown-classes": ["error", { allow: shadcnAllowedUnknownClasses }],
      "shadcn/require-static-classes": "error",
    },
  },
  {
    /**
     * `apps/site/src/components/ui/**` is the shadcn/ui registry code itself,
     * a generated layer that is re-synced rather than hand-edited, so it is
     * exempt from these three rules.
     */
    files: ["apps/site/src/components/ui/**"],
    rules: {
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/require-static-classes": "off",
    },
  },
  {
    files: ["**/*.config.{ts,mjs}"],
    rules: { "unicorn/no-top-level-side-effects": "off" },
  },
  ...astro.configs.recommended,
  {
    files: ["**/*.astro"],
    plugins: { local: localPlugin },
    rules: {
      "local/no-non-doc-comments": "error",
      "local/no-astro-style-blocks": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: {
      jsdoc: jsdoc.configs["flat/recommended-typescript-error"].plugins.jsdoc,
      local: localPlugin,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      ...jsdocRules,
      ...eslintCommentsRules,
      "local/no-non-doc-comments": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettierConfig,
  {
    /**
     * Not in the original config: reads the live code's `unicorn-js/...`
     * style directive names as the ESLint rule ids they alias.
     */
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["**/*.astro/**"],
    plugins: { "parity-directives": directiveAliasesPlugin },
    processor: "parity-directives/aliases",
  },
  globalIgnores([
    "**/.astro/**",
    "**/dist/**",
    "**/coverage/**",
    ".claude/worktrees/**",
    ...(isCorpusRun ? [] : [".cache/**"]),
  ]),
]);
