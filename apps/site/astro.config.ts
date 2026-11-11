import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

import { CHANGELOG_SLUG } from "./src/docs/changelog-pages";
import { docSlug, PUBLISHED_DOCS } from "./src/docs/published";
import { collectStarlightInlineScriptHashes } from "./src/docs/starlight-inline-hashes";
import { sharedCodeConfig } from "./src/highlight/code-config";
import { LOCALE_NAMES, LOCALES, localeSegment, SITE_ORIGIN, type Locale } from "./src/i18n/locales";
import { getUi } from "./src/i18n/ui";
import { interactionDirective } from "./src/scripts/interaction-integration";
import { THEME_INIT_HASH } from "./src/scripts/theme-init";
import { THEME_COLORS } from "./src/scripts/theme-keys";
import { composedLlmsFiles } from "./src/seo/llms-integration";
import { REPOSITORY_URL } from "./src/site-links";

const CDN_ORIGIN = "https://animated-fluent-emojis-cdn.andryore.dev";
const FILES_ORIGIN = "https://animated-fluent-emojis-files.andryore.dev";

function localized(pick: (locale: Locale) => string): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [localeSegment(locale), pick(locale)]));
}

const starlightLocales = Object.fromEntries(
  LOCALES.map((locale) => [
    locale === "en" ? "root" : localeSegment(locale),
    { label: LOCALE_NAMES[locale], lang: locale },
  ]),
);

const { meta } = getUi("en");

const guideItems = PUBLISHED_DOCS.filter(
  (docPath) => docPath === "usage.md" || docPath.startsWith("guide/"),
).map((docPath) => ({ slug: docSlug(docPath) }));

const howToItems = PUBLISHED_DOCS.filter((docPath) => docPath.startsWith("how-to/")).map(
  (docPath) => ({ slug: docSlug(docPath) }),
);

export default defineConfig({
  site: SITE_ORIGIN,
  trailingSlash: "always",
  build: { concurrency: 4 },
  security: {
    csp: {
      scriptDirective: {
        resources: ["'self'", "'wasm-unsafe-eval'"],
        hashes: [THEME_INIT_HASH, ...collectStarlightInlineScriptHashes()],
      },
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      directives: [
        "default-src 'none'",
        `img-src 'self' data: ${CDN_ORIGIN} ${FILES_ORIGIN}`,
        "font-src 'self'",
        `connect-src 'self' ${CDN_ORIGIN} ${FILES_ORIGIN}`,
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
  integrations: [
    react(),
    interactionDirective(),
    starlight({
      title: meta.siteName,
      description: meta.description,
      disable404Route: true,
      defaultLocale: "root",
      locales: starlightLocales,
      customCss: ["./src/styles/docs.css"],
      expressiveCode: {
        ...sharedCodeConfig,
        themes: [...sharedCodeConfig.themes],
        plugins: [...sharedCodeConfig.plugins],
        useStarlightDarkModeSwitch: false,
        useStarlightUiThemeColors: false,
      },
      editLink: { baseUrl: `${REPOSITORY_URL}/edit/main/` },
      lastUpdated: false,
      favicon: "/favicon.svg",
      head: [
        {
          tag: "meta",
          attrs: {
            name: "theme-color",
            media: "(prefers-color-scheme: light)",
            content: THEME_COLORS.light,
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "theme-color",
            media: "(prefers-color-scheme: dark)",
            content: THEME_COLORS.dark,
          },
        },
        {
          tag: "link",
          attrs: { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
        },
        {
          tag: "link",
          attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        },
        {
          tag: "link",
          attrs: { rel: "manifest", href: "/manifest.webmanifest" },
        },
      ],
      routeMiddleware: "./src/docs/route-metadata.ts",
      components: {
        EditLink: "./src/docs/components/DocumentationEditLink.astro",
        Footer: "./src/docs/components/DocumentationFooter.astro",
        Header: "./src/docs/components/DocumentationHeader.astro",
        Pagination: "./src/docs/components/DocumentationPagination.astro",
        PageTitle: "./src/docs/components/DocumentationPageTitle.astro",
        ThemeProvider: "./src/docs/components/DocumentationThemeProvider.astro",
        ThemeSelect: "./src/docs/components/DocumentationThemeSelect.astro",
      },
      sidebar: [
        {
          label: getUi("en").docs.guideGroup,
          translations: localized((locale) => getUi(locale).docs.guideGroup),
          items: guideItems,
        },
        {
          label: getUi("en").docs.helpGroup,
          translations: localized((locale) => getUi(locale).docs.helpGroup),
          items: [{ slug: docSlug("troubleshooting.md") }],
        },
        {
          label: getUi("en").docs.howToGroup,
          translations: localized((locale) => getUi(locale).docs.howToGroup),
          items: howToItems,
        },
        {
          label: getUi("en").docs.changelogLabel,
          translations: localized((locale) => getUi(locale).docs.changelogLabel),
          slug: CHANGELOG_SLUG,
        },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: meta.siteName,
          description: meta.description,
        }),
      ],
    }),
    composedLlmsFiles(),
  ],
  vite: { plugins: [tailwindcss()] },
});
