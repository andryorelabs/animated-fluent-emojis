import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { CodeBlockTab } from "@/components/CodeBlock";

import InstallCard from "./InstallCard";

const labels = { tabsLabel: "Framework", copy: "Copy code", copied: "Copied" };

const tabs: CodeBlockTab[] = [
  {
    id: "react",
    label: "React",
    code: "react-code",
    html: "<div>react-markup</div>",
  },
  { id: "vue", label: "Vue", code: "vue-code", html: "<div>vue-markup</div>" },
  {
    id: "bare",
    label: "Bare",
    code: "bare-code",
    html: "<div>bare-markup</div>",
  },
];

const previews = { react: "1f44b_wavinghand", vue: "1f389_partypopper" };

beforeEach(() => {
  vi.stubGlobal("fetch", () => new Promise(vi.fn()));
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("choosing a tab moves the active preview and the chip", async () => {
  const user = userEvent.setup();
  render(<InstallCard tabs={tabs} previews={previews} labels={labels} />);

  const chip = screen.getByTestId("install-preview-chip");
  expect(chip.textContent).toBe("react");
  expect(document.querySelector<HTMLElement>('[data-preview-id="react"]')?.dataset.active).toBe(
    "true",
  );

  await user.click(screen.getByRole("tab", { name: "Vue" }));

  expect(chip.textContent).toBe("vue");
  expect(document.querySelector<HTMLElement>('[data-preview-id="vue"]')?.dataset.active).toBe(
    "true",
  );
  expect(document.querySelector<HTMLElement>('[data-preview-id="react"]')?.dataset.active).toBe(
    "false",
  );
});

test("a tab without a preview renders no preview slot", () => {
  render(<InstallCard tabs={tabs} previews={previews} labels={labels} />);

  expect(document.querySelectorAll("[data-preview-id]")).toHaveLength(2);
  expect(document.querySelector<HTMLElement>('[data-preview-id="bare"]')).toBeNull();
});

test("a copy writes the active snippet and sets off the burst", async () => {
  const user = userEvent.setup();
  render(<InstallCard tabs={tabs} previews={previews} labels={labels} />);

  await user.click(screen.getByRole("tab", { name: "Vue" }));
  await user.click(screen.getByRole("button", { name: "Copy code" }));

  expect(await navigator.clipboard.readText()).toBe("vue-code");
  expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  expect(document.querySelector("[data-copy-burst]")).not.toBeNull();
});

test("an empty tab list renders an empty chip", () => {
  render(<InstallCard tabs={[]} previews={{}} labels={labels} />);

  expect(screen.getByTestId("install-preview-chip").textContent).toBe("");
});
