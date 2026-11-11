import { copyWithFeedback } from "../lib/copy-feedback";
import {
  createPackageManagerStore,
  isPackageManager,
  type PackageManager,
} from "../lib/package-manager";

function setCopied(block: HTMLElement, copied: boolean): void {
  const button = block.querySelector<HTMLElement>("[data-install-copy]");
  const status = block.querySelector<HTMLElement>("[data-install-status]");
  const label = (copied ? block.dataset.copiedLabel : block.dataset.copyLabel) ?? "";
  button?.toggleAttribute("data-copied", copied);
  button?.setAttribute("aria-label", label);
  if (status) {
    status.textContent = copied ? label : "";
  }
}

function copyActiveCommand(block: HTMLElement): void {
  const panel = block.querySelector<HTMLElement>(".afe-install-panel:not([hidden])");
  const command = panel?.dataset.command;
  if (command) {
    void copyWithFeedback(
      command,
      (copied) => {
        setCopied(block, copied);
      },
      block,
    );
  }
}

function applyManager(manager: PackageManager): void {
  for (const block of document.querySelectorAll("[data-install-block]")) {
    for (const button of block.querySelectorAll("button[data-package-manager]")) {
      button.setAttribute(
        "aria-pressed",
        String((button as HTMLElement).dataset.packageManager === manager),
      );
    }
    for (const panel of block.querySelectorAll(".afe-install-panel")) {
      panel.toggleAttribute("hidden", (panel as HTMLElement).dataset.packageManager !== manager);
    }
  }
}

/**
 * Wires the install blocks of a docs page to the shared `afe:pm` preference:
 * shows the stored manager on load, switches on click and follows changes made
 * by other blocks.
 */
export function initInstallBlocks(): void {
  if (!document.querySelector("[data-install-block]")) {
    return;
  }
  const store = createPackageManagerStore();
  applyManager(store.get());
  store.subscribe(applyManager);
  document.addEventListener("click", (event) => {
    const copyButton = (event.target as Element).closest("[data-install-copy]");
    const copyBlock = copyButton?.closest<HTMLElement>("[data-install-block]");
    if (copyBlock) {
      copyActiveCommand(copyBlock);
      return;
    }
    const button = (event.target as Element).closest(
      "[data-install-block] button[data-package-manager]",
    );
    const manager = (button as HTMLElement | null)?.dataset.packageManager;
    if (isPackageManager(manager)) {
      store.set(manager);
    }
  });
}
