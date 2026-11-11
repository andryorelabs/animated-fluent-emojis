export interface PreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface PreferenceEnvironment {
  storage?: () => PreferenceStorage;
  target?: EventTarget;
}

export interface PreferenceDefinition<Value extends string> {
  storageKey: string;
  eventName: string;
  fallback: Value;
  isValue: (value: unknown) => value is Value;
}

export interface PreferenceStore<Value extends string> {
  get: () => Value;
  set: (value: Value) => void;
  subscribe: (listener: (value: Value) => void) => () => void;
}

/**
 * Creates a string preference that persists in `localStorage` and is announced
 * on an event target, so components hydrated by separate islands stay in sync
 * without sharing module state; the `storage` event carries changes made in
 * other tabs. A missing or throwing storage only costs
 * persistence; the choice still lasts for the rest of the page.
 * @param definition - The storage key, event name, fallback and validator.
 * @param environment - Overrides for the storage getter and the event target.
 * @returns Accessors to read, change and observe the shared value.
 */
export function createPreferenceStore<Value extends string>(
  definition: PreferenceDefinition<Value>,
  environment: PreferenceEnvironment = {},
): PreferenceStore<Value> {
  const { storageKey, eventName, fallback, isValue } = definition;
  const target = environment.target ?? globalThis;
  const getStorage = environment.storage ?? (() => globalThis.localStorage);
  let current: Value | undefined;

  function readStored(): unknown {
    try {
      return getStorage().getItem(storageKey);
    } catch {
      return null;
    }
  }

  function persist(value: Value): void {
    try {
      getStorage().setItem(storageKey, value);
    } catch {
      return;
    }
  }

  return {
    get: () => {
      if (current !== undefined) {
        return current;
      }
      const stored = readStored();
      return isValue(stored) ? stored : fallback;
    },
    set: (value) => {
      current = value;
      persist(value);
      target.dispatchEvent(new CustomEvent(eventName, { detail: value }));
    },
    subscribe: (listener) => {
      const handle = (event: Event): void => {
        const { detail } = event as CustomEvent<unknown>;
        if (!isValue(detail)) {
          return;
        }

        current = detail;
        listener(detail);
      };
      const handleStorage = (event: Event): void => {
        const { key, newValue } = event as StorageEvent;
        if (key !== storageKey || !isValue(newValue)) {
          return;
        }

        current = newValue;
        listener(newValue);
      };
      target.addEventListener(eventName, handle);
      target.addEventListener("storage", handleStorage);
      return () => {
        target.removeEventListener(eventName, handle);
        target.removeEventListener("storage", handleStorage);
      };
    },
  };
}
