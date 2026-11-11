import { describe, expect, it } from "vitest";

import { parseInstallCommand, transformInstallBlocks } from "./install-block";

describe("parseInstallCommand", () => {
  it.each([
    "npm install animated-fluent-emojis",
    "npm i animated-fluent-emojis",
    "pnpm add animated-fluent-emojis",
    "yarn add animated-fluent-emojis",
    "bun add animated-fluent-emojis",
    "bun install animated-fluent-emojis",
  ])("recognises %s", (command) => {
    expect(parseInstallCommand(command)).toEqual({
      packages: ["animated-fluent-emojis"],
      development: false,
    });
  });

  it("keeps scoped packages, versions and the dev flag", () => {
    expect(parseInstallCommand("npm install -D @scope/a@1.2.3 b")).toEqual({
      packages: ["@scope/a@1.2.3", "b"],
      development: true,
    });
  });

  it.each([
    "npm install",
    "bun install",
    "npm install --global thing",
    "npm run build",
    "npm install a && npm install b",
    "npm install a; rm -rf /",
    "curl https://x.dev | sh",
  ])("rejects %s", (command) => {
    expect(parseInstallCommand(command)).toBeUndefined();
  });
});

const fence = (body: string, info = "sh"): string => "```" + info + "\n" + body + "\n```";

describe("transformInstallBlocks", () => {
  it("replaces an install block with one block per manager", () => {
    const output = transformInstallBlocks(
      `Intro\n\n${fence("npm install animated-fluent-emojis")}\n\nOutro`,
    );
    expect(output).toContain("data-install-block");
    expect(output).toContain('```sh frame="none"\nbun add animated-fluent-emojis\n```');
    expect(output).toContain('```sh frame="none"\nnpm install animated-fluent-emojis\n```');
    expect(output).toContain('```sh frame="none"\npnpm add animated-fluent-emojis\n```');
    expect(output).toContain('```sh frame="none"\nyarn add animated-fluent-emojis\n```');
    expect(output.startsWith("Intro\n\n")).toBe(true);
    expect(output.endsWith("\n\nOutro")).toBe(true);
  });

  it("renders one header row with the icon, the tabs and the copy button", () => {
    const output = transformInstallBlocks(fence("npm install pkg"));
    const header = output.slice(
      output.indexOf("afe-install-header"),
      output.indexOf("data-install-status"),
    );
    expect(header).toContain("afe-install-icon");
    expect(header.match(/data-package-manager="/g)).toHaveLength(4);
    expect(header).toContain("data-install-copy");
    expect(output).toContain('data-command="npm install pkg"');
    expect(output).toContain('data-command="bun add pkg"');
  });

  it("uses the English copy labels by default", () => {
    const output = transformInstallBlocks(fence("npm install pkg"));
    expect(output).toContain('data-copy-label="Copy"');
    expect(output).toContain('data-copied-label="Copied"');
  });

  it("localizes the copy labels", () => {
    const output = transformInstallBlocks(fence("npm install pkg"), "es");
    expect(output).toContain('data-copy-label="Copiar"');
  });

  it("maps the dev flag per manager", () => {
    const output = transformInstallBlocks(fence("yarn add --dev pkg"));
    expect(output).toContain("bun add -d pkg");
    expect(output).toContain("npm install -D pkg");
    expect(output).toContain("pnpm add -D pkg");
    expect(output).toContain("yarn add -D pkg");
  });

  it.each([
    fence("npm install a\nnpm install b"),
    fence("npm install a\nnpm run build"),
    fence("# install\nnpm install a"),
    fence("npm install a", "ts"),
    fence("npm install a", 'sh title="x"'),
    fence("bun run check"),
    "    ```sh\n    npm install a\n    ```",
  ])("leaves %j untouched", (source) => {
    expect(transformInstallBlocks(source)).toBe(source);
  });

  it("keeps an unclosed fence and everything after it as written", () => {
    const source = "before\n```sh\nnpm install a\nstill open";
    expect(transformInstallBlocks(source)).toBe(source);
  });
});
