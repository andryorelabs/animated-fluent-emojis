import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { initInstallBlocks } from "./install-block-client";

const BLOCK_HTML = `
  <div data-install-block data-copy-label="Copy" data-copied-label="Copied">
    <button data-package-manager="bun">bun</button>
    <button data-package-manager="npm">npm</button>
    <div class="afe-install-panel" data-package-manager="bun" data-command="bun add pkg"></div>
    <div class="afe-install-panel" data-package-manager="npm" data-command="npm install pkg"></div>
    <button data-install-copy aria-label="Copy"></button>
    <span data-install-status></span>
  </div>`;

function find(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`missing ${selector}`);
  return element;
}

function panel(manager: string): HTMLElement {
  return find(`.afe-install-panel[data-package-manager="${manager}"]`);
}

function tab(manager: string): HTMLElement {
  return find(`button[data-package-manager="${manager}"]`);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

test("a page without install blocks is left alone", () => {
  document.body.innerHTML = "<p>no blocks</p>";

  expect(() => {
    initInstallBlocks();
  }).not.toThrow();
});

test("the stored manager is shown on load and clicking a tab switches and persists it", async () => {
  localStorage.setItem("afe:pm", "npm");
  document.body.innerHTML = BLOCK_HTML;
  initInstallBlocks();

  expect(tab("npm").getAttribute("aria-pressed")).toBe("true");
  expect(tab("bun").getAttribute("aria-pressed")).toBe("false");
  expect(panel("bun").hidden).toBe(true);
  expect(panel("npm").hidden).toBe(false);

  const user = userEvent.setup();
  await user.click(tab("bun"));

  expect(localStorage.getItem("afe:pm")).toBe("bun");
  expect(tab("bun").getAttribute("aria-pressed")).toBe("true");
  expect(panel("npm").hidden).toBe(true);
});

test("clicking something unrelated changes nothing", async () => {
  document.body.innerHTML = `${BLOCK_HTML}<p id="other">text</p>`;
  initInstallBlocks();

  const user = userEvent.setup();
  await user.click(find("#other"));

  expect(localStorage.getItem("afe:pm")).toBeNull();
  expect(tab("bun").getAttribute("aria-pressed")).toBe("true");
});

test("the copy button writes the visible command and shows the copied label", async () => {
  document.body.innerHTML = BLOCK_HTML;
  initInstallBlocks();
  const user = userEvent.setup();

  await user.click(tab("npm"));
  await user.click(find("[data-install-copy]"));

  expect(await navigator.clipboard.readText()).toBe("npm install pkg");
  await vi.waitFor(() => {
    expect(find("[data-install-status]").textContent).toBe("Copied");
  });
  const copyButton = find("[data-install-copy]");
  expect(copyButton.dataset.copied).toBeDefined();
  expect(copyButton.getAttribute("aria-label")).toBe("Copied");
});

test("a copy with no visible command writes nothing", async () => {
  document.body.innerHTML = BLOCK_HTML.replaceAll('data-command="bun add pkg"', "");
  initInstallBlocks();
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText");

  await user.click(find("[data-install-copy]"));

  expect(write).not.toHaveBeenCalled();
});
