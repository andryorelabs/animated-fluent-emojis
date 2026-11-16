import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { FILES_SITE_ORIGIN } from "../../gallery/public-index";
import type { SearchEntry } from "../../gallery/search";
import { getUi } from "../../i18n/ui";
import { Gallery } from "./Gallery";

vi.mock("animated-fluent-emojis/react", () => ({
  Emoji: (props: { id: string; alt: string }) => (
    <img alt={props.alt} data-testid="live-emoji" data-id={props.id} />
  ),
}));

const SEARCH_URL = "/search/en.json";
const GALLERY_PATH = "/gallery/";
const PAGE_SIZE = 96;
const FILLER_COUNT = 98;
const strings = getUi("en").gallery;

function fixtureEntry(position: number): (typeof fixture)[number] {
  const found = fixture[position];
  if (!found) throw new Error(`fixture needs an emoji at ${String(position)}`);
  return found;
}

const smiley = fixtureEntry(0);
const wave = fixtureEntry(1);
const fire = fixtureEntry(2);

const fillers = Array.from({ length: FILLER_COUNT }, (_, index) => ({
  ...fire,
  slug: `filler-${String(index)}`,
  id: `filler_${String(index)}`,
  description: `Filler ${String(index)}`,
  category: "Fillers",
}));
const rawIndex = [smiley, wave, fire, ...fillers];
const TOTAL = rawIndex.length;
const searchIndex: SearchEntry[] = [
  {
    slug: smiley.slug,
    name: "Grinning face with big eyes",
    keywords: ["smile"],
  },
  { slug: wave.slug, name: "Waving hand", keywords: ["wave", "hello"] },
  { slug: fire.slug, name: "Fire", keywords: ["flame", "hot"] },
];

const network = { failing: false };

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (network.failing) return Promise.resolve(new Response("", { status: 500 }));
      const body = url === `${FILES_SITE_ORIGIN}/index.json` ? rawIndex : searchIndex;
      return Promise.resolve(Response.json(body));
    }),
  );
}

function stubViewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  network.failing = false;
  globalThis.history.replaceState(null, "", GALLERY_PATH);
  stubFetch();
  stubViewport(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  globalThis.history.replaceState(null, "", "/");
});

function renderGallery() {
  return render(<Gallery locale="en" searchIndexUrl={SEARCH_URL} strings={strings} />);
}

async function findGrid(): Promise<HTMLElement> {
  return screen.findByRole("group", { name: strings.resultsLabel });
}

function tiles(grid: HTMLElement): HTMLButtonElement[] {
  return [...grid.querySelectorAll<HTMLButtonElement>("button[data-slug]")];
}

function tile(grid: HTMLElement, slug: string): HTMLButtonElement {
  const found = grid.querySelector<HTMLButtonElement>(`button[data-slug="${CSS.escape(slug)}"]`);
  if (!found) throw new Error(`no tile for ${slug}`);
  return found;
}

function searchParameters(): URLSearchParams {
  return new URLSearchParams(globalThis.location.search);
}

function searchBox(): HTMLInputElement {
  return screen.getByRole("searchbox", { name: strings.searchLabel });
}

test("shows the skeleton, then the first page of tiles, and Show more reveals the rest", async () => {
  const user = userEvent.setup();
  renderGallery();

  expect(screen.getByRole("status", { name: strings.loading })).toBeTruthy();
  const grid = await findGrid();

  expect(tiles(grid)).toHaveLength(PAGE_SIZE);
  expect(screen.getByText(`${String(TOTAL)} emojis`)).toBeTruthy();
  expect(searchBox().placeholder).toContain(String(TOTAL));
  expect(tile(grid, wave.slug).getAttribute("aria-label")).toBe("Waving hand");
  expect(tile(grid, "filler-0").getAttribute("aria-label")).toBe("Filler 0");

  await user.click(screen.getByRole("button", { name: strings.showMore }));

  expect(tiles(grid)).toHaveLength(TOTAL);
  expect(screen.queryByRole("button", { name: strings.showMore })).toBeNull();
});

test("a failed load shows the error and Try again loads the gallery", async () => {
  const user = userEvent.setup();
  network.failing = true;
  renderGallery();

  await screen.findByText(strings.errorTitle);
  expect(screen.getByText(strings.errorHint)).toBeTruthy();

  network.failing = false;
  await user.click(screen.getByRole("button", { name: strings.retry }));

  expect(await findGrid()).toBeTruthy();
});

test("searching filters the tiles and writes the query to the URL, and Clear search resets it", async () => {
  const user = userEvent.setup();
  renderGallery();
  const grid = await findGrid();

  await user.type(searchBox(), "wave");

  expect(tiles(grid).map((button) => button.dataset.slug)).toEqual([wave.slug]);
  expect(searchParameters().get("q")).toBe("wave");

  await user.clear(searchBox());
  await user.type(searchBox(), "zzzz");
  expect(screen.getByText(`No emoji matches “zzzz”`)).toBeTruthy();

  await user.click(screen.getByRole("button", { name: strings.clearSearch }));

  expect(searchBox().value).toBe("");
  expect(tiles(await findGrid())).toHaveLength(PAGE_SIZE);
  expect(globalThis.location.search).toBe("");
});

test("the filters start from the URL", async () => {
  globalThis.history.replaceState(null, "", `${GALLERY_PATH}?q=fire&s=128&tone=dark#top`);
  renderGallery();
  const grid = await findGrid();

  expect(searchBox().value).toBe("fire");
  expect(tiles(grid).map((button) => button.dataset.slug)).toEqual([fire.slug]);
  expect(grid.className).toContain("grid");
  expect(searchParameters().get("s")).toBe("128");
  expect(searchParameters().get("tone")).toBe("dark");
  expect(globalThis.location.hash).toBe("#top");
});

test("Ctrl+K and Cmd+K focus and select the search, other keys do not", async () => {
  renderGallery();
  await findGrid();
  const input = searchBox();
  input.value = "";

  fireEvent.keyDown(globalThis.window, { key: "j", ctrlKey: true });
  expect(document.activeElement).not.toBe(input);
  fireEvent.keyDown(globalThis.window, { key: "k" });
  expect(document.activeElement).not.toBe(input);

  fireEvent.keyDown(globalThis.window, { key: "K", ctrlKey: true });
  expect(document.activeElement).toBe(input);

  input.blur();
  fireEvent.keyDown(globalThis.window, { key: "k", metaKey: true });
  expect(document.activeElement).toBe(input);
});

test("the shortcut hint reads ⌘K on Apple devices and Ctrl K elsewhere", async () => {
  vi.spyOn(globalThis.navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
  );
  const { unmount } = renderGallery();
  await findGrid();
  expect(screen.getByText("⌘K")).toBeTruthy();
  unmount();

  vi.spyOn(globalThis.navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (X11; Linux x86_64)",
  );
  renderGallery();
  await findGrid();
  expect(screen.getByText("Ctrl K")).toBeTruthy();
});

test("the desktop sidebar filters by category and sets the tone and size", async () => {
  const user = userEvent.setup();
  renderGallery();
  const grid = await findGrid();
  const sidebar = screen.getByRole("complementary", {
    name: strings.filtersButton,
  });
  const categories = within(sidebar).getByRole("group", {
    name: strings.categoryLabel,
  });

  await user.click(within(categories).getByRole("button", { name: /Hand gestures/ }));
  expect(tiles(grid).map((button) => button.dataset.slug)).toEqual([wave.slug]);
  expect(searchParameters().get("c")).toBe("Hand gestures");

  await user.click(within(sidebar).getByRole("button", { name: strings.toneDark }));
  expect(searchParameters().get("tone")).toBe("dark");

  await user.click(within(sidebar).getByRole("button", { name: "128" }));
  expect(searchParameters().get("s")).toBe("128");

  await user.click(
    within(categories).getByRole("button", {
      name: new RegExp(strings.categoryAll),
    }),
  );
  expect(searchParameters().get("c")).toBeNull();
  expect(tiles(grid)).toHaveLength(PAGE_SIZE);
});

test("choosing a tile opens the emoji sheet, another tile updates it, and close clears the selection", async () => {
  const user = userEvent.setup();
  renderGallery();
  const grid = await findGrid();

  await user.click(tile(grid, wave.slug));

  const sheet = await screen.findByRole("region", { name: "Waving hand" });
  expect(sheet).toBeTruthy();
  expect(tile(grid, wave.slug).getAttribute("aria-pressed")).toBe("true");
  expect(tile(grid, wave.slug).tabIndex).toBe(0);
  expect(tile(grid, smiley.slug).tabIndex).toBe(-1);

  await user.click(tile(grid, smiley.slug));
  expect(await screen.findByRole("region", { name: "Grinning face with big eyes" })).toBeTruthy();
  expect(tile(grid, wave.slug).getAttribute("aria-pressed")).toBe("false");
  const sidebar = screen.getByRole("complementary", {
    name: strings.filtersButton,
  });
  const toneGroup = within(sidebar).getByRole("group", {
    name: strings.toneLabel,
  });
  expect(within(toneGroup).getAllByRole("button")[0]?.getAttribute("aria-disabled")).toBe("true");

  await user.click(screen.getByRole("button", { name: strings.closeDetail }));
  await waitFor(() => {
    expect(tile(grid, smiley.slug).getAttribute("aria-pressed")).toBe("false");
  });
});

test("a filtered-out selection drops the sheet and a new query closes it", async () => {
  const user = userEvent.setup();
  renderGallery();
  const grid = await findGrid();

  await user.click(tile(grid, fire.slug));
  await screen.findByRole("region", { name: "Fire" });

  await user.type(searchBox(), "f");
  await waitFor(() => {
    expect(tile(grid, fire.slug).getAttribute("aria-pressed")).toBe("false");
  });

  await user.clear(searchBox());
  await user.type(searchBox(), "wave");
  await waitFor(() => {
    expect(screen.queryByRole("region", { name: "Fire" })).toBeNull();
  });
});

test("arrow, Home and End keys move the roving focus across the tiles", async () => {
  renderGallery();
  const grid = await findGrid();
  const all = tiles(grid);
  const [first, second] = all;
  const last = all.at(-1);
  if (!first || !second || !last) throw new Error("expected tiles");

  first.focus();
  fireEvent.keyDown(first, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(first);

  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(second);
  expect(second.tabIndex).toBe(0);
  expect(first.tabIndex).toBe(-1);

  fireEvent.keyDown(second, { key: "ArrowUp" });
  expect(document.activeElement).toBe(first);

  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(second);

  fireEvent.keyDown(second, { key: "End" });
  expect(document.activeElement).toBe(last);

  fireEvent.keyDown(last, { key: "Home" });
  expect(document.activeElement).toBe(first);

  fireEvent.keyDown(first, { key: "a" });
  expect(document.activeElement).toBe(first);
});

test("hovering or focusing a tile arms its live emoji once", async () => {
  renderGallery();
  const grid = await findGrid();

  expect(screen.queryAllByTestId("live-emoji")).toHaveLength(0);
  fireEvent.pointerOver(grid);
  expect(screen.queryAllByTestId("live-emoji")).toHaveLength(0);

  fireEvent.pointerOver(tile(grid, wave.slug));
  expect(screen.getAllByTestId("live-emoji")).toHaveLength(1);
  fireEvent.pointerOver(tile(grid, wave.slug));
  expect(screen.getAllByTestId("live-emoji")).toHaveLength(1);

  fireEvent.focus(tile(grid, fire.slug));
  expect(screen.getAllByTestId("live-emoji").map((emoji) => emoji.dataset.id)).toEqual([
    wave.id,
    fire.id,
  ]);
});

test("on a narrow screen the filters open in a bottom sheet with a close button", async () => {
  const user = userEvent.setup();
  stubViewport(false);
  renderGallery();
  const grid = await findGrid();

  expect(screen.queryByRole("complementary")).toBeNull();
  await user.click(screen.getByRole("button", { name: strings.filtersButton }));

  const filters = await screen.findByRole("dialog", {
    name: strings.filtersButton,
  });
  await user.click(within(filters).getByRole("button", { name: /Hand gestures/ }));
  expect(tiles(grid).map((button) => button.dataset.slug)).toEqual([wave.slug]);

  await user.click(within(filters).getByRole("button", { name: strings.closeDetail }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: strings.filtersButton })).toBeNull();
  });
});

test("hydrating the server skeleton keeps the desktop layout until data arrives", async () => {
  const ui = <Gallery locale="en" searchIndexUrl={SEARCH_URL} strings={strings} />;
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);

  render(ui, { container, hydrate: true });

  expect(screen.getByRole("status", { name: strings.loading })).toBeTruthy();
  expect(await findGrid()).toBeTruthy();
  container.remove();
});
