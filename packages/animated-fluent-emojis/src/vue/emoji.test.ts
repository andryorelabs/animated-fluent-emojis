import { afterEach, expect, test, vi } from "vitest";
import { createApp, h, type App, type VNode } from "vue";

import { configureEmojis } from "../utils/index.js";
import { Emoji } from "./index.js";

const mounted: { app: App; host: HTMLElement }[] = [];

const mount = (render: () => VNode): HTMLElement => {
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render });
  app.mount(host);
  mounted.push({ app, host });
  return host;
};

afterEach(() => {
  for (const { app, host } of mounted.splice(0)) {
    app.unmount();
    host.remove();
  }
  vi.restoreAllMocks();
  configureEmojis({});
});

test("emits load when the image loads", async () => {
  const onLoad = vi.fn();
  const host = mount(() => h(Emoji, { id: "cat", onLoad }));
  await expect.poll(() => host.querySelector("img")).not.toBeNull();

  host.querySelector("img")?.dispatchEvent(new Event("load"));

  expect(onLoad).toHaveBeenCalled();
  expect(onLoad.mock.calls[0]?.[0]).toBeInstanceOf(Event);
});

test("emits error with the event when the sprite fails", async () => {
  const onError = vi.fn();
  const host = mount(() => h(Emoji, { id: "cat", onError }));
  await expect.poll(() => host.querySelector("img")).not.toBeNull();

  host.querySelector("img")?.dispatchEvent(new Event("error"));

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Event);
});

test("renders the fallback slot when the sprite fails", async () => {
  const host = mount(() => h(Emoji, { id: "cat" }, { fallback: () => h("b", "oops") }));
  await expect.poll(() => host.querySelector("img")).not.toBeNull();

  host.querySelector("img")?.dispatchEvent(new Event("error"));

  await expect.poll(() => host.querySelector("b")?.textContent).toBe("oops");
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector('[role="img"]')).toBeNull();
});

test("retries a failed sprite when the browser comes back online", async () => {
  const host = mount(() => h(Emoji, { id: "cat" }));
  await expect.poll(() => host.querySelector("img")).not.toBeNull();

  host.querySelector("img")?.dispatchEvent(new Event("error"));
  await expect.poll(() => host.querySelector('[role="img"]')).not.toBeNull();
  expect(host.querySelector("img")).toBeNull();

  globalThis.dispatchEvent(new Event("online"));

  await expect.poll(() => host.querySelector("img")).not.toBeNull();
});

test("renders the fallback slot for an unknown id", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
  const host = mount(() => h(Emoji, { id: "no-such-emoji", size: 30 }, { fallback: () => "n/a" }));

  await expect.poll(() => host.querySelector("span")?.textContent).toBe("n/a");
});

test("passes class, style and data attributes to the root span", async () => {
  const host = mount(() =>
    h(Emoji, {
      id: "cat",
      size: 50,
      class: "mine",
      style: { margin: "3px", width: "10px" },
      "data-testid": "emoji",
    }),
  );
  await expect.poll(() => host.querySelector("img")).not.toBeNull();

  const root = host.querySelector<HTMLElement>('[data-testid="emoji"]');
  expect(root?.classList.contains("mine")).toBe(true);
  expect(root?.style.margin).toBe("3px");
  expect(root?.style.width).toBe("10px");
  expect(root?.style.height).toBe("50px");
});

test("an empty alt marks the emoji as decorative", async () => {
  const host = mount(() => h(Emoji, { id: "cat", alt: "" }));
  await expect.poll(() => host.querySelector("img")).not.toBeNull();

  expect(host.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
});
