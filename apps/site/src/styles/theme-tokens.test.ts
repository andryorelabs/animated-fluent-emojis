import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

type Fidelity = "exact" | "computed";

type Mapping = readonly [arbitrary: string, replacement: string, fidelity?: Fidelity];

const MAPPINGS: readonly Mapping[] = [
  ["text-[13px]", "text-meta"],
  ["text-[10px]", "text-micro"],
  ["text-[11px]", "text-caption"],
  ["text-[0.8rem]", "text-compact"],
  ["text-[32px]", "text-heading-sm"],
  ["text-[40px]", "text-heading-md"],
  ["text-[clamp(28px,8vw,40px)]", "text-fluid-title"],
  ["text-[clamp(28px,5vw,44px)]", "text-fluid-closing"],
  ["text-[clamp(38px,7.4vw,84px)]", "text-fluid-hero"],
  [
    "text-[color-mix(in_oklab,var(--color-primary)_55%,var(--color-foreground))]",
    "text-primary-emphasis",
    "computed",
  ],
  [
    "hover:border-[color-mix(in_oklab,var(--primary)_45%,var(--border))]",
    "hover:border-primary-edge",
  ],
  [
    "[@media(hover:hover)_and_(pointer:fine)]:hover:border-[color-mix(in_oklab,var(--primary)_45%,var(--border))]",
    "hover-fine:hover:border-primary-edge",
  ],
  ["tracking-[0.08em]", "tracking-label"],
  ["tracking-[0.12em]", "tracking-label-wide"],
  ["tracking-[-0.04em]", "tracking-display"],
  ["tracking-[-0.03em]", "tracking-heading"],
  ["tracking-[-0.02em]", "tracking-stat"],
  ["leading-[0.98]", "leading-display"],
  ["leading-[1.1]", "leading-stat"],
  ["rounded-[7px]", "rounded-7"],
  ["rounded-[9px]", "rounded-9"],
  ["rounded-[10px]", "rounded-10"],
  ["rounded-[14px]", "rounded-14"],
  ["rounded-[18px]", "rounded-18"],
  ["rounded-[22px]", "rounded-22"],
  ["rounded-[28px]", "rounded-28"],
  ["rounded-[min(var(--radius-md),12px)]", "rounded-toggle", "computed"],
  ["blur-[4px]", "blur-xs", "computed"],
  ["blur-[2px]", "blur-2xs"],
  ["ease-[cubic-bezier(.2,1.4,.4,1)]", "ease-spring"],
  ["ease-[ease]", "ease-native"],
  ["active:scale-[0.97]", "active:scale-97", "computed"],
  ["active:scale-[0.96]", "active:scale-96", "computed"],
  ["motion-safe:active:scale-[.94]", "motion-safe:active:scale-94", "computed"],
  ["scale-[0.96]", "scale-96", "computed"],
  ["scale-[1.35]", "scale-135", "computed"],
  ["rotate-[10deg]", "rotate-10", "computed"],
  ["-rotate-[10deg]", "-rotate-10", "computed"],
  ["-rotate-[8deg]", "-rotate-8", "computed"],
  ["z-[60]", "z-60"],
  ["focus-visible:ring-[3px]", "focus-visible:ring-3"],
  [
    "transition-[color,background-color,border-color,box-shadow]",
    "transition-color-bg-border-shadow",
  ],
  [
    "transition-[color,background-color,border-color,box-shadow,scale]",
    "transition-color-bg-border-shadow-scale",
  ],
  [
    "transition-[color,background-color,border-color,box-shadow,filter,scale]",
    "transition-color-bg-border-shadow-filter-scale",
  ],
  ["transition-[color,background-color,scale]", "transition-color-bg-scale"],
  ["transition-[transform,color,background-color]", "transition-transform-color-bg"],
  ["transition-[background-color,transform]", "transition-bg-transform"],
  ["transition-[opacity,translate]", "transition-opacity-translate"],
  ["transition-[opacity,translate,visibility]", "transition-opacity-translate-visibility"],
  ["transition-[opacity,scale]", "transition-opacity-scale"],
  ["transition-[opacity,scale,filter]", "transition-opacity-scale-filter"],
  ["transition-[opacity,transform]", "transition-opacity-transform"],
  ["transition-[transform,opacity]", "transition-transform-opacity"],
  ["transition-[scale,rotate]", "transition-scale-rotate"],
  ["transition-[height]", "transition-height"],
  ["transition-[rotate]", "transition-rotate"],
  ["transition-[opacity]", "transition-opacity"],
  ["[transition-duration:200ms,150ms]", "durations-200-150"],
  ["[transition-duration:200ms,200ms,120ms]", "durations-200-200-120"],
  ["[scrollbar-width:none]", "scrollbar-none"],
  ["[scrollbar-width:thin]", "scrollbar-thin"],
  ["[scrollbar-color:var(--border)_transparent]", "scrollbar-subtle"],
  ["[-webkit-touch-callout:none]", "touch-callout-none"],
  ["[zoom:0.55]", "zoom-55", "computed"],
  ['before:content-[""]', "before:content-empty", "computed"],
  ["[mask-image:linear-gradient(to_right,#000_calc(100%-20px),transparent)]", "mask-fade-end"],
  [
    "[background-image:radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)]",
    "bg-glow-hero",
  ],
  [
    "[background-image:radial-gradient(circle_at_40%_50%,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_70%)]",
    "bg-glow-faq",
  ],
  [
    "bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_70%)]",
    "bg-glow-install",
  ],
  [
    "bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]",
    "bg-glow-demo",
  ],
  [
    "[background:radial-gradient(60%_90%_at_50%_100%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)]",
    "bg-glow-closing",
  ],
  ["[background-image:radial-gradient(var(--border)_1px,transparent_1px)]", "bg-dots-border"],
  [
    "[background-image:radial-gradient(var(--muted-foreground)_1px,transparent_1px)]",
    "bg-dots-muted",
  ],
  ["[background-image:conic-gradient(#d4d4d4_25%,#fff_0_50%,#d4d4d4_0_75%,#fff_0)]", "bg-checker"],
  ["[background-size:6px_6px]", "bg-grid-6"],
  ["[background-size:10px_10px]", "bg-grid-10"],
  ["[background-size:16px_16px]", "bg-grid-16"],
  ["grid-cols-[1fr_auto_1fr]", "grid-cols-balanced"],
  ["grid-cols-[1.25fr_1fr]", "grid-cols-faq"],
  ["grid-cols-[1.6fr_1fr]", "grid-cols-pillars"],
  ["grid-cols-[1fr_1.2fr]", "grid-cols-demo"],
  ["grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]", "grid-cols-install"],
  ["grid-cols-[200px_minmax(0,1fr)_auto]", "grid-cols-sheet"],
  ["grid-cols-[240px_1fr]", "grid-cols-sidebar"],
  ["grid-cols-[minmax(0,1fr)]", "grid-cols-1", "computed"],
  ["grid-cols-[repeat(auto-fill,minmax(96px,1fr))]", "grid-cols-fill-96", "computed"],
  ["grid-cols-[repeat(auto-fill,minmax(128px,1fr))]", "grid-cols-fill-128", "computed"],
  ["grid-cols-[repeat(auto-fill,minmax(160px,1fr))]", "grid-cols-fill-160", "computed"],
  ["grid-rows-[auto_1fr]", "grid-rows-auto-fr"],
  ["left-[17%]", "left-pct-17", "computed"],
  ["left-[19%]", "left-pct-19", "computed"],
  ["left-[4%]", "left-pct-4", "computed"],
  ["left-[44%]", "left-pct-44", "computed"],
  ["right-[17%]", "right-pct-17", "computed"],
  ["right-[18%]", "right-pct-18", "computed"],
  ["right-[4%]", "right-pct-4", "computed"],
  ["max-h-[80dvh]", "max-h-dvh-80", "computed"],
  ["pb-[calc(1rem+env(safe-area-inset-bottom,0px))]", "pb-safe-4", "computed"],
  ["pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]", "pb-safe-5", "computed"],
  ["bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]", "bottom-safe-4", "computed"],
  ["translate-y-[calc(100%+1rem)]", "translate-y-toast-offset"],
  ["min-[860px]:flex", "split:flex"],
  ["min-[860px]:grid-cols-[1.25fr_1fr]", "split:grid-cols-faq"],
  ["max-[859px]:[zoom:0.55]", "max-narrow:zoom-55", "computed"],
  ["min-[640px]:flex", "sm-px:flex"],
  ["min-[560px]:grid-cols-4", "stats:grid-cols-4"],
  ["min-[480px]:not-sr-only", "xs:not-sr-only"],
  ["max-[480px]:sr-only", "max-xs:sr-only"],
  ...SPACING_MAPPINGS(),
];

function SPACING_MAPPINGS(): Mapping[] {
  const pixelsByUtility: Record<string, readonly number[]> = {
    "top-": [3, 14, 34, 38, 72, 92, 110],
    "left-": [-34, 3],
    "right-": [-36, -8],
    "bottom-": [-30, 18],
    "h-": [26, 152, 220, 248],
    "min-h-": [300, 320, 340, 560],
    "min-w-": [168],
    "w-": [220, 506],
    "size-": [34, 58, 62, 76, 86, 92, 96, 104, 110, 132, 170],
    "px-": [11, 18],
    "py-": [3, 5, 72],
    "p-": [3],
    "pt-": [22, 170],
    "pr-": [26],
    "gap-": [26],
    "-inset-y-": [11],
  };
  const rows: Mapping[] = [];
  for (const [utility, values] of Object.entries(pixelsByUtility)) {
    for (const pixels of values) {
      const replacementStem = pixels < 0 ? `-${utility}` : utility;
      rows.push([
        `${utility}[${String(pixels)}px]`,
        `${replacementStem}${String(Math.abs(pixels) / 4)}`,
        "computed",
      ]);
    }
  }
  rows.push(
    ["h-[440px]", "h-110", "computed"],
    ["md:py-[72px]", "md:py-18", "computed"],
    ["md:min-h-[340px]", "md:min-h-85", "computed"],
  );
  return rows;
}

const ENTRY_STYLESHEET = `
@import 'tailwindcss';
@import './theme.css';
@import './utilities.css';
@custom-variant dark (&:where(.dark, .dark *));
`;

const stylesDirectory = path.dirname(fileURLToPath(import.meta.url));
const requireFromSite = createRequire(import.meta.url);

function readStylesheet(file: string, base: string) {
  return {
    path: file,
    base,
    content: file.includes("/") ? readFileSync(file, "utf8") : "",
  };
}

function loadStylesheet(id: string, base: string) {
  if (id === "tailwindcss") {
    const file = requireFromSite.resolve("tailwindcss/index.css");
    return Promise.resolve(readStylesheet(file, path.dirname(file)));
  }
  if (id.startsWith(".")) {
    const file = path.resolve(base, id);
    return Promise.resolve(readStylesheet(file, path.dirname(file)));
  }
  return Promise.resolve({ path: id, base, content: "" });
}

function utilityBody(css: string, candidate: string): string {
  const withoutProperties = css
    .replaceAll(/@property[^{]+\{[^}]*\}/g, "")
    .replace(/@layer properties \{[\s\S]*?\n\}\n/, "");
  const layer = /@layer utilities \{\n([\s\S]*?)\n\}\n/.exec(withoutProperties);
  const body = layer?.[1] ?? "";
  const escaped = candidate.replaceAll(/[^\w-]/g, (character) => `\\${character}`);
  return body
    .replaceAll(escaped, "CLASS")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s*([,:(){};])\s*/g, "$1")
    .replaceAll(/(^|[^\d])0\./g, "$1.")
    .trim();
}

async function buildCandidate(candidate: string): Promise<string> {
  const compiler = await compile(ENTRY_STYLESHEET, {
    base: stylesDirectory,
    loadStylesheet,
  });
  return utilityBody(compiler.build([candidate]), candidate);
}

function rowsWithFidelity(fidelity: Fidelity) {
  return MAPPINGS.filter((row) => (row[2] ?? "exact") === fidelity).map(
    ([arbitrary, replacement]) => ({ arbitrary, replacement }),
  );
}

describe("theme tokens and utilities for arbitrary values", () => {
  it.each(["global.css", "docs.css"])(
    "is imported by the %s entry stylesheet",
    (entryStylesheet) => {
      const entryCss = readFileSync(path.resolve(stylesDirectory, entryStylesheet), "utf8");
      expect(entryCss).toContain('@import "./utilities.css";');
    },
  );

  it.each(rowsWithFidelity("exact"))(
    "$arbitrary renders exactly like $replacement",
    async ({ arbitrary, replacement }) => {
      const replacementBody = await buildCandidate(replacement);
      const arbitraryBody = await buildCandidate(arbitrary);
      expect(replacementBody).not.toBe("");
      expect(replacementBody).toBe(arbitraryBody);
    },
  );

  it.each(rowsWithFidelity("computed"))(
    "$replacement is a real utility equivalent to $arbitrary",
    async ({ replacement }) => {
      expect(await buildCandidate(replacement)).not.toBe("");
    },
  );
});
