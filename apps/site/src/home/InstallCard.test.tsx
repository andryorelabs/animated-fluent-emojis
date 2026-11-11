import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import InstallCard from "./InstallCard";

const labels = { tabsLabel: "Framework", copy: "Copy code", copied: "Copied" };
const tabs = [
  { id: "react", label: "React", code: "<Emoji />", html: "react-markup" },
  { id: "vue", label: "Vue", code: "<Emoji />", html: "vue-markup" },
];
const previews = { react: "atomsymbol", vue: "rainbow" };

function render(): string {
  return renderToString(<InstallCard tabs={tabs} previews={previews} labels={labels} />);
}

test("InstallCard renders the code block and a preview per framework", () => {
  const html = render();

  expect(html).toContain('role="tablist"');
  expect(html).toContain("tab-pill-list");
  expect(html).toContain('data-variant="card"');
  expect(html).toContain('data-testid="install-preview"');
  expect(html.match(/data-preview-id=/g)).toHaveLength(2);
});

test("InstallCard shows only the first framework preview before any choice", () => {
  const html = render();

  expect(html).toMatch(/data-preview-id="react"[^>]*data-active="true"/);
  expect(html).toMatch(/data-preview-id="vue"[^>]*data-active="false"/);
});

test("InstallCard shows the active tab id in a chip and no line numbers", () => {
  const html = render();

  expect(html).toMatch(/data-testid="install-preview-chip"[^>]*>react</);
  expect(html).toContain('data-line-numbers="false"');
});

test("InstallCard hides the decorative preview from assistive technology", () => {
  expect(render()).toMatch(/data-testid="install-preview"[^>]*aria-hidden="true"/);
});
