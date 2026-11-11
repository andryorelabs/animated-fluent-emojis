import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import CodeBlock from "./CodeBlock";
import InstallBlock from "./InstallBlock";

const labels = { tabsLabel: "Framework", copy: "Copy code", copied: "Copied" };

const tabs = [
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
    code: '<Emoji id="wave" />\n<p />',
    html: '<div class="ec-line"><div class="code">vue-markup</div></div>',
  },
];

test("CodeBlock renders a tab list, every panel mounted and a copy button", () => {
  const html = renderToString(<CodeBlock tabs={tabs} labels={labels} />);

  expect(html).toContain('role="tablist"');
  expect(html).toContain('aria-label="Framework"');
  expect(html.match(/role="tab"/g)).toHaveLength(2);
  expect(html).toContain("react-markup");
  expect(html).toContain("vue-markup");
  expect(html).toContain('aria-label="Copy code"');
});

test("CodeBlock stacks the panels in one cell so the height never jumps", () => {
  const html = renderToString(<CodeBlock tabs={tabs} labels={labels} />);

  expect(html.match(/col-start-1 row-start-1/g)).toHaveLength(2);
});

test("CodeBlock reserves the height of its tallest panel from the line counts", () => {
  const html = renderToString(<CodeBlock tabs={tabs} labels={labels} />);

  expect(html).toContain("--code-body-min-height:5rem");
});

test("CodeBlock marks the highlighted line and exposes the line number flag", () => {
  const html = renderToString(<CodeBlock tabs={tabs} labels={labels} />);

  expect(html).toContain("ec-line ec-line-highlight");
  expect(html).toContain('data-line-numbers="true"');
  expect(renderToString(<CodeBlock tabs={tabs} labels={labels} lineNumbers={false} />)).toContain(
    'data-line-numbers="false"',
  );
});

test("CodeBlock keeps the line tab bar unless the sliding pill is asked for", () => {
  const plain = renderToString(<CodeBlock tabs={tabs} labels={labels} />);
  const pilled = renderToString(<CodeBlock tabs={tabs} labels={labels} pill />);

  expect(plain).not.toContain("tab-pill-list");
  expect(pilled).toContain("tab-pill-list");
  expect(pilled).toContain('data-variant="default"');
});

test("CodeBlock keeps the scrolling code from chaining into the page", () => {
  const html = renderToString(<CodeBlock tabs={tabs} labels={labels} />);

  expect(html).toContain("overscroll-x-contain");
});

test("InstallBlock renders a tab per package manager with bun selected", () => {
  const html = renderToString(
    <InstallBlock
      labels={labels}
      htmlByManager={{
        bun: '<div class="ec-line">bun</div>',
        npm: '<div class="ec-line">npm</div>',
        pnpm: '<div class="ec-line">pnpm</div>',
        yarn: '<div class="ec-line">yarn</div>',
      }}
    />,
  );

  expect(html.match(/role="tab"/g)).toHaveLength(4);
  expect(html).toMatch(/aria-selected="true"[^>]*>bun</);
  expect(html).toContain("data-command-row");
  expect(html).toContain("bun add animated-fluent-emojis");
});

test("CodeBlock keeps both copy icons mounted so the swap can crossfade", () => {
  const html = renderToString(<CodeBlock tabs={tabs} labels={labels} />);

  expect(html).toContain("data-copy-icon");
  expect(html).toContain("data-check-icon");
  expect(html).toMatch(/opacity-0[^>]*data-check-icon/);
});
