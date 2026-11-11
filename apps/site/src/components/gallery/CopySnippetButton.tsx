import { CheckIcon, ChevronDownIcon, CodeIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PreferenceStore } from "@/lib/persisted-preference";
import {
  createSnippetAdapterStore,
  DEFAULT_SNIPPET_ADAPTER,
  SNIPPET_ADAPTERS,
  type SnippetAdapter,
} from "@/lib/snippet-adapter";

import type { PublicEmoji, SkinTone } from "../../gallery/public-index";
import { generateSnippet } from "../../gallery/snippets";
import type { UiStrings } from "../../i18n/ui";

type SnippetStrings = Pick<
  UiStrings["gallery"],
  | "tabReact"
  | "tabVue"
  | "tabSvelte"
  | "tabAstro"
  | "tabHtml"
  | "snippetMenuLabel"
  | "copySnippetAs"
  | "copied"
  | "downloadFailed"
>;

const ADAPTER_LABEL_KEYS = {
  react: "tabReact",
  vue: "tabVue",
  svelte: "tabSvelte",
  astro: "tabAstro",
  element: "tabHtml",
} as const satisfies Record<SnippetAdapter, keyof SnippetStrings>;

const sharedStore = createSnippetAdapterStore();

/**
 * Properties of {@link CopySnippetButton}.
 */
export interface CopySnippetButtonProps {
  emoji: PublicEmoji;
  size: number;
  tone: SkinTone | undefined;
  strings: SnippetStrings;
  onNotice: (message: string) => void;
  store?: PreferenceStore<SnippetAdapter>;
  className?: string;
}

/**
 * A split button that copies the plain-text usage snippet of one emoji. The
 * primary part copies for the remembered adapter (React by default); the
 * chevron menu lists React, Vue, Svelte, Astro and HTML, and choosing one
 * copies it and makes it the primary. The choice persists under
 * `afe:snippet-adapter` and syncs across islands.
 * @param props - The emoji, its size and tone, the labels, a notice callback
 * and an optional store override.
 * @returns The button group.
 */
export function CopySnippetButton(props: CopySnippetButtonProps) {
  const { emoji, size, tone, strings, onNotice } = props;
  const store = props.store ?? sharedStore;
  const adapter = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_SNIPPET_ADAPTER);

  async function copy(next: SnippetAdapter) {
    try {
      await navigator.clipboard.writeText(generateSnippet(emoji, next, { size, tone }));
      onNotice(strings.copied);
    } catch {
      onNotice(strings.downloadFailed);
    }
  }

  function choose(next: SnippetAdapter) {
    store.set(next);
    void copy(next);
  }

  const label = strings.copySnippetAs.split("{adapter}").join(strings[ADAPTER_LABEL_KEYS[adapter]]);

  return (
    <ButtonGroup width="full" className={props.className}>
      <Button variant="outline" className="min-w-0 flex-1" onClick={() => void copy(adapter)}>
        <CodeIcon />
        <span className="truncate">{label}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={strings.snippetMenuLabel} variant="split">
          <ChevronDownIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent variant="split" align="end">
          {SNIPPET_ADAPTERS.map((item) => (
            <DropdownMenuItem
              key={item}
              aria-current={item === adapter ? "true" : undefined}
              onClick={() => {
                choose(item);
              }}
            >
              <span className="flex size-4 items-center justify-center">
                {item === adapter && <CheckIcon />}
              </span>
              <span className="flex-1">{strings[ADAPTER_LABEL_KEYS[item]]}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
