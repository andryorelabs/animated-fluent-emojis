import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyWithFeedback } from "@/lib/copy-feedback";
import {
  installCommand,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManagerStore,
} from "@/lib/package-manager";
import { usePackageManager } from "@/lib/use-package-manager";
import { cn } from "@/lib/utilities";

const ICON_FADE =
  "transition-opacity-scale-filter duration-150 ease-(--ease-out-strong) motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:duration-100";
const ICON_HIDDEN = "scale-80 opacity-0 blur-xs";

interface DockInstallLabels {
  label: string;
  tabsLabel: string;
  copy: string;
  copied: string;
}

export interface DockInstallProps {
  labels: DockInstallLabels;
  store?: PackageManagerStore;
}

/**
 * The content of the floating dock: one tab per package manager with a sliding
 * pill, and a button that copies the install command of the chosen manager.
 * The choice is shared with every other install block through the package
 * manager store, so changing it here updates the hero and install section.
 * Every manager is always listed; on narrow screens the tabs scroll inside the
 * dock instead of wrapping or being dropped.
 * @param props - Component props.
 * @param props.labels - Localized group, tab list and copy button labels.
 * @param props.store - The shared preference; defaults to the page-wide store.
 * @returns The dock controls.
 */
export default function DockInstall({ labels, store: providedStore }: DockInstallProps) {
  const [manager, setManager] = usePackageManager(providedStore);
  const [copied, setCopied] = useState(false);

  return (
    <div
      role="group"
      aria-label={labels.label}
      className="flex h-12 w-full min-w-0 items-center gap-1 px-0.5"
    >
      <Tabs
        variant="dock"
        value={manager}
        onValueChange={(value) => {
          if (isPackageManager(value)) setManager(value);
        }}
        className="min-w-0 flex-1"
      >
        <TabsList
          pill
          activateOnFocus
          aria-label={labels.tabsLabel}
          dense
          className="min-w-0 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          {PACKAGE_MANAGERS.map((id) => (
            <TabsTrigger key={id} value={id} className="min-w-11 touch-manipulation select-none">
              {id}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <code
        data-dock-command
        className="mx-1 hidden shrink-0 truncate font-mono text-meta text-muted-foreground min-[640px]:inline"
      >
        {installCommand(manager)}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        shape="pill"
        className="size-11 shrink-0 touch-manipulation select-none"
        aria-label={copied ? labels.copied : labels.copy}
        onClick={() => void copyWithFeedback(installCommand(manager), setCopied)}
      >
        <span className="grid *:col-start-1 *:row-start-1">
          <CopyIcon className={cn(ICON_FADE, copied && ICON_HIDDEN)} />
          <CheckIcon className={cn(ICON_FADE, !copied && ICON_HIDDEN)} />
        </span>
      </Button>
      <span role="status" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
    </div>
  );
}
