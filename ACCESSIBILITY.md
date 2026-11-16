# Accessibility

The goal is for the website and the library to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, in light and dark themes.

## What enforces it

- [`apps/site/e2e/accessibility.spec.ts`](apps/site/e2e/accessibility.spec.ts) runs axe-core on the built site and fails on any violation.
- [`apps/site/e2e/focus-ring.spec.ts`](apps/site/e2e/focus-ring.spec.ts) checks the focus ring.
- [`apps/site/e2e/reduced-motion.spec.ts`](apps/site/e2e/reduced-motion.spec.ts) checks that motion stops when the visitor prefers reduced motion.
- The library rests on a poster frame under `prefers-reduced-motion`; see [behavior](docs/guide/behavior.md).

How to run the checks is in [Development](docs/development.md).

## Known barriers

Axe catches only part of the possible barriers. The suite has no screen reader walkthrough, and no manual audit is on record. No barrier is currently known.

## Report a barrier

Open an issue on the [issue tracker](https://github.com/andryorelabs/animated-fluent-emojis/issues) with the page or component, what you expected and what happened.
