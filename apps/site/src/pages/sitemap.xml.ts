import { buildSitemapXml, collectSitemapRoutes } from "../seo/sitemap";
import { SITEMAP_SOURCES } from "../seo/sources";

export async function GET() {
  const routes = await collectSitemapRoutes(SITEMAP_SOURCES);
  return new Response(buildSitemapXml(routes), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
