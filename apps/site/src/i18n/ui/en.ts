/**
 * English UI strings, the source of truth for every locale's keys. The other
 * locale files are typed against this shape.
 */
export const en = {
  meta: {
    siteName: "Animated Fluent Emojis",
    description:
      "Microsoft Fluent animated emojis for the web, as a library for React, Vue, Svelte, Astro and plain HTML.",
  },
  common: {
    opensInNewTab: "opens in a new tab",
  },
  header: {
    skipLink: "Skip to content",
    homeLabel: "Animated Fluent Emojis, home",
    navLabel: "Main",
    menu: "Menu",
    nav: {
      gallery: "Gallery",
      docs: "Docs",
      github: "GitHub",
    },
    languageLabel: "Language",
    themeLabel: "Theme",
    theme: {
      system: "System",
      light: "Light",
      dark: "Dark",
    },
  },
  footer: {
    builtBy: "Built by {name}",
    attribution:
      "The emoji artwork is Microsoft's. The code is open source. Not affiliated with or endorsed by Microsoft.",
    navLabel: "Footer",
    links: {
      gallery: "Gallery",
      docs: "Docs",
      github: "GitHub",
      npm: "npm",
    },
  },
  home: {
    title: "Animated Fluent Emojis",
    tagline: "Fluent emojis, but they move.",
    hero: {
      badge: "Microsoft's Fluent emoji, now in motion",
      titleLead: "Emojis that move,",
      titleAccent: "on any site.",
      subtitle:
        "Drop in one tag and your page gets 3D animated emoji. No layout shift, no heavy runtime, and they stay still if someone asks for less motion.",
      ctaDocs: "Read the docs",
      ctaGallery: "Browse the gallery",
      ready: {
        react: "React",
        vue: "Vue",
        svelte: "Svelte",
        astro: "Astro",
        html: "HTML",
        status: "ready",
      },
      sub: "Hover it. It waves back.",
      installLabel: "Install command",
      copy: "Copy",
      copied: "Copied",
      eyebrow: "Open source",
      docs: "Read the docs",
      browse: "Browse the emojis",
      attribution:
        "The emoji artwork is Microsoft's. Not affiliated with or endorsed by Microsoft.",
    },
    demo: {
      sizeLabel: "Size",
      toneLabel: "Skin tone",
      playsLabel: "Plays",
      emojiLabel: "Emoji",
      reset: "Reset",
      emojis: {
        wave: "Waving hand",
        fire: "Fire",
        party: "Party popper",
        heart: "Red heart",
        rocket: "Rocket",
        grin: "Grinning face",
      },
      tones: {
        default: "Default",
        light: "Light",
        medium: "Medium",
        dark: "Dark",
      },
      plays: {
        hover: "On hover",
        hoverTap: "Hover / tap",
        load: "On load",
        loop: "Loop",
      },
    },
    pillars: {
      eyebrow: "Features",
      title: "Made to be easy to live with",
      alive: {
        title: "Alive",
        body: "They wave back. Hover one and see.",
      },
      light: {
        title: "Light",
        body: "They never push your page around while they load.",
      },
      considerate: {
        title: "Considerate",
        body: "If someone asks their device for less motion, the emoji stays still.",
      },
      credit: {
        title: "Clear about what is whose",
        body: "The emoji artwork is Microsoft's. The code is open source.",
      },
    },
    snippets: {
      title: "One tag, any site",
      body: "Pick your framework, copy the code, and the emoji is on the page.",
      tabsLabel: "Framework",
      copy: "Copy code",
      copied: "Copied",
    },
    stats: {
      emojis: "animated emojis",
      adapters: "adapters, one tag",
      languages: "site languages",
      license: "open source code",
    },
    playground: {
      eyebrow: "Playground",
      title: "Same emoji, your style",
      body: "Pick an emoji, a size and when it plays. The snippet updates with it.",
    },
    bento: {
      eyebrow: "Features",
      title: "Made to be easy to live with",
      alive: {
        title: "Alive",
        body: "They wave back. Hover one and see.",
      },
      light: {
        title: "Light",
        body: "They never push your page around while they load.",
      },
      considerate: {
        title: "Considerate",
        body: "If someone asks their device for less motion, the emoji stays still.",
      },
      credit: {
        title: "Clear about what is whose",
        body: "The emoji artwork is Microsoft's. The code is open source.",
      },
      layoutShift: "layout shift: 0 px",
      reduceMotion: {
        off: "Reduce motion: off",
        on: "Reduce motion: on",
      },
      artwork: {
        label: "Artwork",
        value: "© Microsoft",
      },
      code: {
        label: "Code",
        value: "MIT · open source",
      },
    },
    teaser: {
      eyebrow: "Gallery",
      title: "Pick one, it's already moving",
      cta: "Open the gallery",
    },
    install: {
      eyebrow: "Install",
      title: "One tag, any site",
      body: "Pick your framework, copy the code, and the emoji is on the page.",
      stepLabels: {
        install: "Install",
        import: "Import",
        use: "Use",
      },
      steps: {
        shortcodes: {
          title: "Shortcodes",
          body: "Use the emoji id, or the id without its code-point prefix. No new names to learn.",
        },
      },
      architecture: {
        title: "How it fits",
        core: "Emoji data",
      },
    },
    closing: {
      titleLead: "Start shipping emojis",
      titleAccent: "in minutes.",
      body: "Open source, MIT licensed, one tag.",
      cta: "View on GitHub",
    },
    dock: {
      label: "Install command",
      copy: "Copy",
      copied: "Copied",
      tabsLabel: "Framework",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions",
      mascotLabel: "answer",
      chat: {
        question: "Can I use these in a chat or a document?",
        answer:
          "Yes. Download the emoji as a GIF, an animated WebP or a still PNG from the gallery, then add it to your message or file like any picture.",
      },
      speed: {
        question: "Will they slow my page down?",
        answer:
          "No. Each emoji holds its space while it loads, so nothing jumps, and the animation files are only fetched when an emoji is shown.",
      },
      motion: {
        question: "What happens if someone prefers less motion?",
        answer:
          "The emoji stays still on its first frame. It never moves unless the visitor has left motion switched on.",
      },
    },
  },
  docs: {
    guideGroup: "Guide",
    helpGroup: "Help",
    howToGroup: "How-to guides",
    changelogLabel: "Changelog",
    copyMarkdown: "Copy page as Markdown",
    copiedMarkdown: "Copied",
    search: {
      hint: "Type to search the docs",
      devTitle: "Search needs a build",
      devBody: "Search runs on a built site. Run a build and preview it to try it.",
    },
    notices: {
      missing: "This page is not available in your language yet. Showing the English version.",
      stale: "The translation of this page is out of date. Showing the English version.",
    },
  },
  gallery: {
    title: "Emoji gallery",
    description:
      "Search the animated Fluent emojis, pick a skin tone and copy the code for React, Vue, Svelte, Astro or plain HTML.",
    searchLabel: "Search emojis",
    searchPlaceholder: "Search {count} emojis, like “fire” or “wave”",
    categoryLabel: "Category",
    categoryAll: "All",
    toneLabel: "Skin tone",
    toneDefault: "Default",
    toneLight: "Light",
    toneMediumLight: "Medium light",
    toneMedium: "Medium",
    toneMediumDark: "Medium dark",
    toneDark: "Dark",
    noSkinTones: "No skin tones",
    sizeLabel: "Size",
    resultsLabel: "Emojis",
    resultsCount: "{count} emojis",
    showMore: "Show more",
    detailLabel: "Emoji details",
    detailEmpty: "Select an emoji to see its code.",
    closeDetail: "Close",
    idLabel: "ID",
    snippetLabel: "Code",
    tabReact: "React",
    tabVue: "Vue",
    tabSvelte: "Svelte",
    tabAstro: "Astro",
    tabHtml: "HTML",
    tabNoCode: "No code",
    copySnippet: "Copy snippet",
    copyId: "Copy id",
    copyName: "Copy name",
    zoomLabel: "Zoom",
    keywordsLabel: "Keywords",
    openPage: "Open page",
    snippetMenuLabel: "More snippet formats",
    copySnippetAs: "Copy {adapter}",
    filesError: "The files could not load.",
    fileActionGroupDownload: "Download",
    fileActionGroupCopy: "Copy URL",
    fileActionKindAnimated: "animated",
    fileActionKindStill: "still",
    fileActionMenuLabel: "More file actions",
    fileActionDownloadWebp: "Download WebP",
    fileActionDownloadGif: "Download GIF",
    fileActionDownloadPng: "Download PNG",
    fileActionCopyWebp: "Copy WebP URL",
    fileActionCopyGif: "Copy GIF URL",
    fileActionCopyPng: "Copy PNG URL",
    fileActionCopiedUrl: "Copied {format} URL",
    downloadFailed: "The download failed. Try again.",
    copied: "Copied",
    noResultsTitle: "No emoji matches “{query}”",
    noResultsHint: "Check the spelling or try a shorter word.",
    clearSearch: "Clear search",
    errorTitle: "The emoji list could not load.",
    errorHint: "Check your connection and try again. The docs and the rest of the site still work.",
    retry: "Try again",
    loading: "Loading emojis",
    filtersButton: "Filters",
    customizeTitle: "Customize",
    backgroundLabel: "Background",
    backgroundDots: "Dots",
    backgroundLight: "Light",
    backgroundDark: "Dark",
    backgroundChecker: "Checkerboard",
    playAnimation: "Play animation",
    pauseAnimation: "Pause animation",
  },
  emojiPage: {
    title: "{name}, animated emoji · Animated Fluent Emojis",
    description:
      "The animated {name} emoji from Microsoft Fluent. Copy the code for React, Vue, Svelte, Astro or HTML, or download it as a GIF, WebP or PNG.",
    breadcrumbLabel: "Breadcrumb",
    breadcrumbHome: "Home",
    breadcrumbEmojis: "Emojis",
    keywordsLabel: "Keywords",
    relatedTitle: "Related emojis",
    keywordsMore: "+{count} more",
    keywordsLess: "Show less",
    copyEmoji: "Copy emoji",
    codePointLabel: "Code point",
    navigationLabel: "Emoji navigation",
    previousEmoji: "Previous emoji: {name}",
    nextEmoji: "Next emoji: {name}",
  },
  notFound: {
    title: "That page isn't here.",
    body: "The link may be old, or the emoji may have moved.",
    home: "Go home",
    gallery: "Browse the emojis",
  },
} as const;

type Widen<T> = T extends string ? string : { -readonly [Key in keyof T]: Widen<T[Key]> };

/**
 * Shape every locale's UI strings must satisfy, taken from English.
 */
export type UiStrings = Widen<typeof en>;
