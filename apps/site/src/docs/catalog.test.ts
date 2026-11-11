import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadCatalog, splitEnglishTitle } from "./catalog";
import { rewriteMarkdownLinks } from "./markdown";
import { DOCS_DIR } from "./paths";
import { docRoute, PUBLISHED_DOCS } from "./published";
import { formatStatusReport } from "./status";
import { hashSource, MalformedTranslationError } from "./translations";

const fixture = { root: "", docsDirectory: "", translationsDirectory: "" };

function sources() {
  return {
    docsDirectory: fixture.docsDirectory,
    translationsDirectory: fixture.translationsDirectory,
  };
}

function write(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

beforeEach(() => {
  fixture.root = mkdtempSync(path.join(tmpdir(), "afe-docs-"));
  fixture.docsDirectory = path.join(fixture.root, "docs");
  fixture.translationsDirectory = path.join(fixture.root, "translations");
  for (const doc of PUBLISHED_DOCS) {
    write(path.join(fixture.docsDirectory, doc), `# ${doc}\n\nBody of ${doc}\n`);
  }
});

afterEach(() => {
  rmSync(fixture.root, { recursive: true, force: true });
});

function find(pages: ReturnType<typeof loadCatalog>, locale: string, docPath: string) {
  const page = pages.find(
    (candidate) => candidate.locale === locale && candidate.docPath === docPath,
  );
  if (!page) throw new Error(`no page ${locale} ${docPath}`);
  return page;
}

describe("splitEnglishTitle", () => {
  it("splits the heading from the body", () => {
    expect(splitEnglishTitle("# Hi\n\nText\n", "x.md")).toEqual({
      title: "Hi",
      body: "Text\n",
    });
  });

  it("requires a heading", () => {
    expect(() => splitEnglishTitle("text", "x.md")).toThrow("x.md");
  });
});

describe("loadCatalog", () => {
  it("serves every published doc in every locale", () => {
    expect(loadCatalog(sources())).toHaveLength(PUBLISHED_DOCS.length * 10);
  });

  it("marks an absent translation missing and shows English", () => {
    const page = find(loadCatalog(sources()), "es", "usage.md");
    expect(page.status).toBe("missing");
    expect(page.id).toBe("es/docs");
    expect(page.title).toBe("usage.md");
    expect(page.editUrl).toContain("/edit/main/docs/usage.md");
  });

  it("uses a fresh translation", () => {
    const hash = hashSource("# usage.md\n\nBody of usage.md\n");
    write(
      path.join(fixture.translationsDirectory, "pt-br", "usage.md"),
      `---\ntitle: Guia\nsourceHash: ${hash}\n---\nCorpo\n`,
    );
    const page = find(loadCatalog(sources()), "pt-BR", "usage.md");
    expect(page).toMatchObject({
      status: "translated",
      title: "Guia",
      body: "Corpo\n",
      id: "pt-br/docs",
    });
    expect(page.editUrl).toContain("translations/pt-br/usage.md");
  });

  it("falls back to English for a stale translation", () => {
    write(
      path.join(fixture.translationsDirectory, "de", "troubleshooting.md"),
      "---\ntitle: Fehler\nsourceHash: outdated\n---\nText\n",
    );
    const page = find(loadCatalog(sources()), "de", "troubleshooting.md");
    expect(page).toMatchObject({
      status: "stale",
      title: "troubleshooting.md",
    });
    expect(page.body).toContain("Body of troubleshooting.md");
  });

  it("throws on a malformed translation", () => {
    write(path.join(fixture.translationsDirectory, "fr", "usage.md"), "no frontmatter");
    expect(() => loadCatalog(sources())).toThrow(MalformedTranslationError);
  });

  it("loads the real English docs", () => {
    expect(
      loadCatalog({ ...sources(), docsDirectory: DOCS_DIR }).every((page) => page.title.length > 0),
    ).toBe(true);
  });
});

describe("published docs links", () => {
  it("resolve to a site route or a GitHub URL, never a dangling relative path", () => {
    const pages = loadCatalog({ ...sources(), docsDirectory: DOCS_DIR });
    const routes = new Set(pages.map((page) => docRoute(page.locale, page.docPath)));
    for (const page of pages) {
      const rewritten = rewriteMarkdownLinks(page.body, page);
      for (const match of rewritten.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1] ?? "";
        const [route = ""] = target.split("#", 1);
        if (target.startsWith("#") || target.startsWith("https://")) continue;
        expect(routes.has(route), `${page.id}: ${target}`).toBe(true);
      }
    }
  });
});

describe("formatStatusReport", () => {
  it("lists missing and stale pages with totals", () => {
    write(
      path.join(fixture.translationsDirectory, "de", "troubleshooting.md"),
      "---\ntitle: Fehler\nsourceHash: outdated\n---\nText\n",
    );
    const report = formatStatusReport(loadCatalog(sources()));
    expect(report).toContain("stale   de troubleshooting.md");
    expect(report).toContain("missing es usage.md");
    expect(report).toContain("134 missing, 1 stale, 15 up to date");
  });
});
