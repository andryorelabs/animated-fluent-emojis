import {
  hreflangAlternates,
  LOCALES,
  localeUrl,
  SITE_ORIGIN,
} from '../i18n/locales'
import { lastCommitDate } from './last-modified'

/**
 * One page to list in the sitemap. A `localized` route expands to every locale
 * with `xhtml:link` alternates; a non-localized one is listed once.
 */
export interface SitemapRoute {
  path: string
  localized: boolean
  lastmod?: string | undefined
}

/**
 * A provider of sitemap routes. Feature modules add theirs to
 * `SITEMAP_SOURCES` in `seo/sources.ts`.
 */
export type SitemapSource = () =>
  | readonly SitemapRoute[]
  | Promise<readonly SitemapRoute[]>

/**
 * Source files that change what the home page shows, relative to `apps/site`.
 */
const HOME_SOURCES = [
  'src/components/HomePage.astro',
  'src/home',
  'src/pages/index.astro',
] as const

/**
 * Routes every site has: the localized home page, dated by the newest home
 * source file.
 * @returns The core routes.
 */
export const coreSitemapSource = (): SitemapRoute[] => [
  { path: '/', localized: true, lastmod: lastCommitDate(HOME_SOURCES) },
]

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function lastmodLine(lastmod: string | undefined): string {
  return lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ''
}

function urlBlock(
  loc: string,
  lastmod: string | undefined,
  alternateLines: string,
): string {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmodLine(lastmod)}${alternateLines}  </url>`
}

function alternateLines(path: string): string {
  return hreflangAlternates(path)
    .map(
      ({ hreflang, href }) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>\n`,
    )
    .join('')
}

/**
 * Collects routes from several sources, dropping duplicates by path.
 * @param sources - Route providers.
 * @returns The unique routes in source order, resolved once every source has
 * answered.
 */
export async function collectSitemapRoutes(
  sources: readonly SitemapSource[],
): Promise<SitemapRoute[]> {
  const seen = new Set<string>()
  const lists = await Promise.all(
    sources.map((source) => Promise.resolve(source())),
  )
  return lists.flatMap((routes) =>
    routes.filter((route) => {
      const key = `${String(route.localized)}:${route.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  )
}

/**
 * Renders the XML sitemap.
 * @param routes - Routes to list.
 * @returns A complete `sitemap.xml` document.
 */
export function buildSitemapXml(routes: readonly SitemapRoute[]): string {
  const blocks = routes.flatMap((route) =>
    route.localized
      ? LOCALES.map((locale) =>
          urlBlock(
            localeUrl(locale, route.path),
            route.lastmod,
            alternateLines(route.path),
          ),
        )
      : urlBlock(`${SITE_ORIGIN}${route.path}`, route.lastmod, ''),
  )
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>
`
}
