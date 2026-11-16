import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { copyableGlyph } from "../../emoji-pages/emoji-page";
import fixture from "../../gallery/fixtures/public-index.json";
import { fileUrl, parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { EmojiPageDetail, KeywordList } from "./EmojiPageDetail";

vi.mock("animated-fluent-emojis/react", () => ({
  Emoji: (props: { alt: string; skinTone?: string }) => (
    <img alt={props.alt} data-testid="emoji" data-tone={props.skinTone ?? "none"} />
  ),
}));

const toned = parsePublicIndex(fixture).find((candidate) => candidate.tones.length > 0);
if (!toned) throw new Error("fixture needs an emoji with tones");
const emoji: PublicEmoji = toned;
const { gallery, emojiPage } = getUi("en");
const keywordStrings = {
  keywordsLabel: emojiPage.keywordsLabel,
  keywordsMore: emojiPage.keywordsMore,
  keywordsLess: emojiPage.keywordsLess,
};
const metaStrings = {
  copyEmoji: emojiPage.copyEmoji,
  codePointLabel: emojiPage.codePointLabel,
};
const PAGE_PATH = "/emojis/waving-hand/";

afterEach(() => {
  globalThis.history.replaceState(null, "", PAGE_PATH);
  vi.unstubAllGlobals();
});

function toneChip(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: gallery.toneLabel })).getByRole("button", {
    name,
  });
}

function renderPage() {
  return render(
    <EmojiPageDetail
      emoji={emoji}
      name="Waving hand"
      strings={gallery}
      snippetTabs={{ plain: [], toned: [] }}
      category="Hand gestures"
      keywords={["wave"]}
      keywordStrings={keywordStrings}
      metaStrings={metaStrings}
    />,
  );
}

test("the tone starts from the query and a chosen tone is written back to it", async () => {
  const user = userEvent.setup();
  globalThis.history.replaceState(null, "", `${PAGE_PATH}?tone=dark`);
  renderPage();

  expect(screen.getByTestId("emoji").dataset.tone).toBe("dark");
  expect(toneChip(gallery.toneDark).getAttribute("aria-pressed")).toBe("true");

  await user.click(toneChip(gallery.toneLight));
  expect(screen.getByTestId("emoji").dataset.tone).toBe("light");
  expect(new URLSearchParams(globalThis.location.search).get("tone")).toBe("light");

  await user.click(toneChip(gallery.toneDefault));
  expect(screen.getByTestId("emoji").dataset.tone).toBe("none");
  expect(globalThis.location.search).toBe("");
  expect(globalThis.location.pathname).toBe(PAGE_PATH);
});

test("Copy emoji and the id copy write the toned glyph and the id", async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  globalThis.history.replaceState(null, "", `${PAGE_PATH}?tone=medium`);
  renderPage();

  await user.click(screen.getByRole("button", { name: new RegExp(emojiPage.copyEmoji) }));
  expect(writeText).toHaveBeenLastCalledWith(copyableGlyph(emoji, "medium"));

  await user.click(screen.getByRole("button", { name: gallery.copyId }));
  expect(writeText).toHaveBeenLastCalledWith(emoji.id);
  await waitFor(() => {
    expect(screen.getAllByText(gallery.copied).length).toBeGreaterThan(0);
  });
});

test("the download uses the files of the current tone", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(() => Promise.resolve(new Response("", { status: 404 })));
  vi.stubGlobal("fetch", fetchMock);
  globalThis.history.replaceState(null, "", `${PAGE_PATH}?tone=light`);
  renderPage();
  const light = emoji.tones.find((variant) => variant.tone === "light");
  if (!light) throw new Error("fixture needs a light tone");

  await user.click(screen.getByRole("button", { name: gallery.fileActionDownloadWebp }));

  expect(fetchMock).toHaveBeenCalledWith(fileUrl(light.urls.webp));
  await waitFor(() => {
    expect(screen.getAllByText(gallery.downloadFailed).length).toBeGreaterThan(0);
  });
});

test("the keyword summary flips between +N more and Show less", () => {
  const keywords = Array.from({ length: 12 }, (_, index) => `word${String(index)}`);
  const { container } = render(<KeywordList keywords={keywords} strings={keywordStrings} />);
  const details = container.querySelector("details");
  if (!details) throw new Error("expected a details element");

  expect(screen.getByText("+2 more")).toBeTruthy();
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(screen.getByText(keywordStrings.keywordsLess)).toBeTruthy();

  details.open = false;
  fireEvent(details, new Event("toggle"));
  expect(screen.getByText("+2 more")).toBeTruthy();
});
