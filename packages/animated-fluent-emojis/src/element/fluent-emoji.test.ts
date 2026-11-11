import { afterEach, expect, test } from "vitest";

import { configureEmojis } from "../utils/index.js";
import { defineFluentEmoji, FLUENT_EMOJI_PRE_UPGRADE_CSS } from "./fluent-emoji.js";
import "./index.js";

const mounted: Element[] = [];

const mount = (markup: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.append(host);
  mounted.push(host);
  return host;
};

const getImage = (element: Element) => element.shadowRoot?.querySelector("img") ?? null;

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
  configureEmojis({});
});

test("registers once and tolerates repeated definition", () => {
  defineFluentEmoji();
  expect(customElements.get("fluent-emoji")).toBeDefined();
});

test("renders the image in its shadow root and keeps keyframes there", async () => {
  const host = mount('<fluent-emoji id="cat" size="48"></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");
  await expect.poll(() => element && getImage(element)).not.toBeNull();

  const image = element ? getImage(element) : null;
  expect(image?.alt).toBe("Cat");
  expect(image?.parentElement?.style.width).toBe("48px");
  expect(element?.shadowRoot?.querySelector("style")?.textContent).toContain(
    "@keyframes emoji-play",
  );
  expect(element?.querySelector("img")).toBeNull();
});

test("attribute changes update the rendering", async () => {
  const host = mount('<fluent-emoji id="cat" size="48"></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");
  await expect.poll(() => element && getImage(element)).not.toBeNull();

  element?.setAttribute("size", "2rem");
  element?.setAttribute("alt", "Kitty");

  await expect.poll(() => element && getImage(element)?.alt).toBe("Kitty");
  expect(element && getImage(element)?.parentElement?.style.width).toBe("2rem");
});

test("property sets update the rendering and read back", async () => {
  const host = mount('<fluent-emoji id="cat"></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");
  await expect.poll(() => element && getImage(element)).not.toBeNull();

  if (element) {
    element.size = 30;
    element.playing = false;
  }

  expect(element?.size).toBe(30);
  await expect.poll(() => element && getImage(element)?.style.animationPlayState).toBe("paused");
});

test("boolean and iteration attributes are parsed", () => {
  const host = mount(
    '<fluent-emoji id="cat" playing="false" animation-iterations="infinite" auto-play play-on-hover></fluent-emoji>',
  );
  const element = host.querySelector("fluent-emoji");

  expect(element?.playing).toBe(false);
  expect(element?.animationIterations).toBe("infinite");
  expect(element?.autoPlay).toBe(true);
  expect(element?.playOnHover).toBe(true);
  element?.setAttribute("animation-iterations", "nope");
  expect(element?.animationIterations).toBe(2);
  element?.removeAttribute("playing");
  expect(element?.playing).toBeUndefined();
});

test("upgrades properties set before the element is defined", async () => {
  const host = mount("<fluent-emoji-early></fluent-emoji-early>");
  const element = host.querySelector<HTMLElement & { id: string; size: number }>(
    "fluent-emoji-early",
  );
  if (element) {
    element.id = "cat";
    element.size = 36;
  }

  defineFluentEmoji("fluent-emoji-early");

  await expect.poll(() => element && getImage(element)).not.toBeNull();
  expect(element && getImage(element)?.parentElement?.style.width).toBe("36px");
});

test("reserves layout space before the element is defined", () => {
  const stylesheet = document.createElement("style");
  stylesheet.textContent = FLUENT_EMOJI_PRE_UPGRADE_CSS.replaceAll(
    "fluent-emoji",
    "fluent-emoji-pending",
  );
  document.head.append(stylesheet);
  const host = mount('<fluent-emoji-pending id="cat" size="48"></fluent-emoji-pending>');

  const box = host.firstElementChild?.getBoundingClientRect();
  stylesheet.remove();

  expect(box?.width).toBe(48);
  expect(box?.height).toBe(48);
});

test("a slotted fallback replaces the default fallback", async () => {
  const host = mount('<fluent-emoji id="no-such-emoji"><b slot="fallback">fb</b></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");

  await expect
    .poll(() => element?.shadowRoot?.querySelector('slot[name="fallback"]'))
    .not.toBeNull();
  expect(element?.querySelector('[slot="fallback"]')?.textContent).toBe("fb");

  element?.querySelector("b")?.remove();
  await expect.poll(() => element?.shadowRoot?.querySelector('slot[name="fallback"]')).toBeNull();
});

test("emits emoji-load, emoji-error and playback-end", async () => {
  const host = mount('<fluent-emoji id="waving-hand" animation-iterations="1"></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");
  const events: string[] = [];
  for (const type of ["emoji-load", "emoji-error", "playback-end"]) {
    element?.addEventListener(type, () => {
      events.push(type);
    });
  }

  await expect.poll(() => events, { timeout: 5000 }).toContain("emoji-load");
  await expect.poll(() => events, { timeout: 5000 }).toContain("playback-end");

  const image = element ? getImage(element) : null;
  image?.dispatchEvent(new Event("error"));
  await expect.poll(() => events).toContain("emoji-error");
});

test("removing the element releases its content", async () => {
  const host = mount('<fluent-emoji id="cat"></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");
  await expect.poll(() => element && getImage(element)).not.toBeNull();

  element?.remove();

  expect(element?.shadowRoot?.querySelector("span")).toBeNull();
});

test("property sets parse string values like attributes do", () => {
  const host = mount('<fluent-emoji id="cat"></fluent-emoji>');
  const element = host.querySelector<HTMLElement>("fluent-emoji");
  Reflect.set(element ?? {}, "playing", "false");
  Reflect.set(element ?? {}, "size", "32");

  expect(Reflect.get(element ?? {}, "playing")).toBe(false);
  expect(Reflect.get(element ?? {}, "size")).toBe(32);
});

test("gates hover playback to hover-capable pointers in the shadow styles", async () => {
  const host = mount('<fluent-emoji id="cat" size="48"></fluent-emoji>');
  const element = host.querySelector("fluent-emoji");
  await expect.poll(() => element && getImage(element)).not.toBeNull();

  const css = element?.shadowRoot?.querySelector("style")?.textContent ?? "";
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const rules = [...sheet.cssRules];
  const gated = rules.filter(
    (rule): rule is CSSMediaRule =>
      rule instanceof CSSMediaRule && rule.conditionText === "(hover: hover) and (pointer: fine)",
  );

  expect(gated).toHaveLength(1);
  expect(gated[0]?.cssRules[0]?.cssText).toContain(":hover");
  expect(
    rules.some((rule) => !(rule instanceof CSSMediaRule) && rule.cssText.includes(":hover")),
  ).toBe(false);
});
