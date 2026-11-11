import { describe, expect, it } from "vitest";

import {
  createSnippetAdapterStore,
  DEFAULT_SNIPPET_ADAPTER,
  isSnippetAdapter,
  SNIPPET_ADAPTER_STORAGE_KEY,
  SNIPPET_ADAPTERS,
} from "./snippet-adapter";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(SNIPPET_ADAPTER_STORAGE_KEY, initial);
  return {
    values,
    storage: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    }),
  };
}

describe("snippet adapter preference", () => {
  it("lists the five adapters and defaults to React", () => {
    expect(SNIPPET_ADAPTERS).toEqual(["react", "vue", "svelte", "astro", "element"]);
    expect(DEFAULT_SNIPPET_ADAPTER).toBe("react");
    expect(SNIPPET_ADAPTER_STORAGE_KEY).toBe("afe:snippet-adapter");
  });

  it("recognizes only supported adapters", () => {
    expect(isSnippetAdapter("svelte")).toBe(true);
    expect(isSnippetAdapter("no-code")).toBe(false);
    expect(isSnippetAdapter(undefined)).toBe(false);
  });

  it("persists the choice and reads it back in a new store", () => {
    const { values, storage } = memoryStorage();
    const first = createSnippetAdapterStore({
      storage,
      target: new EventTarget(),
    });
    first.set("astro");
    expect(values.get("afe:snippet-adapter")).toBe("astro");
    const second = createSnippetAdapterStore({
      storage,
      target: new EventTarget(),
    });
    expect(second.get()).toBe("astro");
  });

  it("ignores an unsupported stored value", () => {
    const { storage } = memoryStorage("cobol");
    expect(createSnippetAdapterStore({ storage, target: new EventTarget() }).get()).toBe("react");
  });
});
