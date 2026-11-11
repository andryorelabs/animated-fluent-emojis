import {
  createPreferenceStore,
  type PreferenceEnvironment,
  type PreferenceStore,
} from "./persisted-preference";

export const FILE_ACTION_FORMATS = ["webp", "gif", "png"] as const;

export type FileActionFormat = (typeof FILE_ACTION_FORMATS)[number];

const FILE_ACTION_VERBS = ["download", "copy"] as const;

export type FileActionVerb = (typeof FILE_ACTION_VERBS)[number];

export type FileAction = `${FileActionVerb}-${FileActionFormat}`;

export const FILE_ACTIONS: readonly FileAction[] = FILE_ACTION_VERBS.flatMap((verb) =>
  FILE_ACTION_FORMATS.map((format) => `${verb}-${format}` as const),
);

export const DEFAULT_FILE_ACTION: FileAction = "download-webp";

export const FILE_ACTION_STORAGE_KEY = "afe:file-action";

const FILE_ACTION_EVENT = "afe:file-action-change";

/**
 * Narrows a stored or user-provided value to a supported file action.
 * @param value - The value to check.
 * @returns Whether it names a supported file action.
 */
export function isFileAction(value: unknown): value is FileAction {
  return FILE_ACTIONS.includes(value as FileAction);
}

/**
 * Splits a file action into its verb and file format.
 * @param action - A value such as `copy-gif`.
 * @returns The verb (`download` or `copy`) and the format.
 */
export function parseFileAction(action: FileAction): {
  verb: FileActionVerb;
  format: FileActionFormat;
} {
  const [verb, format] = action.split("-") as [FileActionVerb, FileActionFormat];
  return { verb, format };
}

/**
 * Creates the file action preference shared by every file action button on a
 * page. The choice persists under `afe:file-action`; see
 * {@link createPreferenceStore}.
 * @param environment - Overrides for the storage getter and the event target.
 * @returns Accessors to read, change and observe the shared choice.
 */
export function createFileActionStore(
  environment: PreferenceEnvironment = {},
): PreferenceStore<FileAction> {
  return createPreferenceStore(
    {
      storageKey: FILE_ACTION_STORAGE_KEY,
      eventName: FILE_ACTION_EVENT,
      fallback: DEFAULT_FILE_ACTION,
      isValue: isFileAction,
    },
    environment,
  );
}

export interface FileActionTarget {
  filenameBase: string;
  urlFor: (format: FileActionFormat) => string;
}

export interface FileActionIo {
  download: (url: string, filename: string) => Promise<void>;
  copy: (text: string) => Promise<void>;
}

export type FileActionOutcome = "downloaded" | "copied" | "failed";

/**
 * Downloads a public file through fetch and a blob, so the browser saves it
 * instead of navigating to the cross-origin URL.
 * @param url - Absolute file URL.
 * @param filename - Name to save the file as.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${String(response.status)}`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Runs a file action against one emoji file. Failures are reported as an
 * outcome rather than thrown, so the caller decides how to tell the user.
 * @param action - The action to run.
 * @param target - The file name base and the tone-aware URL per format.
 * @param io - The download and clipboard implementations.
 * @returns What happened.
 */
export async function runFileAction(
  action: FileAction,
  target: FileActionTarget,
  io: FileActionIo,
): Promise<FileActionOutcome> {
  const { verb, format } = parseFileAction(action);
  const url = target.urlFor(format);
  try {
    if (verb === "copy") {
      await io.copy(url);
      return "copied";
    }
    await io.download(url, `${target.filenameBase}.${format}`);
    return "downloaded";
  } catch {
    return "failed";
  }
}
