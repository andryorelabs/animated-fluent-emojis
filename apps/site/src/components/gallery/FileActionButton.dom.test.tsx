import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import type { FileAction } from "@/lib/file-action";
import type { PreferenceStore } from "@/lib/persisted-preference";

import { getUi } from "../../i18n/ui";
import { FileActionButton } from "./FileActionButton";

const strings = getUi("en").gallery;
const target = {
  filenameBase: "wave",
  urlFor: (format: string) => `/wave.${format}`,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function createStore(initial: FileAction): PreferenceStore<FileAction> {
  let current = initial;
  const listeners = new Set<(value: FileAction) => void>();
  return {
    get: () => current,
    set: (value) => {
      current = value;
      listeners.forEach((listener) => {
        listener(value);
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function setup(initial: FileAction, writeText: (text: string) => Promise<void>) {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  const onNotice = vi.fn();
  const store = createStore(initial);
  render(<FileActionButton target={target} strings={strings} onNotice={onNotice} store={store} />);
  return { user, onNotice, store };
}

test("a copy primary copies the URL and reports the formatted notice", async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
  const { user, onNotice } = setup("copy-gif", writeText);

  await user.click(screen.getByRole("button", { name: strings.fileActionCopyGif }));

  expect(writeText).toHaveBeenCalledWith("/wave.gif");
  expect(onNotice).toHaveBeenCalledWith({
    kind: "copied",
    message: strings.fileActionCopiedUrl.split("{format}").join("GIF"),
  });
});

test("a failing copy reports a failed notice", async () => {
  const { user, onNotice } = setup("copy-png", vi.fn().mockRejectedValue(new Error("denied")));

  await user.click(screen.getByRole("button", { name: strings.fileActionCopyPng }));

  expect(onNotice).toHaveBeenCalledWith({ kind: "failed" });
});

test("choosing a menu action stores it and makes it the primary", async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
  const { user, store, onNotice } = setup("download-webp", writeText);

  await user.click(screen.getByRole("button", { name: strings.fileActionMenuLabel }));
  await user.click(
    await screen.findByRole("menuitem", {
      name: new RegExp(strings.fileActionCopyWebp),
    }),
  );

  expect(store.get()).toBe("copy-webp");
  expect(writeText).toHaveBeenCalledWith("/wave.webp");
  expect(onNotice).toHaveBeenCalledOnce();
  expect(await screen.findByRole("button", { name: strings.fileActionCopyWebp })).toBeTruthy();
});

test("a download that fails to fetch reports a failed notice", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
  vi.stubGlobal("fetch", fetchMock);
  const { user, onNotice } = setup("download-png", vi.fn());

  await user.click(screen.getByRole("button", { name: strings.fileActionDownloadPng }));

  expect(fetchMock).toHaveBeenCalledWith("/wave.png");
  expect(onNotice).toHaveBeenCalledWith({ kind: "failed" });
});
