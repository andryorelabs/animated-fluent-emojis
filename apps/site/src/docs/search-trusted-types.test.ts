import { describe, expect, it, vi } from "vitest";

import {
  installSearchTrustedTypesPolicy,
  restrictToPagefindWorker,
  type TrustedTypesFactory,
} from "./search-trusted-types";

const ORIGIN = "https://animated-fluent-emojis.andryore.dev";

describe("restrictToPagefindWorker", () => {
  it("allows the Pagefind worker by relative and absolute URL", () => {
    expect(restrictToPagefindWorker("/pagefind/pagefind-worker.js", ORIGIN)).toBe(
      "/pagefind/pagefind-worker.js",
    );
    const absolute = `${ORIGIN}/pagefind/pagefind-worker.js`;
    expect(restrictToPagefindWorker(absolute, ORIGIN)).toBe(absolute);
  });

  it("blocks other paths and other origins", () => {
    expect(() => restrictToPagefindWorker("/assets/evil.js", ORIGIN)).toThrow(TypeError);
    expect(() =>
      restrictToPagefindWorker("https://example.com/pagefind/pagefind-worker.js", ORIGIN),
    ).toThrow(TypeError);
    expect(() => restrictToPagefindWorker("data:text/javascript,alert(1)", ORIGIN)).toThrow(
      TypeError,
    );
  });
});

describe("installSearchTrustedTypesPolicy", () => {
  it("registers the default policy with HTML and script URL callbacks only", () => {
    const createPolicy = vi.fn<TrustedTypesFactory["createPolicy"]>();
    installSearchTrustedTypesPolicy({ createPolicy }, ORIGIN);
    expect(createPolicy).toHaveBeenCalledOnce();
    const call = createPolicy.mock.calls[0];
    expect(call?.[0]).toBe("default");
    expect(Object.keys(call?.[1] ?? {}).toSorted((a, b) => a.localeCompare(b))).toEqual([
      "createHTML",
      "createScriptURL",
    ]);
  });

  it("wires the callbacks to the markup and worker restrictions", () => {
    const createPolicy = vi.fn<TrustedTypesFactory["createPolicy"]>();
    installSearchTrustedTypesPolicy({ createPolicy }, ORIGIN);
    const rules = createPolicy.mock.calls[0]?.[1];
    expect(rules?.createHTML("a <mark>b</mark> <script>x</script>")).toBe(
      "a <mark>b</mark> &lt;script>x&lt;/script>",
    );
    expect(rules?.createScriptURL("/pagefind/pagefind-worker.js")).toBe(
      "/pagefind/pagefind-worker.js",
    );
    expect(() => rules?.createScriptURL("/evil.js")).toThrow(TypeError);
  });

  it("does nothing without Trusted Types", () => {
    expect(() => {
      installSearchTrustedTypesPolicy(undefined, ORIGIN);
    }).not.toThrow();
  });
});
