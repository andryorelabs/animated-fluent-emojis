import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import type { CodeBlockTab } from "@/components/CodeBlock";

import fixture from "../../gallery/fixtures/public-index.json";
import { fileUrl, parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { EmojiDetail } from "./EmojiDetail";

vi.mock("animated-fluent-emojis/react", () => ({
  Emoji: (props: { alt: string; skinTone?: string; playing?: boolean; onLoad?: () => void }) => (
    <img
      alt={props.alt}
      data-testid="emoji"
      data-tone={props.skinTone ?? "none"}
      data-playing={props.playing === undefined ? "unset" : String(props.playing)}
      onLoad={props.onLoad}
    />
  ),
}));

const toned = parsePublicIndex(fixture).find((candidate) => candidate.tones.length > 0);
if (!toned) throw new Error("fixture needs an emoji with tones");
const emoji: PublicEmoji = toned;
const strings = getUi("en").gallery;

afterEach(() => {
  vi.unstubAllGlobals();
});

function tab(id: string, label: string, marker: string): CodeBlockTab {
  return { id, label, code: id, html: `<div class="ec-line">${marker}</div>` };
}

test("a page drops its static poster once the live emoji loads", () => {
  const { container } = render(
    <EmojiDetail
      emoji={emoji}
      name="Waving hand"
      tone={undefined}
      size={200}
      strings={strings}
      page
    />,
  );

  const posterSelector = `img[src="${CSS.escape(fileUrl(emoji.urls.png))}"]`;
  expect(container.querySelector(posterSelector)).not.toBeNull();
  fireEvent.load(screen.getByTestId("emoji"));

  expect(container.querySelector(posterSelector)).toBeNull();
});

test("the stage toolbar swaps the background, pauses and resumes, and zooms", async () => {
  const user = userEvent.setup();
  render(
    <EmojiDetail emoji={emoji} name="Waving hand" tone={undefined} size={200} strings={strings} />,
  );
  const backgrounds = screen.getByRole("group", {
    name: strings.backgroundLabel,
  });
  const swatches = [...backgrounds.querySelectorAll("button")];
  const unpressed = swatches.find((swatch) => swatch.getAttribute("aria-pressed") === "false");
  if (!unpressed) throw new Error("expected another background");

  await user.click(unpressed);
  expect(unpressed.getAttribute("aria-pressed")).toBe("true");

  expect(screen.getByTestId("emoji").dataset.playing).toBe("unset");
  await user.click(screen.getByRole("button", { name: strings.pauseAnimation }));
  expect(screen.getByTestId("emoji").dataset.playing).toBe("false");
  await user.click(screen.getByRole("button", { name: strings.playAnimation }));
  expect(screen.getByTestId("emoji").dataset.playing).toBe("true");

  const zoom = screen.getByRole("group", { name: strings.zoomLabel });
  const two = zoom.querySelectorAll("button")[1];
  if (!two) throw new Error("expected a 2x zoom");
  await user.click(two);
  expect(two.getAttribute("aria-pressed")).toBe("true");
});

test("the sheet layout copies the name and switches the snippet tab", async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  render(
    <EmojiDetail
      emoji={emoji}
      name="Waving hand"
      tone="light"
      size={96}
      strings={strings}
      headingId="detail-heading"
    />,
  );

  expect(screen.getByRole("heading", { name: "Waving hand" }).id).toBe("detail-heading");
  expect(screen.getByTestId("emoji").dataset.tone).toBe("light");
  await user.click(screen.getByRole("button", { name: strings.copyName }));
  expect(writeText).toHaveBeenLastCalledWith("Waving hand");
  await user.click(screen.getByRole("button", { name: strings.copyId }));
  expect(writeText).toHaveBeenLastCalledWith(emoji.id);

  const vue = screen.getByRole("tab", { name: strings.tabVue });
  await user.click(vue);
  await waitFor(() => {
    expect(vue.getAttribute("aria-selected")).toBe("true");
  });
});

test("the sheet layout downloads the toned file", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(() => Promise.resolve(new Response("", { status: 500 })));
  vi.stubGlobal("fetch", fetchMock);
  render(<EmojiDetail emoji={emoji} name="Waving hand" tone="light" size={96} strings={strings} />);
  const light = emoji.tones.find((variant) => variant.tone === "light");
  if (!light) throw new Error("fixture needs a light tone");

  await user.click(screen.getByRole("button", { name: strings.fileActionDownloadWebp }));

  expect(fetchMock).toHaveBeenCalledWith(fileUrl(light.urls.webp));
});

test("highlighted tabs follow the tone and take the localized labels", () => {
  const snippetTabs = {
    plain: [tab("react", "R", "plain-react"), tab("vue", "V", "plain-vue")],
    toned: [tab("react", "R", "toned-react")],
  };

  const { unmount } = render(
    <EmojiDetail
      emoji={emoji}
      name="Waving hand"
      tone={undefined}
      size={200}
      strings={strings}
      snippetTabs={snippetTabs}
      page
    />,
  );
  expect(screen.getByRole("tab", { name: strings.tabReact })).toBeTruthy();
  expect(screen.getByRole("tab", { name: strings.tabVue })).toBeTruthy();
  expect(document.body.textContent).toContain("plain-react");
  unmount();

  render(
    <EmojiDetail
      emoji={emoji}
      name="Waving hand"
      tone="dark"
      size={200}
      strings={strings}
      snippetTabs={snippetTabs}
      page
    />,
  );
  expect(document.body.textContent).toContain("toned-react");
  expect(screen.queryByRole("tab", { name: strings.tabVue })).toBeNull();
});

test("a toned request with no toned tabs falls back to the plain ones", () => {
  render(
    <EmojiDetail
      emoji={emoji}
      name="Waving hand"
      tone="dark"
      size={200}
      strings={strings}
      snippetTabs={{ plain: [tab("react", "React", "plain-only")], toned: [] }}
      page
    />,
  );

  expect(document.body.textContent).toContain("plain-only");
});
