import { CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createFileActionStore,
  DEFAULT_FILE_ACTION,
  downloadFile,
  FILE_ACTION_FORMATS,
  parseFileAction,
  runFileAction,
  type FileAction,
  type FileActionFormat,
  type FileActionTarget,
} from "@/lib/file-action";
import type { PreferenceStore } from "@/lib/persisted-preference";

import type { UiStrings } from "../../i18n/ui";

type FileActionStrings = Pick<
  UiStrings["gallery"],
  | "fileActionGroupDownload"
  | "fileActionGroupCopy"
  | "fileActionKindAnimated"
  | "fileActionKindStill"
  | "fileActionMenuLabel"
  | "fileActionDownloadWebp"
  | "fileActionDownloadGif"
  | "fileActionDownloadPng"
  | "fileActionCopyWebp"
  | "fileActionCopyGif"
  | "fileActionCopyPng"
  | "fileActionCopiedUrl"
>;

export type FileActionNotice = { kind: "copied"; message: string } | { kind: "failed" };

const FORMAT_NAMES: Record<FileActionFormat, string> = {
  webp: "WebP",
  gif: "GIF",
  png: "PNG",
};

const ACTION_LABEL_KEYS = {
  "download-webp": "fileActionDownloadWebp",
  "download-gif": "fileActionDownloadGif",
  "download-png": "fileActionDownloadPng",
  "copy-webp": "fileActionCopyWebp",
  "copy-gif": "fileActionCopyGif",
  "copy-png": "fileActionCopyPng",
} as const satisfies Record<FileAction, keyof FileActionStrings>;

const sharedStore = createFileActionStore();

/**
 * Properties of {@link FileActionButton}.
 */
export interface FileActionButtonProps {
  target: FileActionTarget;
  strings: FileActionStrings;
  onNotice: (notice: FileActionNotice) => void;
  store?: PreferenceStore<FileAction>;
  className?: string;
}

/**
 * Whether a format is a still image rather than an animation.
 * @param format - The file format.
 * @returns True for PNG, which is the static poster frame.
 */
function isStill(format: FileActionFormat): boolean {
  return format === "png";
}

/**
 * A split button over one emoji's public files. The primary part runs the
 * remembered action (download WebP by default); the chevron menu lists every
 * download and copy-URL action, and choosing one runs it and makes it the
 * primary. The choice persists under `afe:file-action` and syncs across
 * islands; without usable storage it lasts for the session.
 * @param props - The file target, the labels, a notice callback and an
 * optional store override.
 * @returns The button group.
 */
export function FileActionButton(props: FileActionButtonProps) {
  const { target, strings, onNotice } = props;
  const store = props.store ?? sharedStore;
  const action = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_FILE_ACTION);

  async function run(next: FileAction) {
    const outcome = await runFileAction(next, target, {
      download: downloadFile,
      copy: (text) => navigator.clipboard.writeText(text),
    });
    if (outcome === "failed") {
      onNotice({ kind: "failed" });
    } else if (outcome === "copied") {
      onNotice({
        kind: "copied",
        message: strings.fileActionCopiedUrl
          .split("{format}")
          .join(FORMAT_NAMES[parseFileAction(next).format]),
      });
    }
  }

  function choose(next: FileAction) {
    store.set(next);
    void run(next);
  }

  const { verb } = parseFileAction(action);
  const PrimaryIcon = verb === "copy" ? CopyIcon : DownloadIcon;

  return (
    <ButtonGroup width="full" className={props.className}>
      <Button variant="outline" className="min-w-0 flex-1" onClick={() => void run(action)}>
        <PrimaryIcon />
        <span className="truncate">{strings[ACTION_LABEL_KEYS[action]]}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={strings.fileActionMenuLabel} variant="split">
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent variant="split" align="end">
          {(["download", "copy"] as const).map((group, index) => (
            <DropdownMenuGroup key={group}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                {group === "download"
                  ? strings.fileActionGroupDownload
                  : strings.fileActionGroupCopy}
              </DropdownMenuLabel>
              {FILE_ACTION_FORMATS.map((format) => {
                const item: FileAction = `${group}-${format}`;
                const current = item === action;
                return (
                  <DropdownMenuItem
                    key={item}
                    aria-current={current ? "true" : undefined}
                    onClick={() => {
                      choose(item);
                    }}
                  >
                    <span className="flex size-4 items-center justify-center">
                      {current && <CheckIcon />}
                    </span>
                    <span className="flex-1">{strings[ACTION_LABEL_KEYS[item]]}</span>
                    <span className="text-xs text-muted-foreground">
                      {isStill(format)
                        ? strings.fileActionKindStill
                        : strings.fileActionKindAnimated}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
