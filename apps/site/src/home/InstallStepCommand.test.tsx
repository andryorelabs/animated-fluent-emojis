import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { DEFAULT_PACKAGE_MANAGER, installCommand } from "@/lib/package-manager";

import InstallStepCommand from "./InstallStepCommand";

test("InstallStepCommand renders the install command of the default package manager", () => {
  const html = renderToString(<InstallStepCommand />);

  expect(html).toContain("data-install-command");
  expect(html).toContain(installCommand(DEFAULT_PACKAGE_MANAGER));
});
