import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { COPIED_MS } from "@/lib/copy-feedback";

import CodeBlock, { type CodeBlockTab } from "./CodeBlock";

const labels = { tabsLabel: "Framework", copy: "Copy code", copied: "Copied" };

const tabs: CodeBlockTab[] = [
  {
    id: "react",
    label: "React",
    code: '<Emoji id="wave" />',
    html: '<div class="ec-line"><div class="code">react-markup</div></div>',
    highlightLine: 1,
  },
  {
    id: "vue",
    label: "Vue",
    code: "<fluent-emoji />\n<p />",
    html: '<div class="ec-line"><div class="code">vue-markup</div></div>',
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("choosing a tab switches the copied code and reports the id", async () => {
  const user = userEvent.setup();
  const onActiveChange = vi.fn();
  render(<CodeBlock tabs={tabs} labels={labels} onActiveChange={onActiveChange} />);

  await user.click(screen.getByRole("tab", { name: "Vue" }));
  expect(onActiveChange).toHaveBeenCalledWith("vue");
  expect(screen.getByRole("tab", { name: "Vue" }).getAttribute("aria-selected")).toBe("true");

  await user.click(screen.getByRole("button", { name: "Copy code" }));
  expect(await navigator.clipboard.readText()).toBe("<fluent-emoji />\n<p />");
});

test("a successful copy flips the label, calls onCopied and reverts after the delay", async () => {
  const user = userEvent.setup();
  const onCopied = vi.fn();
  render(<CodeBlock tabs={tabs} labels={labels} onCopied={onCopied} copyEffect={<i data-fx />} />);

  expect(document.querySelector("[data-fx]")).not.toBeNull();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await user.click(screen.getByRole("button", { name: "Copy code" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });
  expect(onCopied).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toBe("Copied");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(COPIED_MS);
  });
  expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("");
});

test("the controlled activeId wins over the local choice", async () => {
  const user = userEvent.setup();
  render(<CodeBlock tabs={tabs} labels={labels} activeId="react" />);

  await user.click(screen.getByRole("tab", { name: "Vue" }));
  await user.click(screen.getByRole("button", { name: "Copy code" }));

  expect(await navigator.clipboard.readText()).toBe('<Emoji id="wave" />');
});

test("slot values are swapped into the rendered placeholder tokens", () => {
  const slotTabs: CodeBlockTab[] = [
    {
      id: "react",
      label: "React",
      code: "x",
      html: '<div class="ec-line"><span data-snippet-slot="id">wave</span></div>',
    },
  ];
  const { rerender } = render(<CodeBlock tabs={slotTabs} labels={labels} />);
  rerender(<CodeBlock tabs={slotTabs} labels={labels} slotValues={{ id: "party" }} />);

  expect(document.querySelector("[data-snippet-slot]")?.textContent).toBe("party");
});

test("the cmd variant shows the plain command and keeps the copy control", async () => {
  const user = userEvent.setup();
  render(<CodeBlock tabs={tabs} labels={labels} variant="cmd" />);

  expect(document.querySelector("[data-command-row]")).not.toBeNull();
  expect(document.querySelector("code")?.textContent).toBe('<Emoji id="wave" />');
  await user.click(screen.getByRole("tab", { name: "Vue" }));
  await user.click(screen.getByRole("button", { name: "Copy code" }));
  expect(await navigator.clipboard.readText()).toBe("<fluent-emoji />\n<p />");
});

test("a single tab with no leading content hides the tab list", () => {
  render(<CodeBlock tabs={tabs.slice(0, 1)} labels={labels} />);

  expect(screen.queryByRole("tablist")).toBeNull();
});

test("a failed clipboard write leaves the label and skips onCopied", async () => {
  const user = userEvent.setup();
  const onCopied = vi.fn();
  render(<CodeBlock tabs={tabs} labels={labels} onCopied={onCopied} />);
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

  await user.click(screen.getByRole("button", { name: "Copy code" }));

  expect(onCopied).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
});
