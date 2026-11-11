import { buildRobotsTxt } from "../seo/robots";
import { ROBOTS_CONTRIBUTIONS } from "../seo/sources";

export function GET() {
  return new Response(buildRobotsTxt(ROBOTS_CONTRIBUTIONS), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
