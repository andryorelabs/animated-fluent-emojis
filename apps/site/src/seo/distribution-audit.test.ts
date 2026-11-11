import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LOCALES, localeUrl } from "../i18n/locales";
import { auditDistribution, readHeaderPolicy } from "./distribution-audit";

const CSP = '<meta http-equiv="content-security-policy" content="default-src \'none\'">';

function sha256Source(script: string): string {
  return `sha256-${createHash("sha256").update(script).digest("base64")}`;
}

const ICON_LINKS =
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png">';

const SOCIAL_TAGS =
  '<meta property="og:image" content="https://x.andryore.dev/og.png"><meta property="og:locale" content="en_US"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[]}</script>';

function pageHtml(
  route: string,
  extraHead = "",
  csp = CSP,
  iconLinks = ICON_LINKS,
  socialTags = SOCIAL_TAGS,
): string {
  const alternates = [...LOCALES, "x-default"]
    .map((hreflang) => {
      const locale = hreflang === "x-default" ? "en" : hreflang;
      return `<link rel="alternate" hreflang="${hreflang}" href="${localeUrl(locale as "en", route)}">`;
    })
    .join("");
  return `<!doctype html><html><head>${csp}${iconLinks}${socialTags}<link rel="canonical" href="${localeUrl("en", route)}">${alternates}${extraHead}</head><body>ok</body></html>`;
}

function sitemapXml(routes: readonly string[]): string {
  const urls = routes.map((route) => `<url><loc>${localeUrl("en", route)}</loc></url>`);
  return `<urlset>${urls.join("")}</urlset>`;
}

describe("auditDistribution", () => {
  let distribution = "";

  function write(relative: string, content: string) {
    const file = path.join(distribution, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  function auditBody(body: string): string[] {
    write(
      "index.html",
      pageHtml("/").replace("ok", () => body),
    );
    return auditDistribution(distribution);
  }

  beforeEach(() => {
    distribution = mkdtempSync(path.join(tmpdir(), "distribution-audit-"));
    write("index.html", pageHtml("/"));
    write("emojis/fire/index.html", pageHtml("/emojis/fire/"));
    write("sitemap.xml", sitemapXml(["/", "/emojis/fire/"]));
    for (const icon of ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]) {
      write(icon, "icon");
    }
  });

  afterEach(() => {
    rmSync(distribution, { recursive: true, force: true });
  });

  it("passes a clean build", () => {
    expect(auditDistribution(distribution)).toEqual([]);
  });

  it("flags a sitemap URL without lastmod only when it is required", () => {
    expect(auditDistribution(distribution)).toEqual([]);
    expect(auditDistribution(distribution, "", { requireLastmod: true })).toEqual([
      `sitemap.xml: ${localeUrl("en", "/")} has no lastmod`,
      `sitemap.xml: ${localeUrl("en", "/emojis/fire/")} has no lastmod`,
    ]);
  });

  it("accepts ISO lastmod dates and flags malformed ones", () => {
    const url = (route: string, lastmod: string) =>
      `<url><loc>${localeUrl("en", route)}</loc><lastmod>${lastmod}</lastmod></url>`;
    write(
      "sitemap.xml",
      `<urlset>${url("/", "2026-10-19")}${url("/emojis/fire/", "yesterday")}</urlset>`,
    );
    expect(auditDistribution(distribution, "", { requireLastmod: true })).toEqual([
      `sitemap.xml: ${localeUrl("en", "/emojis/fire/")} has an invalid lastmod "yesterday"`,
    ]);
  });

  it("flags a page without favicon links", () => {
    write("emojis/fire/index.html", pageHtml("/emojis/fire/", "", CSP, ""));
    const problems = auditDistribution(distribution);
    expect(problems).toEqual([
      "emojis/fire/index.html: missing favicon link",
      "emojis/fire/index.html: missing favicon fallback link",
      "emojis/fire/index.html: missing apple touch icon link",
    ]);
  });

  it("flags a page without og:image, og:locale or JSON-LD", () => {
    write("emojis/fire/index.html", pageHtml("/emojis/fire/", "", CSP, ICON_LINKS, ""));
    expect(auditDistribution(distribution)).toEqual([
      "emojis/fire/index.html: missing og:image",
      "emojis/fire/index.html: missing og:locale",
      "emojis/fire/index.html: missing JSON-LD",
    ]);
  });

  it("flags JSON-LD that does not parse or has no context", () => {
    for (const body of ["{not json", '{"name":"x"}']) {
      write(
        "emojis/fire/index.html",
        pageHtml(
          "/emojis/fire/",
          "",
          CSP,
          ICON_LINKS,
          SOCIAL_TAGS.replace(/\{"@context.*\}/, () => body),
        ),
      );
      expect(auditDistribution(distribution)).toEqual(["emojis/fire/index.html: invalid JSON-LD"]);
    }
  });

  it("flags an empty og:image", () => {
    write(
      "emojis/fire/index.html",
      pageHtml(
        "/emojis/fire/",
        "",
        CSP,
        ICON_LINKS,
        SOCIAL_TAGS.replace("https://x.andryore.dev/og.png", ""),
      ),
    );
    expect(auditDistribution(distribution)).toEqual(["emojis/fire/index.html: missing og:image"]);
  });

  it("accepts the shortcut icon relation Starlight emits", () => {
    write(
      "index.html",
      pageHtml(
        "/",
        "",
        CSP,
        ICON_LINKS.replace(
          'rel="icon" href="/favicon.svg"',
          'rel="shortcut icon" href="/favicon.svg"',
        ),
      ),
    );
    expect(auditDistribution(distribution)).toEqual([]);
  });

  it("flags a missing icon file", () => {
    rmSync(path.join(distribution, "favicon.ico"));
    expect(auditDistribution(distribution)).toEqual(["favicon.ico: missing from the build output"]);
  });

  it("reports a missing dist folder", () => {
    const missing = path.join(distribution, "nope");
    expect(existsSync(missing)).toBe(false);
    expect(auditDistribution(missing)).toHaveLength(1);
  });

  it("flags a third-party script, stylesheet, image and css url", () => {
    write(
      "index.html",
      pageHtml(
        "/",
        '<script src="https://cdn.example.com/a.js"></script><link rel="stylesheet" href="https://fonts.googleapis.com/css">' +
          '<img src="//tracker.example.net/p.gif" srcset="https://img.example.org/a.png 1x">',
      ),
    );
    write("_astro/a.css", "a{background:url(https://evil.example.io/x.png)}");
    const problems = auditDistribution(distribution).join("\n");
    expect(problems).toContain("cdn.example.com");
    expect(problems).toContain("fonts.googleapis.com");
    expect(problems).toContain("tracker.example.net");
    expect(problems).toContain("img.example.org");
    expect(problems).toContain("evil.example.io");
  });

  it("allows first-party hosts, namespaces and plain outbound links", () => {
    write(
      "index.html",
      pageHtml(
        "/",
        '<img src="https://animated-fluent-emojis-cdn.andryore.dev/a.png"><a href="https://github.com/x/y" target="_blank" rel="noopener noreferrer">repo</a><svg xmlns="http://www.w3.org/2000/svg"></svg>',
      ),
    );
    expect(auditDistribution(distribution)).toEqual([]);
  });

  describe("external links", () => {
    const MESSAGE = 'missing target="_blank" or rel noopener noreferrer';

    it("accepts an external anchor with target and both rel tokens", () => {
      expect(
        auditBody(
          '<a href="https://github.com/x/y" target="_blank" rel="external noreferrer noopener">repo</a>',
        ),
      ).toEqual([]);
    });

    it("flags an external anchor without target", () => {
      expect(auditBody('<a href="https://github.com/x/y" rel="noopener noreferrer">r</a>')).toEqual(
        [`index.html: external link https://github.com/x/y ${MESSAGE}`],
      );
    });

    it("flags an external anchor without rel", () => {
      expect(auditBody('<a href="https://github.com/x/y" target="_blank">r</a>')).toEqual([
        `index.html: external link https://github.com/x/y ${MESSAGE}`,
      ]);
    });

    it("flags an external anchor missing one rel token", () => {
      const problems = auditBody(
        '<a href="https://a.example/" target="_blank" rel="noopener">a</a><a href="http://b.example/" target="_blank" rel="noreferrer">b</a>',
      );
      expect(problems).toEqual([
        `index.html: external link https://a.example/ ${MESSAGE}`,
        `index.html: external link http://b.example/ ${MESSAGE}`,
      ]);
    });

    it("ignores internal, relative, fragment, mailto and tel anchors", () => {
      expect(
        auditBody(
          `<a href="${localeUrl("en", "/emojis/")}">a</a><a href="/emojis/">b</a><a href="#top">c</a><a href="mailto:a@b.c">d</a><a href="tel:123">e</a>`,
        ),
      ).toEqual([]);
    });
  });

  it("flags a page without a content security policy", () => {
    write("index.html", pageHtml("/").replace(CSP, ""));
    expect(auditDistribution(distribution).join("\n")).toContain("content security policy");
  });

  it("flags a page without a canonical link", () => {
    write("index.html", pageHtml("/").replace(/<link rel="canonical"[^>]*>/, ""));
    expect(auditDistribution(distribution).join("\n")).toContain("canonical");
  });

  it("flags a page without hreflang alternates", () => {
    write(
      "emojis/fire/index.html",
      pageHtml("/emojis/fire/").replaceAll(/<link rel="alternate"[^>]*>/g, ""),
    );
    expect(auditDistribution(distribution).join("\n")).toContain("hreflang");
  });

  it("flags a page that misses one locale alternate", () => {
    write("index.html", pageHtml("/").replace(/<link rel="alternate" hreflang="ja"[^>]*>/, ""));
    expect(auditDistribution(distribution).join("\n")).toContain("hreflang ja");
  });

  it("flags a page missing from the sitemap", () => {
    write("sitemap.xml", sitemapXml(["/"]));
    expect(auditDistribution(distribution).join("\n")).toContain("/emojis/fire/");
  });

  it("accepts pages without a meta policy when the server header carries one", () => {
    const script = "window.a = 1";
    write("index.html", pageHtml("/", `<script>${script}</script>`, ""));
    write("emojis/fire/index.html", pageHtml("/emojis/fire/", "", ""));
    const header = `script-src 'self' '${sha256Source(script)}'`;

    expect(auditDistribution(distribution, header)).toEqual([]);
    expect(auditDistribution(distribution).join("\n")).toContain("missing content security policy");
    expect(auditDistribution(distribution, "script-src 'self'").join("\n")).toContain(
      "inline script",
    );
  });

  it("reads the policy out of the rendered nginx snippet", () => {
    write(
      "headers.conf",
      'add_header Content-Security-Policy "default-src \'none\'" always;\nadd_header X-Frame-Options "DENY" always;\n',
    );

    expect(readHeaderPolicy(path.join(distribution, "headers.conf"))).toBe("default-src 'none'");
    expect(readHeaderPolicy(path.join(distribution, "missing.conf"))).toBe("");
  });

  it("flags an inline script the policy does not allow", () => {
    write("index.html", pageHtml("/", "<script>window.a = 1</script>"));
    expect(auditDistribution(distribution).join("\n")).toContain("inline script");
  });

  it("accepts inline scripts the policy hashes, and ignores data blocks and attributes", () => {
    const script = "window.a = 1";
    const csp = `<meta http-equiv="content-security-policy" content="script-src 'self' '${sha256Source(script)}'">`;
    write(
      "index.html",
      pageHtml(
        "/",
        `<script>${script}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"Thing"}</script><div data-code="<script>x()</script>"></div>`,
        csp,
      ),
    );
    expect(auditDistribution(distribution)).toEqual([]);
  });

  it("ignores noindex and redirect pages", () => {
    write("404.html", '<html><head><meta name="robots" content="noindex"></head></html>');
    write(
      "old/index.html",
      '<html><head><meta http-equiv="refresh" content="0;url=/"></head></html>',
    );
    expect(auditDistribution(distribution)).toEqual([]);
  });
});
