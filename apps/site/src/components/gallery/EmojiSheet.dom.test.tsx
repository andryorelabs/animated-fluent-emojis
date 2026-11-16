import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { fileUrl, parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { EmojiSheet, EmojiSheetBody } from "./EmojiSheet";

vi.mock("animated-fluent-emojis/react", () => ({
  Emoji: (props: { alt: string; skinTone?: string; onLoad?: () => void; onError?: () => void }) => (
    <img
      alt={props.alt}
      data-testid="emoji"
      data-tone={props.skinTone ?? "none"}
      onLoad={props.onLoad}
      onError={props.onError}
    />
  ),
}));

const emojis = parsePublicIndex(fixture);
const toned = emojis.find((candidate) => candidate.tones.length > 0);
if (!toned) throw new Error("fixture needs an emoji with tones");
const emoji: PublicEmoji = toned;
const strings = getUi("en").gallery;

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderBody(tone?: "light") {
  return render(
    <EmojiSheetBody
      emoji={emoji}
      name="Waving hand"
      tone={tone}
      size={64}
      locale="en"
      strings={strings}
    />,
  );
}

test("the preview drops its skeleton and shows the emoji once it loads", () => {
  renderBody();

  expect(screen.getByTestId("sheet-preview-skeleton")).toBeTruthy();
  fireEvent.load(screen.getByTestId("emoji"));

  expect(screen.queryByTestId("sheet-preview-skeleton")).toBeNull();
  expect(screen.getByTestId("sheet-preview").dataset.ready).toBe("true");
});

test("a failed preview disables the file actions until retry reloads it", async () => {
  const user = userEvent.setup();
  const { container } = renderBody("light");

  expect(screen.getByTestId("emoji").dataset.tone).toBe("light");
  fireEvent.error(screen.getByTestId("emoji"));

  expect(screen.getByText(strings.filesError)).toBeTruthy();
  expect(screen.queryByTestId("sheet-preview")).toBeNull();
  expect(container.querySelector("fieldset")?.disabled).toBe(true);

  await user.click(screen.getByRole("button", { name: strings.retry }));

  expect(screen.queryByText(strings.filesError)).toBeNull();
  expect(screen.getByTestId("sheet-preview-skeleton")).toBeTruthy();
  expect(container.querySelector("fieldset")?.disabled).toBe(false);
});

test("the zoom buttons scale the preview", async () => {
  const user = userEvent.setup();
  renderBody();
  const group = screen.getByRole("group", { name: strings.zoomLabel });
  const [one, two] = group.querySelectorAll("button");
  if (!one || !two) throw new Error("expected two zoom buttons");

  expect(one.getAttribute("aria-pressed")).toBe("true");
  await user.click(two);

  expect(two.getAttribute("aria-pressed")).toBe("true");
  expect(one.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByTestId("sheet-preview").style.getPropertyValue("--preview-transform")).toBe(
    "scale(2)",
  );
});

test("the copy buttons write the name and the id and announce it", async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  renderBody();

  await user.click(screen.getByRole("button", { name: strings.copyName }));
  expect(writeText).toHaveBeenLastCalledWith("Waving hand");
  await user.click(screen.getByRole("button", { name: strings.copyId }));
  expect(writeText).toHaveBeenLastCalledWith(emoji.id);

  await waitFor(() => {
    expect(screen.getAllByText(strings.copied).length).toBeGreaterThan(0);
  });
});

test("the file action downloads the toned file and announces a failure", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(() => Promise.resolve(new Response("", { status: 404 })));
  vi.stubGlobal("fetch", fetchMock);
  renderBody("light");
  const light = emoji.tones.find((variant) => variant.tone === "light");
  if (!light) throw new Error("fixture needs a light tone");

  await user.click(screen.getByRole("button", { name: strings.fileActionDownloadWebp }));

  expect(fetchMock).toHaveBeenCalledWith(fileUrl(light.urls.webp));
  await waitFor(() => {
    expect(screen.getAllByText(strings.downloadFailed).length).toBeGreaterThan(0);
  });
});

test("the keywords list is capped and an emoji without keywords has none", () => {
  renderBody();
  const list = screen.getByRole("list", { name: strings.keywordsLabel });
  expect(list.querySelectorAll("li")).toHaveLength(Math.min(8, emoji.keywords.length));

  render(
    <EmojiSheetBody
      emoji={{ ...emoji, keywords: [] }}
      name="Bare"
      tone={undefined}
      size={64}
      locale="en"
      strings={strings}
    />,
  );
  expect(screen.getAllByRole("list", { name: strings.keywordsLabel })).toHaveLength(1);
});

class RecordingResizeObserver {
  static instances: RecordingResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    RecordingResizeObserver.instances.push(this);
  }

  observe(): void {
    return;
  }

  unobserve(): void {
    return;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback([], this);
  }
}

test("the sheet reports its height, closes from its button and reports zero once gone", async () => {
  RecordingResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
  const user = userEvent.setup();
  const onHeightChange = vi.fn();
  const onOpenChange = vi.fn();
  const finalFocus = createRef<HTMLElement>();

  const { rerender } = render(
    <EmojiSheet
      open
      onOpenChange={onOpenChange}
      finalFocus={finalFocus}
      onHeightChange={onHeightChange}
      emoji={emoji}
      name="Waving hand"
      tone={undefined}
      size={64}
      locale="en"
      strings={strings}
    />,
  );

  const region = screen.getByRole("region", { name: "Waving hand" });
  expect(region).toBeTruthy();
  expect(onHeightChange).toHaveBeenCalledWith(0);
  const observer = RecordingResizeObserver.instances.at(-1);
  if (!observer) throw new Error("expected a resize observer");
  onHeightChange.mockClear();
  observer.fire();
  expect(onHeightChange).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole("button", { name: strings.closeDetail }));
  expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());

  onHeightChange.mockClear();
  rerender(
    <EmojiSheet
      open={false}
      onOpenChange={onOpenChange}
      finalFocus={finalFocus}
      onHeightChange={onHeightChange}
      emoji={emoji}
      name="Waving hand"
      tone={undefined}
      size={64}
      locale="en"
      strings={strings}
    />,
  );
  await waitFor(() => {
    expect(screen.queryByRole("region", { name: "Waving hand" })).toBeNull();
  });
  expect(onHeightChange).toHaveBeenLastCalledWith(0);
  expect(observer.disconnected).toBe(true);
});
