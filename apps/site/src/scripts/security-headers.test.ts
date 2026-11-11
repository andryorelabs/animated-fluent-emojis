import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  type BuiltPage,
  collectMetaScriptHashes,
  findInlineScriptHashes,
  prepareSecurityHeaders,
  renderSecurityHeaders,
  stripMetaCsp,
} from "./security-headers";

function hashOf(script: string): string {
  return `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
}

function page(script: string, allowedHashes: string[]): string {
  const meta = `<meta http-equiv="content-security-policy" content="default-src 'none'; script-src 'self' ${allowedHashes.join(" ")}">`;
  return `<html><head>${meta}</head><body><script>${script}</script></body></html>`;
}

const TEMPLATE = 'add_header Content-Security-Policy "script-src __SCRIPT_HASHES__" always;';

describe("collectMetaScriptHashes", () => {
  it("reads the hashes of the script-src directive only", () => {
    const html = `<meta http-equiv="content-security-policy" content="style-src 'sha256-style='; script-src 'self' 'sha256-one=' 'sha256-two='">`;
    expect(collectMetaScriptHashes(html)).toEqual(["'sha256-one='", "'sha256-two='"]);
  });

  it("returns nothing without a meta tag", () => {
    expect(collectMetaScriptHashes("<html></html>")).toEqual([]);
  });
});

describe("findInlineScriptHashes", () => {
  it("hashes inline scripts and skips external, data and json blocks", () => {
    const html =
      '<script>a()</script><script src="/x.js"></script><script type="application/ld+json">{}</script><script type="module">b()</script>';
    expect(findInlineScriptHashes(html)).toEqual([hashOf("a()"), hashOf("b()")]);
  });
});

describe("findInlineScriptHashes nesting", () => {
  it("ignores script-looking text inside script bodies and attributes", () => {
    const html =
      '<script>const s = "<script lang=ts>x</script>"</script><div data-code="<script>y</script>"></div>';
    expect(findInlineScriptHashes(html)).toEqual([hashOf('const s = "<script lang=ts>x')]);
  });
});

describe("stripMetaCsp", () => {
  it("removes the CSP meta and keeps the rest", () => {
    const stripped = stripMetaCsp(page("a()", ["'sha256-x='"]));
    expect(stripped).not.toContain("content-security-policy");
    expect(stripped).toContain("<script>a()</script>");
  });
});

describe("renderSecurityHeaders", () => {
  it("sorts and de-duplicates hashes", () => {
    expect(renderSecurityHeaders(TEMPLATE, ["'sha256-b'", "'sha256-a'", "'sha256-b'"])).toContain(
      "script-src 'sha256-a' 'sha256-b'\"",
    );
  });

  it("refuses an empty hash list", () => {
    expect(() => renderSecurityHeaders(TEMPLATE, [])).toThrow("No script hashes");
  });
});

describe("prepareSecurityHeaders", () => {
  it("renders the declared hashes and strips the meta from each page", () => {
    const written: BuiltPage[] = [];
    const snippet = prepareSecurityHeaders(
      () => [{ file: "index.html", html: page("a()", [hashOf("a()")]) }],
      TEMPLATE,
      (builtPage) => {
        written.push(builtPage);
      },
    );
    expect(snippet).toContain(hashOf("a()"));
    expect(written).toHaveLength(1);
    expect(written[0]?.html).not.toContain("content-security-policy");
  });

  it("fails the build and writes nothing when an inline script is left unhashed", () => {
    const written: BuiltPage[] = [];
    expect(() =>
      prepareSecurityHeaders(
        () => [
          { file: "index.html", html: page("a()", [hashOf("a()")]) },
          { file: "docs/index.html", html: page("evil()", [hashOf("a()")]) },
        ],
        TEMPLATE,
        (builtPage) => {
          written.push(builtPage);
        },
      ),
    ).toThrow(/Inline scripts missing from the CSP:\ndocs\/index\.html/);
    expect(written).toEqual([]);
  });
});
