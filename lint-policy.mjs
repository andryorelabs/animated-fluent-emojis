/**
 * Per-component exceptions to `shadcn/no-restyle` on the site; each entry must
 * say why. Shared by `eslint.config.mjs` and `oxlint.config.ts`.
 *
 * - `TooltipTrigger`: the gallery tile renders its `<button>` through
 *   `TooltipTrigger`'s `render` prop, so the rule attributes the tile's own
 *   chrome (radius, border, padding, hover and pressed states) to the tooltip.
 *   The classes are the tile's, not a restyle of the tooltip.
 */
export const shadcnNoRestyleContracts = [
  {
    pattern: "^TooltipTrigger$",
    allow: [
      "layout",
      "rounded-10",
      "border",
      "border-transparent",
      "p-1",
      "transition-bg-transform",
      "duration-100",
      "ease-(--ease-out-strong)",
      "hover:bg-muted",
      "active:bg-muted",
      "aria-pressed:border-primary",
    ],
  },
];

/**
 * CSS properties `shadcn/no-inline-styles` lets stay inline on the site: only
 * custom properties, which feed values (delays, hues, counts) into
 * stylesheet rules and cannot be expressed as static classes.
 */
export const shadcnAllowedInlineProperties = ["--*"];

/**
 * Classes `shadcn/no-unknown-classes` accepts although Tailwind cannot
 * generate them. Each entry needs a reason.
 */
export const shadcnAllowedUnknownClasses = [
  /**
   * Starlight's own flex helper, defined by its stylesheet rather than by
   * Tailwind.
   */
  "sl-flex",
  /**
   * Hook classes in `home.css` that are only ever used inside compound
   * selectors (descendant, sibling, `:has()`, `:hover`, `[data-*]` and
   * reduced-motion media queries) driving the pillars bento, teaser, FAQ
   * mascot and install-step animations. They cannot be a self-contained
   * `@utility` without changing the cascade.
   */
  "bento-*",
  "teaser-cell",
  "teaser-tile",
  "faq-scope",
  "install-step",
  "step-emoji",
  "sc-demo",
  "sc-item",
  "sc-text",
  "sc-emoji",
  /**
   * Style-less marker on the demo's code sample, asserted by
   * `DemoPlayground.test.tsx`; no CSS is declared for it.
   */
  "demo-code",
  /**
   * Hook classes in `docs-chrome.css` and `docs.css` that restyle Starlight's
   * own markup from outside its cascade layers, so they must stay plain rules
   * instead of `@utility` (which would land inside Tailwind's layers).
   */
  "pagination-nav",
  "pagination-label",
  "pagination-title",
  "translation-notice",
  "edit-link",
];
