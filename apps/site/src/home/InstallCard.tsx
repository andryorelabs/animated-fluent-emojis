import { Emoji } from "animated-fluent-emojis/react";
import { useState } from "react";

import CodeBlock, { type CodeBlockLabels, type CodeBlockTab } from "@/components/CodeBlock";
import CopyBurst from "@/components/CopyBurst";
import { cn } from "@/lib/utilities";

import "animated-fluent-emojis/style.css";

const PREVIEW_SIZE = 96;

/**
 * Properties of {@link InstallCard}.
 */
export interface InstallCardProps {
  tabs: readonly CodeBlockTab[];
  previews: Readonly<Record<string, string>>;
  labels: CodeBlockLabels;
}

/**
 * The install card of the landing page: framework tabs with a sliding pill,
 * the highlighted snippet and a live preview of the emoji the snippet renders.
 * Every preview stays mounted in one fixed box and only the active one is
 * visible, so switching tabs never shifts the layout and retargets smoothly
 * when clicked rapidly. A successful copy sets off a party-popper burst.
 * @param props - Component props.
 * @param props.tabs - One highlighted snippet per framework.
 * @param props.previews - The emoji id shown in the preview, by tab id.
 * @param props.labels - Localized tab list and copy button labels.
 * @returns The card with the tabbed code on one side and the preview on the
 * other.
 */
export default function InstallCard({ tabs, previews, labels }: InstallCardProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [burst, setBurst] = useState(0);

  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-border bg-muted/40 p-2 split:grid-cols-install">
      <CodeBlock
        variant="card"
        lineNumbers={false}
        tabs={tabs}
        labels={labels}
        activeId={active}
        onActiveChange={setActive}
        onCopied={() => {
          setBurst((count) => count + 1);
        }}
        copyEffect={<CopyBurst burst={burst} />}
      />
      <div
        data-testid="install-preview"
        aria-hidden="true"
        className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card bg-glow-install split:h-auto"
      >
        <div className="grid size-24 place-items-center">
          {tabs.map((tab) => {
            const emojiId = previews[tab.id];
            const isActive = tab.id === active;
            return emojiId ? (
              <span
                key={tab.id}
                data-preview-id={tab.id}
                data-active={isActive}
                className={cn(
                  "col-start-1 row-start-1 grid size-24 place-items-center motion-safe:transition-opacity-scale-filter motion-safe:duration-200 motion-safe:ease-(--ease-out-strong)",
                  !isActive && "scale-90 opacity-0 motion-safe:blur-2xs",
                )}
              >
                <Emoji id={emojiId} size={PREVIEW_SIZE} alt="" playing={isActive} />
              </span>
            ) : null;
          })}
        </div>
        <span
          data-testid="install-preview-chip"
          className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 font-mono text-caption leading-4 text-muted-foreground"
        >
          {active}
        </span>
      </div>
    </div>
  );
}
