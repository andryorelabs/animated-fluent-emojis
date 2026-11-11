import {
  createPreferenceStore,
  type PreferenceEnvironment,
  type PreferenceStore,
} from "./persisted-preference";

export const SNIPPET_ADAPTERS = ["react", "vue", "svelte", "astro", "element"] as const;

export type SnippetAdapter = (typeof SNIPPET_ADAPTERS)[number];

export const DEFAULT_SNIPPET_ADAPTER: SnippetAdapter = "react";

export const SNIPPET_ADAPTER_STORAGE_KEY = "afe:snippet-adapter";

const SNIPPET_ADAPTER_EVENT = "afe:snippet-adapter-change";

/**
 * Narrows a stored or user-provided value to a supported snippet adapter.
 * @param value - The value to check.
 * @returns Whether it names a supported adapter.
 */
export function isSnippetAdapter(value: unknown): value is SnippetAdapter {
  return SNIPPET_ADAPTERS.includes(value as SnippetAdapter);
}

/**
 * Creates the snippet adapter preference shared by every snippet button on a
 * page. The choice persists under `afe:snippet-adapter`; see
 * {@link createPreferenceStore}.
 * @param environment - Overrides for the storage getter and the event target.
 * @returns Accessors to read, change and observe the shared choice.
 */
export function createSnippetAdapterStore(
  environment: PreferenceEnvironment = {},
): PreferenceStore<SnippetAdapter> {
  return createPreferenceStore(
    {
      storageKey: SNIPPET_ADAPTER_STORAGE_KEY,
      eventName: SNIPPET_ADAPTER_EVENT,
      fallback: DEFAULT_SNIPPET_ADAPTER,
      isValue: isSnippetAdapter,
    },
    environment,
  );
}
