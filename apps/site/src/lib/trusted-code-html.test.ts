import { expect, test, vi } from "vitest";

import { trustedCodeHtml, type CodeHtmlFactory } from "./trusted-code-html";

function createFactory() {
  const createHTML = vi.fn((input: string) => ({ wrapped: input }));
  const createPolicy = vi.fn(() => ({ createHTML }));
  return {
    factory: { createPolicy } as unknown as CodeHtmlFactory,
    createPolicy,
    createHTML,
  };
}

test("trustedCodeHtml returns the plain string without Trusted Types", () => {
  expect(trustedCodeHtml("<pre>code</pre>", undefined)).toBe("<pre>code</pre>");
});

test("trustedCodeHtml wraps the markup through the afe-code policy", () => {
  const { factory, createPolicy, createHTML } = createFactory();

  const result = trustedCodeHtml("<pre>code</pre>", factory);

  expect(createPolicy).toHaveBeenCalledWith("afe-code", expect.any(Object));
  expect(createHTML).toHaveBeenCalledWith("<pre>code</pre>");
  expect(result).toEqual({ wrapped: "<pre>code</pre>" });
});

test("trustedCodeHtml creates the policy once per factory", () => {
  const { factory, createPolicy } = createFactory();

  trustedCodeHtml("a", factory);
  trustedCodeHtml("b", factory);

  expect(createPolicy).toHaveBeenCalledTimes(1);
});

test("trustedCodeHtml policy passes the markup through unchanged", () => {
  const { factory, createPolicy } = createFactory();
  trustedCodeHtml("a", factory);
  const [, rules] = createPolicy.mock.calls[0] as unknown as [
    string,
    { createHTML: (input: string) => string },
  ];

  expect(rules.createHTML("<span>x</span>")).toBe("<span>x</span>");
});
