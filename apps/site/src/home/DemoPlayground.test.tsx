import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import type { CodeBlockTab } from "@/components/CodeBlock";

import publicIndexFixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../gallery/public-index";
import { SNIPPET_TABS } from "./content";
import { INITIAL_DEMO_STATE, type DemoTabs } from "./demo";
import DemoPlayground from "./DemoPlayground";

const emojis = parsePublicIndex(publicIndexFixture);
const wave = emojis.find((emoji) => emoji.id === "1f44b_wavinghand");
if (!wave) throw new Error("fixture needs the waving hand");

const tabsFor = (play: string, variant: string): CodeBlockTab[] =>
  SNIPPET_TABS.map((tab) => ({
    id: tab.kind,
    label: tab.label,
    code: tab.kind,
    html: `<div class="ec-line">${tab.kind}-${play}-${variant}</div>`,
  }));

const tabs: DemoTabs = {
  hover: { plain: tabsFor("hover", "plain"), toned: tabsFor("hover", "toned") },
  load: { plain: tabsFor("load", "plain"), toned: tabsFor("load", "toned") },
  loop: { plain: tabsFor("loop", "plain"), toned: tabsFor("loop", "toned") },
};

const labels = {
  emojiLabel: "Emoji",
  sizeLabel: "Size",
  toneLabel: "Skin tone",
  playsLabel: "Plays",
  reset: "Reset",
  emojis: {
    wave: "Waving hand",
    fire: "Fire",
    party: "Party popper",
    heart: "Red heart",
    rocket: "Rocket",
    grin: "Grinning face",
  },
  tones: { default: "Default", light: "Light", medium: "Medium", dark: "Dark" },
  plays: {
    hover: "On hover",
    hoverTap: "Hover / tap",
    load: "On load",
    loop: "Loop",
  },
  code: { tabsLabel: "Framework", copy: "Copy", copied: "Copied" },
};

test("the customizer starts untouched, so Reset is disabled", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  expect(html).toMatch(/<button[^>]*disabled[^>]*>.*?Reset/s);
  expect(html).toContain('aria-label="Skin tone"');
  expect(html).toContain('aria-label="Framework"');
  expect(html).toContain('aria-label="Waving hand"');
});

test("each skin tone option has a decorative color dot before its label", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  for (const color of ["#feba46", "#fac7b4", "#b3867a", "#533938"]) {
    expect(html.toLowerCase()).toContain(`--tone-color:${color}`);
  }
  expect(html).toMatch(/aria-hidden="true"[^>]*><\/span>Light/);
});

test("the stage is a fixed-height card on mobile and the code block sits in the demo wrapper", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  expect(html).toContain("h-55");
  expect(html).not.toContain("h-[260px]");
  expect(html).toMatch(/class="demo-code[^"]*"/);
});

test("offers On hover, On load and Loop as plays", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  for (const text of ["On hover", "On load", "Loop"]) {
    expect(html).toContain(text);
  }
});

const render = (play: "hover" | "load" | "loop", tone: "default" | "dark") =>
  renderToString(
    <DemoPlayground
      emojis={[wave]}
      tabs={tabs}
      labels={labels}
      initialState={{ ...INITIAL_DEMO_STATE, play, tone }}
    />,
  );

test("the code block shows the highlighted tabs of the selected play", () => {
  expect(render("hover", "default")).toContain("react-hover-plain");
  expect(render("load", "default")).toContain("react-load-plain");
  expect(render("loop", "default")).toContain("react-loop-plain");
  expect(render("loop", "dark")).toContain("react-loop-toned");
});

test("selecting Loop marks the demo as changed, so Reset is enabled", () => {
  const html = renderToString(
    <DemoPlayground
      emojis={[wave]}
      tabs={tabs}
      labels={labels}
      initialState={{ ...INITIAL_DEMO_STATE, play: "loop" }}
    />,
  );

  expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>).)*Reset/s);
});

test("the hover option swaps to Hover / tap under a coarse pointer", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  expect(html).toMatch(/<span[^>]*class="[^"]*pointer-coarse:hidden[^"]*"[^>]*>On hover</);
  expect(html).toMatch(
    /<span[^>]*class="[^"]*hidden pointer-coarse:inline[^"]*"[^>]*>Hover \/ tap</,
  );
});

test("the first render of the stage emoji is visible, never held at opacity 0", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  expect(html).not.toContain("scale-[0.96]");
});

test("the segmented groups use the track and the 35% disabled opacity of the segmented tabs", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  expect(html).toContain("rounded-xl");
  expect(html).toContain("font-mono");
  expect(html).toContain("disabled:opacity-35");
});

test("the segmented groups render as tabs with the sliding pill indicator", () => {
  const html = renderToString(<DemoPlayground emojis={[wave]} tabs={tabs} labels={labels} />);

  expect(html).toContain('role="tab"');
  expect(html).toContain('data-variant="segmented"');
  expect(html).toContain("tab-pill");
  expect(html).not.toContain("aria-pressed");
});
