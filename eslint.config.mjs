import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import eslintReact from "@eslint-react/eslint-plugin";
import { plugin as shadcn } from "@shadcn/lint";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import localPlugin from "./eslint-rules/index.mjs";
import {
  shadcnAllowedInlineProperties,
  shadcnAllowedUnknownClasses,
  shadcnNoRestyleContracts,
} from "./lint-policy.mjs";

/**
 * ESLint lints `.astro` files only; Oxlint (`oxlint.config.ts`) lints every
 * other file, because it cannot see `.astro` templates. Every block below is
 * scoped to `.astro` files or to the virtual files `eslint-plugin-astro`'s
 * processor extracts from their client-side `<script>` tags
 * (`Component.astro/1_1.ts`), which Oxlint does not lint either. Those script
 * blocks keep the TypeScript, React, JSDoc and comment rules they had under
 * the full config.
 */
const astroFiles = ["**/*.astro"];

/**
 * The client-side `<script>` blocks of `.astro` files, as TypeScript and as
 * JavaScript virtual files.
 */
const astroScriptFiles = ["**/*.astro/*.ts"];
const astroJavaScriptFiles = ["**/*.astro/*.js"];
const astroAndScriptFiles = [...astroFiles, ...astroScriptFiles, ...astroJavaScriptFiles];

/**
 * `.astro` files of the site, where the `shadcn/*` rules apply.
 */
const siteAstroFiles = ["apps/site/**/*.astro", "apps/site/**/*.astro/*.ts"];

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
 * Unicorn rules relaxed for this repo. `props`/`ref` are React's own
 * vocabulary (`EmojiProps` is public API), `acc` is the conventional
 * reducer name, and `consistent-boolean-name` would force renaming the
 * public `playOnHover`/`autoPlay` props. The single-line block style rule
 * conflicts with the one-line TSDoc comments used on interface members.
 * `doc`/`docs` stays valid so the local `no-non-doc-comments` rule keeps its name.
 */
const unicornOverrides = {
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
};

/**
 * Unicorn's layout rules, which the formatter owns. `eslint-config-prettier`
 * turned these off before Oxfmt replaced Prettier.
 */
const formatterOwnedRules = {
  "unicorn/empty-brace-spaces": "off",
  "unicorn/no-nested-ternary": "off",
  "unicorn/number-literal-case": "off",
  "unicorn/template-indent": "off",
};

export default defineConfig([
  {
    files: astroScriptFiles,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-deprecated": "warn",
    },
  },
  {
    files: astroScriptFiles,
    extends: [eslintReact.configs["recommended-type-checked"], reactHooks.configs.flat.recommended],
  },
  {
    files: astroAndScriptFiles,
    extends: [jsxA11y.flatConfigs.recommended, unicorn.configs.recommended],
    rules: unicornOverrides,
  },
  {
    /**
     * Registered for every linted file so a CLI `--rule 'shadcn/...: error'`
     * override, which applies to all files, can resolve the plugin.
     */
    files: astroAndScriptFiles,
    plugins: { shadcn },
  },
  {
    files: siteAstroFiles,
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
    files: [
      "apps/site/src/components/ui/**/*.astro",
      "apps/site/src/components/ui/**/*.astro/*.ts",
    ],
    rules: {
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/require-static-classes": "off",
    },
  },
  ...astro.configs.recommended.map((block) =>
    block.files === undefined ? { ...block, files: astroAndScriptFiles } : block,
  ),
  {
    files: astroFiles,
    plugins: {
      local: localPlugin,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      ...eslintCommentsRules,
      "local/no-non-doc-comments": "error",
      "local/no-astro-style-blocks": "error",
    },
  },
  {
    files: astroScriptFiles,
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
    files: astroJavaScriptFiles,
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: astroAndScriptFiles,
    rules: formatterOwnedRules,
  },
  globalIgnores([
    "**/.astro/**",
    "**/dist/**",
    "**/coverage/**",
    ".claude/worktrees/**",
    "**/.cache/**",
  ]),
]);
