import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPOSITORY = "https://github.com/andryorelabs/animated-fluent-emojis";
const ALLOWED_GROUPS = new Set(["Added", "Changed", "Fixed"]);
const VERSION_HEADING =
  /^## \[(Unreleased|\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/;

interface Section {
  readonly name: string;
  readonly date: string | undefined;
  readonly lines: readonly string[];
}

const changelog = readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
const lines = changelog.split("\n");

function readSections(): Section[] {
  const sections: Section[] = [];
  let current: { name: string; date: string | undefined; lines: string[] } | undefined;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      const match = VERSION_HEADING.exec(line);
      current = { name: match?.[1] ?? line, date: match?.[2], lines: [] };
      sections.push(current);
    } else if (current && !/^\[[^\]]+\]: /.test(line)) {
      current.lines.push(line);
    }
  }
  return sections;
}

function readLinks(): Map<string, string> {
  const links = new Map<string, string>();
  for (const line of lines) {
    const match = /^\[([^\]]+)\]: (\S+)\s*$/.exec(line);
    if (match?.[1] && match[2]) {
      links.set(match[1], match[2]);
    }
  }
  return links;
}

const sections = readSections();
const links = readLinks();
const released = sections.filter((section) => section.name !== "Unreleased");

describe("CHANGELOG.md", () => {
  it("opens with the Keep a Changelog and Semantic Versioning preamble", () => {
    expect(changelog).toMatch(/^# Changelog\n/);
    expect(changelog).toContain("https://keepachangelog.com/en/1.1.0/");
    expect(changelog).toContain("https://semver.org/spec/v2.0.0.html");
  });

  it("starts with an Unreleased section followed by released versions", () => {
    expect(sections[0]?.name).toBe("Unreleased");
    expect(released.length).toBeGreaterThan(0);
  });

  it.each(sections.map((section) => section.name))("%s has a well-formed heading", (name) => {
    const section = sections.find((candidate) => candidate.name === name);
    expect(VERSION_HEADING.test(`## [${name}]${section?.date ? ` - ${section.date}` : ""}`)).toBe(
      true,
    );
    expect(section?.date === undefined).toBe(name === "Unreleased");
  });

  it.each(sections.map((section) => section.name))(
    "%s uses only Added, Changed and Fixed, each at most once",
    (name) => {
      const section = sections.find((candidate) => candidate.name === name);
      const groups = (section?.lines ?? [])
        .filter((line) => line.startsWith("### "))
        .map((line) => line.slice(4).trim());
      expect(groups.filter((group) => !ALLOWED_GROUPS.has(group))).toEqual([]);
      expect(new Set(groups).size).toBe(groups.length);
    },
  );

  it.each(released.map((section) => section.name))("%s has entries", (name) => {
    const section = released.find((candidate) => candidate.name === name);
    expect(section?.lines.some((line) => /^[-*] /.test(line))).toBe(true);
  });

  it("has a compare or release link for every version", () => {
    for (const section of sections) {
      expect(links.get(section.name), `link for ${section.name}`).toMatch(
        new RegExp(`^${REPOSITORY}/(?:compare/v\\S+\\.\\.\\.\\S+|releases/tag/v\\S+)$`),
      );
    }
  });

  it("points each released link at its own tag", () => {
    for (const section of released) {
      expect(links.get(section.name)).toMatch(
        new RegExp(`v${section.name.replaceAll(".", String.raw`\.`)}$`),
      );
    }
  });

  it("compares Unreleased against the latest released version", () => {
    const latest = released[0]?.name;
    expect(links.get("Unreleased")).toBe(`${REPOSITORY}/compare/v${String(latest)}...HEAD`);
  });

  it("lists versions newest first without duplicates", () => {
    const names = released.map((section) => section.name);
    expect(new Set(names).size).toBe(names.length);
    const dates = released.map((section) => section.date ?? "");
    expect(dates).toEqual(
      dates.toSorted((first, second) => first.localeCompare(second)).toReversed(),
    );
  });

  it("matches the package version in its latest released section", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, "packages/animated-fluent-emojis/package.json"), "utf8"),
    ) as { version: string };
    expect(released[0]?.name).toBe(manifest.version);
  });
});
