import { describe, expect, it, vi } from "vitest";

import { createPreferenceStore, type PreferenceStorage } from "./persisted-preference";

const COLORS = ["red", "blue"] as const;
type Color = (typeof COLORS)[number];

function isColor(value: unknown): value is Color {
  return COLORS.includes(value as Color);
}

const definition = {
  storageKey: "test:color",
  eventName: "test:color-change",
  fallback: "red" as Color,
  isValue: isColor,
};

function storageEvent(key: string, newValue: string | null): Event {
  return Object.assign(new Event("storage"), { key, newValue });
}

function memoryStorage(initial?: string): PreferenceStorage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(definition.storageKey, initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const throwingStorage: PreferenceStorage = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("quota", "QuotaExceededError");
  },
};

describe("preference store", () => {
  it("falls back when nothing is stored", () => {
    const store = createPreferenceStore(definition, {
      storage: () => memoryStorage(),
      target: new EventTarget(),
    });
    expect(store.get()).toBe("red");
  });

  it("reads a valid stored value and ignores an invalid one", () => {
    const valid = createPreferenceStore(definition, {
      storage: () => memoryStorage("blue"),
      target: new EventTarget(),
    });
    const invalid = createPreferenceStore(definition, {
      storage: () => memoryStorage("green"),
      target: new EventTarget(),
    });
    expect(valid.get()).toBe("blue");
    expect(invalid.get()).toBe("red");
  });

  it("persists a change so a new store reads it back", () => {
    const storage = memoryStorage();
    const first = createPreferenceStore(definition, {
      storage: () => storage,
      target: new EventTarget(),
    });
    first.set("blue");
    const second = createPreferenceStore(definition, {
      storage: () => storage,
      target: new EventTarget(),
    });
    expect(second.get()).toBe("blue");
  });

  it("syncs stores that share a target and stops after unsubscribe", () => {
    const target = new EventTarget();
    const writer = createPreferenceStore(definition, {
      storage: () => memoryStorage(),
      target,
    });
    const reader = createPreferenceStore(definition, {
      storage: () => memoryStorage(),
      target,
    });
    const listener = vi.fn();
    const unsubscribe = reader.subscribe(listener);
    writer.set("blue");
    expect(listener).toHaveBeenCalledWith("blue");
    expect(reader.get()).toBe("blue");
    unsubscribe();
    writer.set("red");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores events carrying an invalid value", () => {
    const target = new EventTarget();
    const store = createPreferenceStore(definition, {
      storage: () => memoryStorage(),
      target,
    });
    const listener = vi.fn();
    store.subscribe(listener);
    target.dispatchEvent(new CustomEvent(definition.eventName, { detail: "green" }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("follows storage events from other tabs for its own key only", () => {
    const target = new EventTarget();
    const store = createPreferenceStore(definition, {
      storage: () => memoryStorage(),
      target,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    target.dispatchEvent(storageEvent("other", "blue"));
    target.dispatchEvent(storageEvent(definition.storageKey, "green"));
    target.dispatchEvent(storageEvent(definition.storageKey, null));
    expect(listener).not.toHaveBeenCalled();
    target.dispatchEvent(storageEvent(definition.storageKey, "blue"));
    expect(listener).toHaveBeenCalledWith("blue");
    expect(store.get()).toBe("blue");
    unsubscribe();
    target.dispatchEvent(storageEvent(definition.storageKey, "red"));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps working for the session when storage throws", () => {
    const store = createPreferenceStore(definition, {
      storage: () => throwingStorage,
      target: new EventTarget(),
    });
    expect(store.get()).toBe("red");
    expect(() => {
      store.set("blue");
    }).not.toThrow();
    expect(store.get()).toBe("blue");
  });
});
