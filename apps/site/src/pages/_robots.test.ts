import { describe, expect, it } from "vitest";

import { GET } from "./robots.txt";

describe("robots.txt endpoint", () => {
  it("serves the robots rules as plain text", async () => {
    const response = GET();
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Sitemap: https://animated-fluent-emojis.andryore.dev/sitemap.xml");
  });
});
