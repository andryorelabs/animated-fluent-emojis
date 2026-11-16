import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import localPlugin from "./local.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run(
  "local/no-unawaited-async-matcher",
  localPlugin.rules["no-unawaited-async-matcher"],
  {
    valid: [
      { code: "async function f() { await expect(p).rejects.toThrow() }" },
      { code: "function f() { return expect(p).resolves.toBe(1) }" },
      { code: "const f = () => expect(p).resolves.toBe(1)" },
      { code: "expect(value).toBe(1)" },
      { code: "foo.rejects.toThrow()" },
      { code: "async function f() { await expect(p)['rejects'].toThrow() }" },
      { code: "async function f() { await expect(p)[name].toThrow() }" },
    ],
    invalid: [
      {
        code: "expect(p).rejects.toThrow()",
        errors: [{ messageId: "unawaited" }],
      },
      {
        code: "function f() { expect(p).resolves.toBe(1) }",
        errors: [{ messageId: "unawaited" }],
      },
      {
        code: "expect(p)['rejects'].toThrow()",
        errors: [{ messageId: "unawaited" }],
      },
    ],
  },
);

ruleTester.run("local/no-bun-test-only", localPlugin.rules["no-bun-test-only"], {
  valid: [
    { code: 'import { test } from "bun:test"\ntest("a", () => {})' },
    { code: 'import { test } from "vitest"\ntest.only("a", () => {})' },
    { code: "test.only('a', () => {})" },
    { code: 'import { expect } from "bun:test"\nexpect.only' },
    { code: 'import * as bun from "bun:test"\nbun.expect.only' },
    { code: 'import * as bun from "bun:test"\nbun.test.skip("a", () => {})' },
  ],
  invalid: [
    {
      code: 'import { test } from "bun:test"\ntest.only("a", () => {})',
      errors: [{ messageId: "focused" }],
    },
    {
      code: 'import { it as run } from "bun:test"\nrun.only("a", () => {})',
      errors: [{ messageId: "focused" }],
    },
    {
      code: 'import { describe } from "bun:test"\ndescribe["only"]("a", () => {})',
      errors: [{ messageId: "focused" }],
    },
    {
      code: 'import * as bun from "bun:test"\nbun.describe.only("a", () => {})',
      errors: [{ messageId: "focused" }],
    },
    {
      code: 'import { "test" as run } from "bun:test"\nrun.only("a", () => {})',
      errors: [{ messageId: "focused" }],
    },
  ],
});
