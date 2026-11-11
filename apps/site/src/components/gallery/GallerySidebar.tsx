import { SKIN_TONES, type SkinTone } from "../../gallery/public-index";
import { GALLERY_SIZES, type GallerySize } from "../../gallery/url-state";
import { ToneDot } from "../ToneDot";
import type { GalleryStrings } from "./EmojiDetail";
import { SegmentedControl } from "./SegmentedControl";

const TONE_LABELS: Record<SkinTone | "default", keyof GalleryStrings> = {
  default: "toneDefault",
  light: "toneLight",
  "medium-light": "toneMediumLight",
  medium: "toneMedium",
  "medium-dark": "toneMediumDark",
  dark: "toneDark",
};

/**
 * A category with the number of emojis it holds.
 */
interface CategoryCount {
  name: string;
  count: number;
}

interface GallerySidebarProps {
  strings: GalleryStrings;
  categories: readonly CategoryCount[];
  totalCount: number;
  category: string | undefined;
  onCategory: (category: string | undefined) => void;
  tone: SkinTone | undefined;
  onTone: (tone: SkinTone | undefined) => void;
  toneDisabled: boolean;
  size: GallerySize;
  onSize: (size: GallerySize) => void;
}

const ROW_CLASS =
  "flex h-8 w-full cursor-pointer select-none pointer-coarse:h-11 active:bg-muted items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-muted aria-pressed:bg-muted aria-pressed:font-medium";

/**
 * The gallery filters: a category list with counts and a card with the tone
 * and size controls.
 * @param props - Strings, categories and the current filter state with handlers.
 * @returns The sidebar content, shared by the desktop rail and the mobile sheet.
 */
export function GallerySidebar(props: GallerySidebarProps) {
  const { strings, categories, totalCount, category = "" } = props;
  const rows = [
    { name: "", label: strings.categoryAll, count: totalCount },
    ...categories.map((entry) => ({
      name: entry.name,
      label: entry.name,
      count: entry.count,
    })),
  ];
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={strings.categoryLabel} className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <button
            key={row.name}
            type="button"
            aria-pressed={category === row.name}
            onClick={() => {
              props.onCategory(row.name === "" ? undefined : row.name);
            }}
            className={ROW_CLASS}
          >
            <span className="truncate">{row.label}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {row.count}
            </span>
          </button>
        ))}
      </div>
      <section
        aria-label={strings.customizeTitle}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
      >
        <h2 className="text-sm font-semibold">{strings.customizeTitle}</h2>
        <SegmentedControl
          label={strings.toneLabel}
          segments={(["default", ...SKIN_TONES] as const).map((value) => ({
            value,
            label: strings[TONE_LABELS[value]],
            leading: <ToneDot tone={value} />,
          }))}
          selected={props.tone ?? "default"}
          onSelect={(value) => {
            props.onTone(value === "default" ? undefined : value);
          }}
          disabled={props.toneDisabled}
          disabledHint={strings.noSkinTones}
        />
        <SegmentedControl
          label={strings.sizeLabel}
          segments={GALLERY_SIZES.map((value) => ({
            value,
            label: String(value),
          }))}
          selected={props.size}
          onSelect={props.onSize}
        />
      </section>
    </div>
  );
}
