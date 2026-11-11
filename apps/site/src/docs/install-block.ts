import type { Locale } from "../i18n/locales";
import { getUi } from "../i18n/ui";
import { PACKAGE_MANAGERS, type PackageManager } from "../lib/package-manager";

export interface InstallCommand {
  packages: string[];
  development: boolean;
}

const COMMAND_PATTERN =
  /^(?:npm (?:install|i|add)|pnpm (?:add|install|i)|yarn add|bun (?:add|install|i)) (.+)$/;
const PACKAGE_PATTERN = /^(?:@[\w.-]+\/)?[\w][\w.-]*(?:@[\w.^~<>=*-]+)?$/;
const DEV_FLAGS = new Set(["-D", "-d", "--save-dev", "--dev"]);
const SHELL_INFO = /^(?:sh|bash|shell|zsh)$/;
const FENCE_OPEN = /^(`{3,}|~{3,})([^`]*)$/;

const INSTALL_VERBS: Record<PackageManager, string> = {
  bun: "bun add",
  npm: "npm install",
  pnpm: "pnpm add",
  yarn: "yarn add",
};

const DEV_FLAG_BY_MANAGER: Record<PackageManager, string> = {
  bun: "-d",
  npm: "-D",
  pnpm: "-D",
  yarn: "-D",
};

/**
 * Reads a single package install command written for any supported package
 * manager. Anything with other flags, shell operators or no package name is
 * rejected so only unambiguous commands are ever rewritten.
 * @param line - One line of shell.
 * @returns The packages and whether they are dev dependencies, or `undefined`.
 */
export function parseInstallCommand(line: string): InstallCommand | undefined {
  const match = COMMAND_PATTERN.exec(line.trim());
  if (!match?.[1]) {
    return undefined;
  }
  const packages: string[] = [];
  let development = false;
  const tokens = match[1].split(/\s+/);
  for (const token of tokens) {
    if (DEV_FLAGS.has(token)) {
      development = true;
    } else if (PACKAGE_PATTERN.test(token)) {
      packages.push(token);
    } else {
      return undefined;
    }
  }
  return packages.length > 0 ? { packages, development } : undefined;
}

function commandFor(manager: PackageManager, command: InstallCommand): string {
  const flag = command.development ? ` ${DEV_FLAG_BY_MANAGER[manager]}` : "";
  return `${INSTALL_VERBS[manager]}${flag} ${command.packages.join(" ")}`;
}

const SVG_OPEN =
  '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const TERMINAL_ICON = `${SVG_OPEN} class="afe-install-icon"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></svg>`;
const COPY_ICON = `${SVG_OPEN} class="afe-install-copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON = `${SVG_OPEN} class="afe-install-check-icon"><path d="M20 6 9 17l-5-5"/></svg>`;

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInstallBlock(command: InstallCommand, locale: Locale): string[] {
  const { hero } = getUi(locale).home;
  const copy = escapeAttribute(hero.copy);
  const copied = escapeAttribute(hero.copied);
  const buttons = PACKAGE_MANAGERS.map(
    (manager) =>
      `<button type="button" data-package-manager="${manager}" aria-pressed="${String(manager === PACKAGE_MANAGERS[0])}">${manager}</button>`,
  );
  const panels = PACKAGE_MANAGERS.flatMap((manager, index) => [
    `<div class="afe-install-panel" data-package-manager="${manager}" data-command="${escapeAttribute(commandFor(manager, command))}"${index === 0 ? "" : " hidden"}>`,
    "",
    '```sh frame="none"',
    commandFor(manager, command),
    "```",
    "",
    "</div>",
    "",
  ]);
  return [
    `<div class="afe-install" data-install-block data-copy-label="${copy}" data-copied-label="${copied}">`,
    '<div class="afe-install-header">',
    TERMINAL_ICON,
    `<div class="afe-install-tabs" role="group" aria-label="${escapeAttribute(hero.installLabel)}">`,
    ...buttons,
    "</div>",
    `<button type="button" class="afe-install-copy" data-install-copy aria-label="${copy}">${COPY_ICON}${CHECK_ICON}</button>`,
    "</div>",
    '<span class="afe-install-status" role="status" data-install-status></span>',
    "",
    ...panels,
    "</div>",
  ];
}

function findClosingFence(lines: string[], from: number, marker: string): number {
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith(marker) && /^[`~]+\s*$/.test(line)) {
      return index;
    }
  }
  return -1;
}

/**
 * Rewrites every unindented `sh` fence that holds exactly one package install
 * command into a block with one highlighted command per package manager, which
 * the page script keeps in sync with the `afe:pm` preference. Run on the
 * rendered copy only: the stored Markdown source, and with it copy-as-Markdown
 * and GitHub, keeps the original command.
 * @param body - Markdown source.
 * @param locale - The page locale, used for the copy button labels.
 * @returns The Markdown with install blocks expanded.
 */
export function transformInstallBlocks(body: string, locale: Locale = "en"): string {
  const lines = body.split("\n");
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const open = FENCE_OPEN.exec(line);
    if (!open) {
      output.push(line);
      continue;
    }
    const marker = open[1] ?? "```";
    const closing = findClosingFence(lines, index + 1, marker);
    if (closing === -1) {
      output.push(...lines.slice(index));
      break;
    }
    const content = lines
      .slice(index + 1, closing)
      .filter((contentLine) => contentLine.trim() !== "");
    const command =
      content.length === 1 && SHELL_INFO.test((open[2] ?? "").trim())
        ? parseInstallCommand(content[0] ?? "")
        : undefined;
    output.push(
      ...(command ? renderInstallBlock(command, locale) : lines.slice(index, closing + 1)),
    );
    index = closing;
  }
  return output.join("\n");
}
