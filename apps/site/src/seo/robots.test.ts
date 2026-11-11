import { describe, expect, it } from "vitest";

import { ANSWER_CRAWLERS, SEARCH_CRAWLERS, TRAINING_CRAWLERS } from "./crawlers";
import { buildRobotsTxt } from "./robots";

function rulesFor(output: string, agent: string): string[] {
  const block = output
    .split("\n\n")
    .find((candidate) => candidate.split("\n").includes(`User-agent: ${agent}`));
  return (block ?? "").split("\n").filter((line) => !line.startsWith("User-agent"));
}

describe("robots", () => {
  it("lists the sitemap", () => {
    expect(buildRobotsTxt()).toContain(
      "Sitemap: https://animated-fluent-emojis.andryore.dev/sitemap.xml",
    );
  });

  it.each([...TRAINING_CRAWLERS])("disallows the training crawler %s", (agent) => {
    expect(rulesFor(buildRobotsTxt(), agent)).toEqual(["Disallow: /"]);
  });

  it.each([...SEARCH_CRAWLERS])("allows the search crawler %s", (agent) => {
    expect(rulesFor(buildRobotsTxt(), agent)).toEqual(["Allow: /"]);
  });

  it.each([...ANSWER_CRAWLERS])("allows the answer crawler %s", (agent) => {
    expect(rulesFor(buildRobotsTxt(), agent)).toEqual(["Allow: /"]);
  });

  it("allows every other agent", () => {
    expect(rulesFor(buildRobotsTxt(), "*")).toEqual(["Allow: /"]);
  });

  it("merges contributions into the allowed groups only", () => {
    const output = buildRobotsTxt([
      { disallow: ["/private/"] },
      { disallow: ["/private/", "/tmp/"], sitemaps: ["https://x.test/s.xml"] },
    ]);
    const paths = ["Disallow: /private/", "Disallow: /tmp/"];
    expect(rulesFor(output, "Googlebot")).toEqual(paths);
    expect(rulesFor(output, "*")).toEqual(paths);
    expect(rulesFor(output, "GPTBot")).toEqual(["Disallow: /"]);
    expect(output).toContain("Sitemap: https://x.test/s.xml");
  });
});
