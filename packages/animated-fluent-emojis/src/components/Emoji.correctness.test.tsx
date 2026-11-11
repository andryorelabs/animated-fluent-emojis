/// <reference types="@vitest/browser-playwright" />
import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { server } from "vitest/browser";

import { configureEmojis } from "../utils/index.js";
import { Emoji } from "./Emoji.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  configureEmojis({});
});

const waitForImage = (container: Element): Promise<HTMLImageElement> =>
  vi.waitFor(() => {
    const image = container.querySelector("img");
    if (!image) throw new Error("image not rendered yet");
    return image;
  });

test("an unknown id warns once per id, renders the fallback and skips onError", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
  const onError = vi.fn();

  const { container, rerender } = await render(
    <Emoji id="no-such-emoji" fallback="?" onError={onError} />,
  );
  await expect.poll(() => container.textContent).toBe("?");
  await rerender(<Emoji id="no-such-emoji" fallback="!" onError={onError} />);
  await expect.poll(() => container.textContent).toBe("!");

  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

test("an unknown id without a fallback renders nothing", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
  const { container } = await render(<Emoji id="another-unknown" />);

  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  expect(container.getHTML()).toBe("");
});

test.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
  "the inherited object key %s resolves to missing without throwing",
  async (id) => {
    vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
    const { container } = await render(<Emoji id={id} fallback="?" />);

    await expect.poll(() => container.textContent).toBe("?");
  },
);

test("a skin tone change makes autoplay wait for the new sheet", async () => {
  const { container, rerender } = await render(
    <Emoji id="waving-hand" skinTone="dark" animationIterations="infinite" />,
  );
  const first = await waitForImage(container);
  await expect.poll(() => first.style.animationPlayState).toBe("running");

  await rerender(<Emoji id="waving-hand" skinTone="light" animationIterations="infinite" />);
  const second = await waitForImage(container);
  expect(second.style.animationName).toBe("none");

  await expect.poll(() => second.style.animationName).toBe("");
  expect(second.style.animationPlayState).toBe("running");
});

test("a held emoji rests on its poster frame with no animation", async () => {
  const { container } = await render(
    <div style={{ height: 100, overflow: "auto" }}>
      <div style={{ height: 2000 }} />
      <Emoji id="grinning-face" size={50} animationIterations="infinite" />
    </div>,
  );

  const image = await waitForImage(container);
  await expect.poll(() => server.browser !== "chromium" || image.complete).toBe(true);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

  expect(image.style.animationName).toBe("none");
  expect(image.style.transform).toBe("translateY(-2.5%)");
});

test("a failed sprite is retried when the browser goes online", async () => {
  const { container } = await render(<Emoji id="cat" />);
  const image = await waitForImage(container);
  image.dispatchEvent(new Event("error"));
  await expect.poll(() => container.querySelector("img")).toBeNull();

  globalThis.dispatchEvent(new Event("online"));

  await expect.poll(() => container.querySelector("img")).not.toBeNull();
});

test("the image mounted by an online retry still reports its animation end", async () => {
  const { container } = await render(<Emoji id="cat" animationIterations={1} />);
  const failedImage = await waitForImage(container);
  failedImage.dispatchEvent(new Event("error"));
  await expect.poll(() => container.querySelector("img")).toBeNull();

  globalThis.dispatchEvent(new Event("online"));
  const retriedImage = await waitForImage(container);

  await expect.poll(() => retriedImage.style.animationName, { timeout: 5000 }).toBe("");
  await expect.poll(() => retriedImage.style.animationName, { timeout: 8000 }).toBe("none");
});

test("a failed sprite is retried when the source changes and returns", async () => {
  const { container, rerender } = await render(<Emoji id="waving-hand" skinTone="dark" />);
  const image = await waitForImage(container);
  image.dispatchEvent(new Event("error"));
  await expect.poll(() => container.querySelector("img")).toBeNull();

  await rerender(<Emoji id="waving-hand" skinTone="light" />);
  await waitForImage(container);
  await rerender(<Emoji id="waving-hand" skinTone="dark" />);
  await waitForImage(container);
});

test("onError fires once per manifest failure under StrictMode", async () => {
  vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));
  configureEmojis({ assetSiteUrl: "https://strict-failing.test" });
  const first = vi.fn();
  await render(
    <StrictMode>
      <Emoji id="cat" onError={first} />
    </StrictMode>,
  );
  await expect.poll(() => first.mock.calls.length).toBe(1);

  const second = vi.fn();
  await render(
    <StrictMode>
      <Emoji id="cat" onError={second} />
    </StrictMode>,
  );
  await expect.poll(() => second.mock.calls.length).toBe(1);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  expect(second).toHaveBeenCalledTimes(1);
});

test("a remount while the store is in error reports only the failure of its own retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));
  configureEmojis({ assetSiteUrl: "https://remount-failing.test" });
  const first = vi.fn();
  await render(<Emoji id="cat" onError={first} />);
  await expect.poll(() => first.mock.calls.length).toBe(1);

  let rejectFetch: (() => void) | undefined;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        rejectFetch = () => {
          resolve(new Response("nope", { status: 500 }));
        };
      }),
  );
  const second = vi.fn();
  await render(<Emoji id="cat" onError={second} />);
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
  expect(second).not.toHaveBeenCalled();
  rejectFetch?.();
  await expect.poll(() => second.mock.calls.length).toBe(1);
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
  expect(second).toHaveBeenCalledTimes(1);
});

test("a numeric string size renders like the number", async () => {
  const { container } = await render(<Emoji id="waving-hand" size="48" />);
  const image = await waitForImage(container);
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.width).toBe("48px");
  expect(root.style.height).toBe("48px");
  expect(image.getAttribute("sizes")).toBe("48px");
});

test("an empty string size uses the default size", async () => {
  const { container } = await render(<Emoji id="waving-hand" size="" />);
  await waitForImage(container);
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.width).toBe("100px");
  expect(root.style.height).toBe("100px");
});

test("a CSS length size omits sizes so the lazy sheet keeps its intrinsic height", async () => {
  const { container } = await render(<Emoji id="waving-hand" size="2rem" />);
  const image = await waitForImage(container);
  expect(image.hasAttribute("sizes")).toBe(false);
  expect((container.firstElementChild as HTMLElement).style.width).toBe("2rem");
});

test("mounted emojis share one online listener", async () => {
  const addSpy = vi.spyOn(globalThis, "addEventListener");
  const { container } = await render(
    <>
      {Array.from({ length: 50 }, (_, index) => (
        <Emoji key={index} id="cat" />
      ))}
    </>,
  );
  await expect.poll(() => container.querySelectorAll("img").length).toBe(50);
  const onlineRegistrations = addSpy.mock.calls.filter(([type]) => type === "online");
  expect(onlineRegistrations).toHaveLength(1);
});
