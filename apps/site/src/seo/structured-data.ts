import { localeUrl, SITE_ORIGIN, type Locale } from '../i18n/locales'
import { AUTHOR_NAME, AUTHOR_URL, NPM_URL, REPOSITORY_URL } from '../site-links'

const ESCAPED_ANGLE_BRACKET = `${String.fromCodePoint(92)}u003c`
const PACKAGE_NAME = 'animated-fluent-emojis'

/**
 * One step of a breadcrumb trail, below the home page.
 */
export interface Breadcrumb {
  name: string
  path: string
}

/**
 * Facts a page feeds into its structured data.
 */
export interface StructuredDataInput {
  locale: Locale
  siteName: string
  title: string
  description: string
  path: string
  trail?: readonly Breadcrumb[] | undefined
}

/**
 * One schema.org `@graph` for a page: the `WebSite`, the `WebPage` that is
 * part of it, the npm package as `SoftwareSourceCode`, the author `Person`
 * and, below the home page, a `BreadcrumbList`. The site, package and author
 * nodes share one `@id` across every locale and page.
 * @param input - The page's locale, text, path and breadcrumb trail.
 * @returns A JSON-LD object ready to serialise.
 */
export function buildStructuredData(
  input: StructuredDataInput,
): Record<string, unknown> {
  const pageUrl = localeUrl(input.locale, input.path)
  const websiteId = `${SITE_ORIGIN}/#website`
  const packageId = `${SITE_ORIGIN}/#package`
  const authorId = `${SITE_ORIGIN}/#author`
  const isHome = input.path === '/'
  const crumbs = [
    { name: input.siteName, path: '/' },
    ...(input.trail ?? []),
  ].map(({ name, path }, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name,
    item: localeUrl(input.locale, path),
  }))
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: input.siteName,
        url: `${SITE_ORIGIN}/`,
        publisher: { '@id': authorId },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: input.title,
        description: input.description,
        inLanguage: input.locale,
        isPartOf: { '@id': websiteId },
        about: { '@id': packageId },
        ...(!isHome && { breadcrumb: { '@id': `${pageUrl}#breadcrumb` } }),
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': packageId,
        name: PACKAGE_NAME,
        description: input.description,
        url: NPM_URL,
        codeRepository: REPOSITORY_URL,
        sameAs: [NPM_URL, REPOSITORY_URL],
        programmingLanguage: 'TypeScript',
        license: 'https://opensource.org/license/mit',
        author: { '@id': authorId },
      },
      {
        '@type': 'Person',
        '@id': authorId,
        name: AUTHOR_NAME,
        url: AUTHOR_URL,
        sameAs: [AUTHOR_URL],
      },
      ...(isHome
        ? []
        : [
            {
              '@type': 'BreadcrumbList',
              '@id': `${pageUrl}#breadcrumb`,
              itemListElement: crumbs,
            },
          ]),
    ],
  }
}

/**
 * Serialises JSON-LD for an inline `<script type="application/ld+json">`,
 * escaping `<` so page text can never close the script element.
 * @param data - The JSON-LD object.
 * @returns The script body.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replaceAll('<', () => ESCAPED_ANGLE_BRACKET)
}
