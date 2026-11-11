import { useEffect, useRef, useState } from "react";

import type { UiStrings } from "../../i18n/ui";
import {
  createTransientStatus,
  type TransientStatus,
  type TransientStatusState,
} from "../../lib/transient-status";
import type { FileActionNotice } from "./FileActionButton";

const TOAST_MILLISECONDS = 2000;

/**
 * Result of {@link useStatusAnnouncer}.
 */
export interface StatusAnnouncer {
  message: string;
  visible: boolean;
  announce: (message: string) => void;
  copy: (text: string) => Promise<void>;
  handleNotice: (notice: FileActionNotice) => void;
}

/**
 * Owns the transient "Copied" message and the clipboard and download-notice
 * handlers that feed it. The message is kept after it hides so the toast can
 * animate out with its text.
 * @param strings - The gallery strings holding the messages.
 * @returns The current message, its visibility and the handlers that set it.
 */
export function useStatusAnnouncer(strings: UiStrings["gallery"]): StatusAnnouncer {
  const [state, setState] = useState<TransientStatusState>({
    message: "",
    visible: false,
  });
  const statusRef = useRef<TransientStatus | undefined>(undefined);

  useEffect(
    () => () => {
      statusRef.current?.dispose();
    },
    [],
  );

  function announce(message: string) {
    statusRef.current ??= createTransientStatus(setState, TOAST_MILLISECONDS);
    statusRef.current.show(message);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      announce(strings.copied);
    } catch {
      announce(strings.downloadFailed);
    }
  }

  function handleNotice(notice: FileActionNotice) {
    announce(notice.kind === "copied" ? notice.message : strings.downloadFailed);
  }

  return { ...state, announce, copy, handleNotice };
}

/**
 * Properties of {@link StatusToast}.
 */
export interface StatusToastProps {
  message: string;
  visible: boolean;
}

/**
 * The transient status toast. The visual box is always rendered and slides and
 * fades with `data-visible`; a separate screen-reader-only polite live region
 * announces the message while it is visible. Reduced motion keeps only the
 * opacity change.
 * @param props - The last message and whether it is on screen.
 * @returns The toast and its live region.
 */
export function StatusToast(props: StatusToastProps) {
  const { message, visible } = props;
  return (
    <>
      <div
        aria-hidden="true"
        data-visible={visible}
        className="pointer-events-none fixed right-4 bottom-safe-4 z-60 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground opacity-100 shadow-md transition-opacity-translate duration-200 ease-(--ease-out-strong) data-[visible=false]:translate-y-toast-offset data-[visible=false]:opacity-0 data-[visible=false]:duration-150 motion-reduce:data-[visible=false]:translate-y-0"
      >
        {message}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {visible ? message : ""}
      </p>
    </>
  );
}
