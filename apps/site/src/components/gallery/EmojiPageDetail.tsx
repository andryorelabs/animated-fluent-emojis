import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { copyableGlyph, formatCodePoint } from "../../emoji-pages/emoji-page";
import { effectiveTone } from "../../gallery/filter";
import { fileUrl, SKIN_TONES, type PublicEmoji, type SkinTone } from "../../gallery/public-index";
import { parseGalleryUrl } from "../../gallery/url-state";
import type { EmojiPageTabs } from "../../home/content";
import { ToneDot } from "../ToneDot";
import { ChipGroup } from "./ChipGroup";
import { EmojiDetail, EmojiIdRow, type GalleryStrings } from "./EmojiDetail";
import { FileActionButton } from "./FileActionButton";
import { StatusToast, useStatusAnnouncer } from "./StatusToast";

const TONE_LABELS: Record<SkinTone | "default", keyof GalleryStrings> = {
  default: "toneDefault",
  light: "toneLight",
  "medium-light": "toneMediumLight",
  medium: "toneMedium",
  "medium-dark": "toneMediumDark",
  dark: "toneDark",
};

export const PREVIEW_SIZE = 200;

const VISIBLE_KEYWORDS = 10;

function unsubscribe(): void {
  return;
}

function subscribeToNothing(): () => void {
  return unsubscribe;
}

function readQueryTone(): SkinTone | undefined {
  return parseGalleryUrl(globalThis.location.search).tone;
}

function readServerTone(): SkinTone | undefined {
  return parseGalleryUrl("").tone;
}

/**
 * Properties of {@link EmojiPageDetail}.
 */
export interface EmojiPageDetailProps {
  emoji: PublicEmoji;
  name: string;
  strings: GalleryStrings;
  snippetTabs: EmojiPageTabs;
  category: string;
  keywords: readonly string[];
  keywordStrings: KeywordStrings;
  metaStrings: MetaStrings;
  header?: ReactNode;
}

/**
 * The localized keyword labels; `keywordsMore` carries a `{count}` slot.
 */
interface KeywordStrings {
  keywordsLabel: string;
  keywordsMore: string;
  keywordsLess: string;
}

/**
 * The localized labels of the meta and action rows.
 */
interface MetaStrings {
  copyEmoji: string;
  codePointLabel: string;
}

const KEYWORD_CHIP = "rounded-full bg-secondary px-3 py-1 text-xs";

/**
 * Properties of {@link KeywordList}.
 */
export interface KeywordListProps {
  keywords: readonly string[];
  strings: KeywordStrings;
}

/**
 * The keyword chips: the first ten inline, the rest inside a native
 * `<details>` whose summary chip reads "+N more" and flips to "Show less".
 * @param props - The keywords and the localized labels.
 * @returns The labelled chip list.
 */
export function KeywordList(props: KeywordListProps) {
  const { keywords, strings } = props;
  const [open, setOpen] = useState(false);
  const visible = keywords.slice(0, VISIBLE_KEYWORDS);
  const hidden = keywords.slice(VISIBLE_KEYWORDS);
  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground">{strings.keywordsLabel}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {visible.map((keyword) => (
          <li key={keyword} className={KEYWORD_CHIP}>
            {keyword}
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <details
          className="mt-2"
          onToggle={(event) => {
            setOpen(event.currentTarget.open);
          }}
        >
          <summary
            className={`${KEYWORD_CHIP} inline-block cursor-pointer list-none font-semibold`}
          >
            {open
              ? strings.keywordsLess
              : strings.keywordsMore.split("{count}").join(String(hidden.length))}
          </summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {hidden.map((keyword) => (
              <li key={keyword} className={KEYWORD_CHIP}>
                {keyword}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * The interactive half of an emoji page: tone chips plus the shared detail
 * view. The tone starts from the `?tone=` query and is written back to it.
 * @param props - The emoji, its localized name, the gallery strings and the
 * build-time highlighted snippet tabs.
 * @returns The chips and the detail view.
 */
export function EmojiPageDetail(props: EmojiPageDetailProps) {
  const {
    emoji,
    name,
    strings,
    snippetTabs,
    category,
    keywords,
    keywordStrings,
    metaStrings,
    header,
  } = props;
  const { message, visible, copy, handleNotice } = useStatusAnnouncer(strings);
  const [chosen, setChosen] = useState<SkinTone | "default">();
  const queryTone = useSyncExternalStore(subscribeToNothing, readQueryTone, readServerTone);
  const requested = chosen === undefined ? queryTone : chosen === "default" ? undefined : chosen;
  const tone = effectiveTone(emoji, requested);
  const files = emoji.tones.find((variant) => variant.tone === tone) ?? emoji;

  function selectTone(value: SkinTone | "default") {
    setChosen(value);
    const url = new URL(globalThis.location.href);
    if (value === "default") url.searchParams.delete("tone");
    else url.searchParams.set("tone", value);
    globalThis.history.replaceState(null, "", url);
  }

  return (
    <div className="grid grid-cols-1 gap-8 min-[860px]:grid-cols-2 min-[860px]:grid-rows-auto-fr">
      <div className="flex min-w-0 flex-col gap-4 min-[860px]:col-start-1 min-[860px]:row-start-1">
        <div>
          {header}
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {category} ·{" "}
            <span>
              <span className="sr-only">{metaStrings.codePointLabel}: </span>
              {formatCodePoint(emoji.unicode)}
            </span>
          </p>
        </div>
        <EmojiIdRow id={emoji.id} strings={strings} onCopy={copy} />
        <div className="flex flex-wrap items-stretch gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void copy(copyableGlyph(emoji, tone));
            }}
          >
            <span aria-hidden="true">{copyableGlyph(emoji, tone)}</span>
            {metaStrings.copyEmoji}
          </Button>
          <FileActionButton
            target={{
              filenameBase: files.slug,
              urlFor: (format) => fileUrl(files.urls[format]),
            }}
            strings={strings}
            onNotice={handleNotice}
            className="min-w-0 flex-1"
          />
        </div>
        {emoji.tones.length > 0 && (
          <ChipGroup
            label={strings.toneLabel}
            chips={(["default", ...SKIN_TONES] as const).map((value) => ({
              value,
              label: strings[TONE_LABELS[value]],
              leading: <ToneDot tone={value} />,
            }))}
            selected={tone ?? "default"}
            onSelect={selectTone}
          />
        )}
      </div>
      <div className="min-w-0 min-[860px]:col-start-2 min-[860px]:row-span-2 min-[860px]:row-start-1">
        <EmojiDetail
          emoji={emoji}
          name={name}
          tone={tone}
          size={PREVIEW_SIZE}
          strings={strings}
          snippetTabs={snippetTabs}
          page
        />
      </div>
      <div className="min-w-0 min-[860px]:col-start-1 min-[860px]:row-start-2">
        <KeywordList keywords={keywords} strings={keywordStrings} />
      </div>
      <StatusToast message={message} visible={visible} />
    </div>
  );
}
