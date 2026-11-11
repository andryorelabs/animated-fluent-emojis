import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { auditDistribution, readHeaderPolicy } from "./distribution-audit";

const DIST = path.resolve(process.cwd(), process.env.SITE_DIST ?? "dist");
const REQUIRED = process.env.SITE_DIST_REQUIRED === "1";
const HEADERS = process.env.SITE_DIST_HEADERS;

describe.skipIf(!REQUIRED && !existsSync(path.join(DIST, "index.html")))(
  "site build output",
  () => {
    it(
      "has no third-party requests and every page has a content security policy, canonical, hreflang and a sitemap entry",
      { timeout: 120_000 },
      () => {
        expect(
          auditDistribution(DIST, HEADERS ? readHeaderPolicy(HEADERS) : "", {
            requireLastmod: Boolean(process.env.CI),
          }),
        ).toEqual([]);
      },
    );
  },
);
