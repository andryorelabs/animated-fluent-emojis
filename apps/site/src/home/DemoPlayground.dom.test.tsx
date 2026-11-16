import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { CodeBlockTab } from "@/components/CodeBlock";

import publicIndexFixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../gallery/public-index";
import { SNIPPET_TABS } from "./content";
import { INITIAL_DEMO_STATE, type DemoTabs } from "./demo";
import DemoPlayground from "./DemoPlayground";

vi.mock("animated-fluent-emojis/react", () => ({
  Emoji: (props: {
    id: string;
    alt: string;
    size?: number;
    skinTone?: string;
    playing?: boolean;
    onLoad?: () => void;
    onError?: () => void;
  }) => (
    <img
      alt={props.alt}
      data-testid="stage-emoji"
      data-id={props.id}
      data-size={String(props.size)}
      data-tone={props.skinTone ?? "none"}
      data-playing={props.playing === undefined ? "unset" : String(props.playing)}
      onLoad={props.onLoad}
      onError={props.onError}
    />
  ),
}));

const emojis = parsePublicIndex(publicIndexFixture);

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

function tabIn(group: string, name: string | RegExp): HTMLElement {
  return within(screen.getByRole("tablist", { name: group })).getByRole("tab", {
    name,
  });
}

function stageEmoji(): HTMLElement {
  return screen.getByTestId("stage-emoji");
}

test("the controls change the emoji, size, play and tone, and Reset restores them", async () => {
  const user = userEvent.setup();
  render(<DemoPlayground emojis={emojis} tabs={tabs} labels={labels} />);
  const reset = screen.getByRole("button", { name: "Reset" });

  expect(reset).toHaveProperty("disabled", true);
  expect(stageEmoji().dataset.id).toBe(INITIAL_DEMO_STATE.emojiId);

  await user.click(tabIn("Size", "128"));
  await waitFor(() => {
    expect(stageEmoji().dataset.size).toBe("128");
  });
  expect(reset).toHaveProperty("disabled", false);

  await user.click(tabIn("Plays", /Loop/));
  await waitFor(() => {
    expect(document.body.textContent).toContain("react-loop-plain");
  });

  await user.click(tabIn("Skin tone", /Dark/));
  await waitFor(() => {
    expect(stageEmoji().dataset.tone).toBe("dark");
  });
  expect(document.body.textContent).toContain("react-loop-toned");

  await user.click(tabIn("Emoji", "Fire"));
  await waitFor(() => {
    expect(stageEmoji().dataset.id).toBe("fire");
  });
  expect(stageEmoji().getAttribute("alt")).toBe("Fire");
  expect(tabIn("Skin tone", /Dark/).getAttribute("aria-disabled")).toBe("true");

  await user.click(reset);
  await waitFor(() => {
    expect(stageEmoji().dataset.id).toBe(INITIAL_DEMO_STATE.emojiId);
  });
  expect(reset).toHaveProperty("disabled", true);
});

test("the stage emoji fades in after hydration and settles once it loads or fails", () => {
  render(<DemoPlayground emojis={emojis} tabs={tabs} labels={labels} />);
  const wrapper = stageEmoji().parentElement;
  if (!wrapper) throw new Error("expected a stage wrapper");

  expect(wrapper.className).toContain("opacity-0");
  fireEvent.load(stageEmoji());
  expect(wrapper.className).not.toContain("opacity-0");
});

test("a failed stage emoji still settles", () => {
  render(<DemoPlayground emojis={emojis} tabs={tabs} labels={labels} />);
  const wrapper = stageEmoji().parentElement;
  if (!wrapper) throw new Error("expected a stage wrapper");

  fireEvent.error(stageEmoji());
  expect(wrapper.className).not.toContain("opacity-0");
});

test("a touch on the stage plays the hover emoji, but not a mouse or a button press", () => {
  render(<DemoPlayground emojis={emojis} tabs={tabs} labels={labels} />);
  const stage = screen.getByTestId("demo-stage");

  fireEvent.pointerDown(stage, { pointerType: "mouse" });
  expect(stageEmoji().dataset.playing).toBe("unset");

  fireEvent.pointerDown(screen.getByRole("button", { name: "Reset" }), {
    pointerType: "touch",
  });
  expect(stageEmoji().dataset.playing).toBe("unset");

  fireEvent.pointerDown(stage, { pointerType: "touch" });
  expect(stageEmoji().dataset.playing).toBe("true");
  expect(stageEmoji().parentElement?.className).not.toContain("opacity-0");

  fireEvent.pointerDown(stage, { pointerType: "touch" });
  expect(stageEmoji().dataset.playing).toBe("true");
});

test("a touch on the stage replays a load play without forcing it to play", () => {
  render(
    <DemoPlayground
      emojis={emojis}
      tabs={tabs}
      labels={labels}
      initialState={{ ...INITIAL_DEMO_STATE, play: "load" }}
    />,
  );
  const before = stageEmoji();

  fireEvent.pointerDown(screen.getByTestId("demo-stage"), {
    pointerType: "touch",
  });

  expect(stageEmoji()).toBe(before);
});

test("an unknown starting emoji falls back to the waving hand", () => {
  render(
    <DemoPlayground
      emojis={emojis}
      tabs={tabs}
      labels={labels}
      initialState={{ ...INITIAL_DEMO_STATE, emojiId: "missing" }}
    />,
  );

  expect(stageEmoji().dataset.id).toBe(INITIAL_DEMO_STATE.emojiId);
});

test("renders nothing without the starting emoji", () => {
  const fire = emojis.filter((emoji) => emoji.id === "fire");
  const { container } = render(<DemoPlayground emojis={fire} tabs={tabs} labels={labels} />);

  expect(container.childNodes).toHaveLength(0);
});

test("a hydrated stage emoji is shown at once, never faded in", () => {
  const ui = <DemoPlayground emojis={emojis} tabs={tabs} labels={labels} />;
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);

  render(ui, { container, hydrate: true });

  expect(stageEmoji().parentElement?.className).not.toContain("opacity-0");
  expect(screen.getByRole("button", { name: "Reset" })).toHaveProperty("disabled", true);
  container.remove();
});
