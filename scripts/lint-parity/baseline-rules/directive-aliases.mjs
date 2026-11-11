/**
 * ESLint rule prefixes for the Oxlint jsPlugin aliases a directive comment may
 * name, the same mapping `diff.ts` applies to Oxlint findings.
 */
const ALIAS_PREFIXES = {
  "eslint-js/": "",
  "unicorn-js/": "unicorn/",
  "jsdoc-js/": "jsdoc/",
  "react-hooks-js/": "react-hooks/",
  "vitest-js/": "vitest/",
  "typescript-js/": "@typescript-eslint/",
  "typed-react/": "@eslint-react/",
};

const ALIAS_PATTERN = new RegExp(
  String.raw`(?<![\w@/-])(${Object.keys(ALIAS_PREFIXES).join("|")})(?=[a-z])`,
  "g",
);

const DIRECTIVE_LINE = /eslint-(?:disable|enable)/;

/**
 * Rewrites jsPlugin alias names in `eslint-disable`/`eslint-enable` comments
 * back to the ESLint rule ids, line by line so reported lines do not move.
 * @param text The source text.
 * @returns The source text with directive aliases renamed.
 */
export function renameDirectiveAliases(text) {
  return text
    .split("\n")
    .map((line) =>
      DIRECTIVE_LINE.test(line)
        ? line.replaceAll(ALIAS_PATTERN, (alias) => ALIAS_PREFIXES[alias])
        : line,
    )
    .join("\n");
}

/**
 * Processor plugin for the frozen baseline: the live code names rules by the
 * Oxlint jsPlugin aliases (`unicorn-js/...`) in its directives, which the
 * pre-migration ESLint config only knows by their ESLint names.
 */
const directiveAliasesPlugin = {
  processors: {
    aliases: {
      preprocess: (text) => [renameDirectiveAliases(text)],
      postprocess: (messages) => messages.flat(),
      supportsAutofix: false,
    },
  },
};

export default directiveAliasesPlugin;
