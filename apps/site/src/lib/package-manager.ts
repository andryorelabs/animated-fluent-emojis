import {
  createPreferenceStore,
  type PreferenceEnvironment,
  type PreferenceStorage,
  type PreferenceStore,
} from "./persisted-preference";

export const PACKAGE_MANAGERS = ["bun", "pnpm", "npm", "yarn"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const DEFAULT_PACKAGE_MANAGER: PackageManager = "bun";

export const PACKAGE_MANAGER_STORAGE_KEY = "afe:pm";

const PACKAGE_MANAGER_EVENT = "afe:pm-change";

const PACKAGE_NAME = "animated-fluent-emojis";

const INSTALL_VERBS: Record<PackageManager, string> = {
  bun: "bun add",
  npm: "npm install",
  pnpm: "pnpm add",
  yarn: "yarn add",
};

export type PackageManagerStorage = PreferenceStorage;

export type PackageManagerEnvironment = PreferenceEnvironment;

export type PackageManagerStore = PreferenceStore<PackageManager>;

/**
 * Narrows a stored or user-provided value to a supported package manager.
 * @param value - The value to check.
 * @returns Whether it names a supported package manager.
 */
export function isPackageManager(value: unknown): value is PackageManager {
  return PACKAGE_MANAGERS.includes(value as PackageManager);
}

/**
 * The command that installs the library with a package manager.
 * @param manager - The package manager.
 * @returns A shell command to run in the project root.
 */
export function installCommand(manager: PackageManager): string {
  return `${INSTALL_VERBS[manager]} ${PACKAGE_NAME}`;
}

/**
 * Creates the package manager preference shared by every install block on a
 * page. The choice persists under `afe:pm`; see {@link createPreferenceStore}.
 * @param environment - Overrides for the storage getter and the event target.
 * @returns Accessors to read, change and observe the shared choice.
 */
export function createPackageManagerStore(
  environment: PackageManagerEnvironment = {},
): PackageManagerStore {
  return createPreferenceStore(
    {
      storageKey: PACKAGE_MANAGER_STORAGE_KEY,
      eventName: PACKAGE_MANAGER_EVENT,
      fallback: DEFAULT_PACKAGE_MANAGER,
      isValue: isPackageManager,
    },
    environment,
  );
}

/**
 * The page-wide package manager store every landing island shares. It reads
 * `localStorage` only when queried, so creating it during server rendering is
 * safe.
 */
export const sharedPackageManagerStore: PackageManagerStore = createPackageManagerStore();
