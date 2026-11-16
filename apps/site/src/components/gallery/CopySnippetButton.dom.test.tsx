import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import type { PreferenceStore } from "@/lib/persisted-preference";
import type { SnippetAdapter } from "@/lib/snippet-adapter";

import type { PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { CopySnippetButton } from "./CopySnippetButton";

const strings = getUi("en").gallery;
const emoji: PublicEmoji = {
  slug: "wave",
  id: "wave",
  description: "Waving hand",
  unicode: "x",
  category: "People",
  keywords: [],
  urls: { gif: "/w.gif", webp: "/w.webp", png: "/w.png" },
  tones: [],
};

function createStore(initial: SnippetAdapter): PreferenceStore<SnippetAdapter> {
  let current = initial;
  const listeners = new Set<(value: SnippetAdapter) => void>();
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

function setup(writeText: (text: string) => Promise<void>) {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  const onNotice = vi.fn();
  const store = createStore("react");
  render(
    <CopySnippetButton
      emoji={emoji}
      size={96}
      tone={undefined}
      strings={strings}
      onNotice={onNotice}
      store={store}
    />,
  );
  return { user, onNotice, store };
}

test("the primary part copies the snippet and notices success", async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
  const { user, onNotice } = setup(writeText);

  await user.click(screen.getByRole("button", { name: /React/ }));

  expect(writeText).toHaveBeenCalledOnce();
  expect(onNotice).toHaveBeenCalledWith(strings.copied);
});

test("a clipboard failure notices the failure message", async () => {
  const { user, onNotice } = setup(vi.fn().mockRejectedValue(new Error("denied")));

  await user.click(screen.getByRole("button", { name: /React/ }));

  expect(onNotice).toHaveBeenCalledWith(strings.downloadFailed);
});

test("choosing an adapter from the menu stores it, copies it and becomes the primary", async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
  const { user, store } = setup(writeText);

  await user.click(screen.getByRole("button", { name: strings.snippetMenuLabel }));
  await user.click(await screen.findByRole("menuitem", { name: strings.tabVue }));

  expect(store.get()).toBe("vue");
  expect(writeText).toHaveBeenCalledOnce();
  expect(await screen.findByRole("button", { name: /Vue/ })).toBeTruthy();
});
