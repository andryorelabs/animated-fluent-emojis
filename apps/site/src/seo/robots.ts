import { SITE_ORIGIN } from "../i18n/locales";
import { ANSWER_CRAWLERS, SEARCH_CRAWLERS, TRAINING_CRAWLERS } from "./crawlers";

/**
 * Extra robots.txt directives. Feature modules add theirs to
 * `ROBOTS_CONTRIBUTIONS` in `seo/sources.ts`.
 */
export interface RobotsContribution {
  disallow?: readonly string[];
  sitemaps?: readonly string[];
}

function group(agents: readonly string[], rules: readonly string[]): string {
  return [...agents.map((agent) => `User-agent: ${agent}`), ...rules, ""].join("\n");
}

/**
 * Renders `robots.txt`: search and answer crawlers are allowed, AI-training
 * crawlers are disallowed in their own group, and every other agent is
 * allowed. Paths contributed by other modules are disallowed in the allowed
 * groups, and the sitemap is always listed.
 * @param contributions - Directives from other modules.
 * @returns The file contents.
 */
export function buildRobotsTxt(contributions: readonly RobotsContribution[] = []): string {
  const disallow = [...new Set(contributions.flatMap((entry) => entry.disallow ?? []))];
  const sitemaps = [
    ...new Set([
      `${SITE_ORIGIN}/sitemap.xml`,
      ...contributions.flatMap((entry) => entry.sitemaps ?? []),
    ]),
  ];
  const allowedRules =
    disallow.length === 0 ? ["Allow: /"] : disallow.map((path) => `Disallow: ${path}`);
  return [
    group([...SEARCH_CRAWLERS, ...ANSWER_CRAWLERS], allowedRules),
    group(TRAINING_CRAWLERS, ["Disallow: /"]),
    group(["*"], allowedRules),
    ...sitemaps.map((url) => `Sitemap: ${url}`),
    "",
  ].join("\n");
}
