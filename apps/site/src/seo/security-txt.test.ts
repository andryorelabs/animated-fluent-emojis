import { describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "../i18n/locales";
import { REPOSITORY_URL } from "../site-links";
import { buildSecurityTxt } from "./security-txt";

describe("buildSecurityTxt", () => {
  const body = buildSecurityTxt(new Date("2026-01-01T00:00:00.000Z"));

  it("lists the advisory contact, the policy and the canonical URL", () => {
    expect(body).toContain(`Contact: ${REPOSITORY_URL}/security/advisories/new`);
    expect(body).toContain(`Policy: ${REPOSITORY_URL}/blob/main/.github/SECURITY.md`);
    expect(body).toContain(`Canonical: ${SITE_ORIGIN}/.well-known/security.txt`);
  });

  it("expires 180 days after the build time", () => {
    expect(body).toContain("Expires: 2026-06-30T00:00:00.000Z");
  });
});
