import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { installCommand, PACKAGE_MANAGERS } from "@/lib/package-manager";

import InstallBlock from "./InstallBlock";

const labels = {
  tabsLabel: "Package manager",
  copy: "Copy",
  copied: "Copied",
};

const htmlByManager = Object.fromEntries(
  PACKAGE_MANAGERS.map((id) => [id, `<pre>${id}</pre>`]),
) as Record<(typeof PACKAGE_MANAGERS)[number], string>;

test("InstallBlock renders the sliding tab-pill indicator", () => {
  const html = renderToString(<InstallBlock htmlByManager={htmlByManager} labels={labels} />);

  expect(html).toContain("tab-pill-list");
  expect(html).toContain('class="tab-pill"');
});

test("InstallBlock uses the cmd tab variant with a plain command and no terminal icon", () => {
  const html = renderToString(<InstallBlock htmlByManager={htmlByManager} labels={labels} />);

  expect(html).toContain('data-variant="cmd"');
  expect(html).not.toContain("lucide-terminal");
  expect(html).toContain("data-command-row");
  expect(html).toContain(installCommand("bun"));
  expect(html).not.toContain("<pre>bun</pre>");
});
