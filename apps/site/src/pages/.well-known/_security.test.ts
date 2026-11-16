import { describe, expect, it } from "vitest";

import { GET } from "./security.txt";

describe("security.txt endpoint", () => {
  it("serves the RFC 9116 fields as plain text", async () => {
    const response = GET();
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("Contact: ");
    expect(body).toContain("Expires: ");
    expect(body).toContain(
      "Canonical: https://animated-fluent-emojis.andryore.dev/.well-known/security.txt",
    );
  });
});
