import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import eslintCommentsPlugin from "./eslint-comments.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run(
  "@eslint-community/eslint-comments/require-description",
  eslintCommentsPlugin.rules["require-description"],
  {
    valid: [
      {
        name: "a directive with a description",
        code: "// eslint-disable-next-line no-console -- logs on purpose\nconsole.info(1)\n",
      },
    ],
    invalid: [
      {
        name: "a directive without a description reports on its line instead of crashing on column -1",
        code: "export const a = 1\n// eslint-disable-next-line no-console\nconsole.info(1)\n",
        errors: [{ messageId: "missingDescription", line: 2 }],
      },
    ],
  },
);

ruleTester.run(
  "@eslint-community/eslint-comments/no-unlimited-disable",
  eslintCommentsPlugin.rules["no-unlimited-disable"],
  {
    valid: [{ code: "/* eslint-disable no-console -- scoped */\n" }],
    invalid: [
      {
        name: "an unlimited disable is reported on its line",
        code: "export const a = 1\n/* eslint-disable */\n",
        errors: [{ messageId: "unexpected", line: 2 }],
      },
    ],
  },
);
