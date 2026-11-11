import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RuleTester } from "oxlint/plugins-dev";
import { afterAll, describe, it } from "vitest";

import typescriptJsPlugin from "./typescript-js.mjs";
import unicornJsPlugin from "./unicorn-js.mjs";
import { withTypes } from "./with-types.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

/**
 * Two guards whose shared exit narrows to a different type in each body:
 * unicorn's `prefer-combined-guards` keeps them apart when parser services
 * exist (as under ESLint on `.ts`) and asks to combine them when they do not
 * (`.mjs`).
 */
const GUARDS = [
  "const value = Math.random() > 0.5 ? 'a' : 1",
  "export function run() {",
  "  if (typeof value === 'string') return value",
  "  if (typeof value === 'number') return value",
  "  return undefined",
  "}",
  "",
].join("\n");

const COMBINED_GUARDS = GUARDS.replace(
  "  if (typeof value === 'string') return value\n  if (typeof value === 'number') return value",
  "  if ((typeof value === 'string') || (typeof value === 'number')) return value",
);

/**
 * An optional-property check typescript-eslint's `prefer-optional-chain`
 * accepts, but that the tsgolint port reports.
 */
const TYPEOF_GUARD =
  "export const hidden = (): boolean =>\n  typeof document !== 'undefined' && document.hidden\n";

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "with-types-"));

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

/**
 * Writes one file under the temporary root.
 * @param relative Path relative to the temporary root.
 * @param contents What to write.
 * @returns The file's absolute path.
 */
function writeFile(relative: string, contents: string): string {
  const absolute = path.join(temporaryRoot, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  return absolute;
}

writeFile(
  "project/tsconfig.json",
  JSON.stringify({
    compilerOptions: { strict: true, lib: ["ES2023", "DOM"] },
    include: ["src"],
  }),
);
const typedGuards = writeFile("project/src/guards.ts", GUARDS);
const untypedGuards = writeFile("project/src/guards.mjs", GUARDS);
const strayGuards = writeFile("project/stray/guards.ts", GUARDS);
const typeofGuard = writeFile("project/src/hidden.ts", TYPEOF_GUARD);
const strayTypeofGuard = writeFile("project/stray/hidden.ts", TYPEOF_GUARD);

const ruleTester = new RuleTester();

ruleTester.run(
  "unicorn-js/prefer-combined-guards",
  unicornJsPlugin.rules["prefer-combined-guards"],
  {
    valid: [
      {
        name: "a TypeScript file runs with types, as under ESLint",
        code: GUARDS,
        filename: typedGuards,
      },
    ],
    invalid: [
      {
        name: "a JavaScript file runs without types, as under ESLint",
        code: GUARDS,
        filename: untypedGuards,
        errors: 1,
        output: COMBINED_GUARDS,
      },
      {
        name: "a TypeScript file no tsconfig covers runs without types",
        code: GUARDS,
        filename: strayGuards,
        errors: 1,
        output: COMBINED_GUARDS,
      },
    ],
  },
);

ruleTester.run(
  "typescript-js/prefer-optional-chain",
  typescriptJsPlugin.rules["prefer-optional-chain"],
  {
    valid: [
      {
        name: "a typeof guard is kept, as typescript-eslint keeps it",
        code: TYPEOF_GUARD,
        filename: typeofGuard,
      },
    ],
    invalid: [
      {
        name: "a file no tsconfig covers is reported, not skipped",
        code: TYPEOF_GUARD,
        filename: strayTypeofGuard,
        errors: [{ messageId: "uncoveredFile", line: 1 }],
      },
    ],
  },
);

/** The slice of TypeScript's symbol the probe rule reads. */
interface ProbeSymbol {
  readonly name: string;
}

/** The parser services the probe rule reads. */
interface ProbeServices {
  readonly esTreeNodeToTSNodeMap: { has(node: object): boolean };
  getSymbolAtLocation(node: object): ProbeSymbol | undefined;
}

/** The slice of Oxlint's rule context the probe rule uses. */
interface ProbeContext {
  readonly parserServices: ProbeServices;
  getSourceCode(): { readonly parserServices: ProbeServices };
  report(descriptor: { node: object; messageId: string; data: Record<string, string> }): void;
}

/**
 * Reports every identifier named `target` with what the parser services say
 * about it, reached through both `getSourceCode()` and `parserServices`.
 */
const probeRule = withTypes(
  {
    meta: {
      schema: [],
      messages: { seen: "{{symbol}} mapped={{mapped}} shared={{shared}}" },
    },
    create(context: ProbeContext) {
      return {
        Identifier(node: { name: string }) {
          if (node.name !== "target") return;
          const services = context.getSourceCode().parserServices;
          context.report({
            node,
            messageId: "seen",
            data: {
              symbol: services.getSymbolAtLocation(node)?.name ?? "none",
              mapped: String(services.esTreeNodeToTSNodeMap.has(node)),
              shared: String(services === context.parserServices),
            },
          });
        },
      };
    },
  },
  { requireTypes: true },
);

writeFile(
  "cycle/tsconfig.json",
  JSON.stringify({ files: [], references: [{ path: "./tsconfig.a.json" }] }),
);
writeFile(
  "cycle/tsconfig.a.json",
  JSON.stringify({ files: [], references: [{ path: "./tsconfig.b.json" }] }),
);
writeFile(
  "cycle/tsconfig.b.json",
  JSON.stringify({ files: [], references: [{ path: "./tsconfig.a.json" }] }),
);
const cycleFile = writeFile("cycle/src/probe.ts", "export const target = 1\n");
const probeFile = writeFile("project/src/probe.ts", "export const target = 1\n");

ruleTester.run("with-types probe", probeRule, {
  valid: [],
  invalid: [
    {
      name: "the services resolve symbols and share one map per file",
      code: "export const target = 1\n",
      filename: probeFile,
      errors: [{ message: "target mapped=true shared=true" }],
    },
    {
      name: "a reference cycle that covers nothing is reported, not looped",
      code: "export const target = 1\n",
      filename: cycleFile,
      errors: [{ messageId: "uncoveredFile", line: 1 }],
    },
  ],
});
