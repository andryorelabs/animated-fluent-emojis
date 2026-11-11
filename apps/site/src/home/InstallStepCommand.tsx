import { installCommand } from "@/lib/package-manager";
import { usePackageManager } from "@/lib/use-package-manager";

/**
 * The install command of the landing install step. It follows the page-wide
 * package manager choice, so it matches the hero block and the floating dock.
 * @returns A muted mono line with the install command of the chosen manager.
 */
export default function InstallStepCommand() {
  const [manager] = usePackageManager();

  return (
    <code
      data-install-command
      className="block min-w-0 truncate font-mono text-xs text-muted-foreground"
    >
      {installCommand(manager)}
    </code>
  );
}
