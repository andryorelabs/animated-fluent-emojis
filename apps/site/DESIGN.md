---
name: Animated Fluent Emojis site
description: Light and dark, mint-accented site that stages the animated emojis, inheriting
  the shipped brand kit.
colors:
  background-light: "oklch(0.983 0.003 174.5)"
  background-dark: "oklch(0.194 0.015 180.8)"
  card-light: "oklch(1 0 0)"
  card-dark: "oklch(0.235 0.019 178.6)"
  foreground-light: "oklch(0.228 0.023 176.5)"
  foreground-dark: "oklch(0.959 0.011 176.3)"
  primary: "oklch(0.736 0.132 172.1)"
  primary-text-light: "oklch(0.518 0.097 173.1)"
  muted-foreground-light: "oklch(0.467 0.026 178.2)"
  muted-foreground-dark: "oklch(0.739 0.026 177.3)"
  border-light: "oklch(0.917 0.011 176.3)"
  border-dark: "oklch(0.315 0.026 167.4)"
typography:
  sans:
    fontFamily: "Figtree Variable, sans-serif"
    fontWeight: 400
  headline:
    fontFamily: "Figtree Variable, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.03em"
  mono:
    fontFamily: "Geist Mono Variable, monospace"
    fontWeight: 400
rounded:
  brand: "1rem"
spacing:
  gutter-mobile: "1rem"
  gutter-tablet: "1.5rem"
  gutter-desktop: "2rem"
  header: "65px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "oklch(0.223 0.024 177.2)"
    rounded: "{rounded.brand}"
  card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.brand}"
---

# Design System: Animated Fluent Emojis site

The site inherits the shipped brand kit
([`docs/brand/brief.md`](../../docs/brand/brief.md)); it adds composition rules,
not a new identity. The live token source is
[`docs/brand/tokens.css`](../../docs/brand/tokens.css), imported by
`src/styles/global.css` and mapped to Tailwind in `src/styles/theme.css`. Values
above mirror it; do not redefine them here. The site follows the system theme
(`prefers-color-scheme`) and honors a stored override applied before first paint
by the theme init script, which toggles `.dark` on `<html>`.

## Overview

**Creative North Star: "A cheerful stage."** The emojis are the protagonist; the
page is a calm, rounded stage around them with a personality of its own but
never the loudest thing in view. It is playful in voice, motion and shape and
restrained in color. Anti-references: rainbow palettes, gradients in UI chrome,
a mascot competing with the real emojis, Microsoft or Teams logos, hype copy.

Design boards live in the Website canvas listed in
[`docs/design/README.md`](../../docs/design/README.md). Motion architecture is
decided in [ADR 0021](../../docs/adr/0021-css-scroll-driven-motion.md); this
file describes the visual rules and must agree with it.

## Colors

One accent, Mint (`--primary`), plus neutrals tinted toward it. Everything else
is a neutral step: the ground (`--background`), a card one step above it
(`--card`), muted text for supporting copy and a hairline `--border`.

- The accent fill never carries text in its own color on a light ground. Text
  and links use `--primary-text`, the darker ink; on dark it equals the accent.
- Labels on an accent fill use `--primary-foreground`, never white.
- Muted text is for supporting copy, never for primary claims. Check contrast
  against `--background` before shrinking it; `src/styles/card-contrast.test.ts`
  guards card against ground.
- No rainbow: do not add a second accent. `--destructive` is shadcn's default.

## Typography

Figtree for everything: 800 for the wordmark and headlines, tracked at -0.03em,
and 400 and 500 for text. Geist Mono for code, file names and emoji ids. Fonts
are self-hosted through `@fontsource-variable/*`; the site never requests a
third-party font. Ten locales run at different lengths and CJK needs its own
fallback stack, so no heading or card may rely on a fixed width.

## Layout

One column up to `--site-max-width` (1600px) through the `site-container`
utility, with `--site-gutter` of 1rem on phones, 1.5rem from 640px and 2rem from
1024px. The sticky header is `--site-header-height` (65px) and `html` sets
`scroll-padding-top` from it, so in-page anchors clear the header. Grids
collapse to one column on phones. Nothing relies on a fixed width.

## Elevation & Depth

Flat and tonal. Depth is a card one step lighter than the ground plus a 1px
`--border`; shadows are rare and soft. The sticky header fades a blurred
background surface in over the first 64px of scroll, so it reads as part of the
page at the top.

## Shapes

Rounded and chubby, matching the Sticker mark. `--radius` is 1rem and the
Tailwind radii scale from it (`rounded-lg` to `rounded-4xl`), so a control, a
card and a panel share one family. Avoid sharp corners and avoid mixing radii
inside one component.

## Components

UI primitives come from `src/components/ui`: shadcn on Base UI
([ADR 0019](../../docs/adr/0019-shadcn-on-base-ui-for-the-website.md)). Add them
with `bunx shadcn@latest add <name>`, never hand-roll them. In static `.astro`
files use `buttonVariants` rather than repeating classes.

- **Buttons**: the primary button is a Mint fill with `--primary-foreground`
  text. Pressing scales slightly over `--duration-press`.
- **Cards and panels**: `--card` on `--background` with a hairline border.
- **Tabs**: Base UI tabs with the `tab-pill` sliding indicator.
- **Code blocks**: highlighted at build time
  ([ADR 0020](../../docs/adr/0020-build-time-code-highlighting.md)); a copy
  control plays the `burst` particles.
- **Emojis**: rendered with the library's own Astro adapter, with an `alt`, a
  still poster under reduced motion and a held layout while loading.

## Motion

Playful and short, defined in `src/styles/global.css`. Easing and duration
tokens (`--ease-out-strong`, `--ease-in-out-strong`, `--duration-press`,
`--duration-popover`, `--duration-sheet`) are the only curves in use. Scroll
reveals are CSS view timelines, not JavaScript observers.

- Every moving rule is gated by `prefers-reduced-motion: no-preference` and, for
  scroll timelines, `@supports (animation-timeline: view())`. Everyone else gets
  a static, fully visible page.
- Set `animation-*` longhands only; Lightning CSS folds `animation-timeline`
  into the shorthand and CI's Chromium rejects it.
- Animate `transform` and `opacity` only.
- Navigation uses cross-document view transitions, and a theme change
  cross-fades for 250ms through a same-document view transition.
- Rules and verification steps:
  [`docs/development.md#scroll-driven-motion`](../../docs/development.md#scroll-driven-motion)
  and
  [`#landing-motion-utilities`](../../docs/development.md#landing-motion-utilities).

## Do's and Don'ts

Do:

- Let the emojis carry the color and the scene.
- Use the single Mint accent and `--primary-text` for text on light grounds.
- Reflow for every locale, in both themes, with and without motion.
- Add UI through `src/components/ui` and tokens through `docs/brand/tokens.css`.

Don't:

- Add a second accent, a gradient in UI chrome or a decorative mascot.
- Put white text on the Mint fill or Mint text on a light ground.
- Use `outline: none` without a replacement focus style.
- Load third-party scripts, fonts or embeds, or add analytics.
- Show Microsoft, Teams or Fluent logos, or call the project official.
