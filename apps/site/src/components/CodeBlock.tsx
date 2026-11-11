import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type CanvasTabsVariant,
} from "@/components/ui/tabs";
import { copyWithFeedback } from "@/lib/copy-feedback";
import { trustedCodeHtml } from "@/lib/trusted-code-html";
import { cn } from "@/lib/utilities";

import { markHighlightedLine } from "../highlight/snippet-html";
import { swapSnippetSlots } from "../highlight/snippet-swap";
import type { SnippetSlot } from "../highlight/snippet-template";

const ICON_FADE =
  "transition-opacity-scale-filter duration-150 ease-(--ease-out-strong) motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:duration-100";
const ICON_HIDDEN = "scale-80 opacity-0 blur-xs";

export interface CodeBlockTab {
  id: string;
  label: string;
  code: string;
  html: string;
  highlightLine?: number;
}

export interface CodeBlockLabels {
  tabsLabel: string;
  copy: string;
  copied: string;
}

export interface CodeBlockProps {
  tabs: readonly CodeBlockTab[];
  labels: CodeBlockLabels;
  lineNumbers?: boolean;
  leading?: ReactNode;
  activeId?: string;
  onActiveChange?: (id: string) => void;
  slotValues?: Partial<Record<SnippetSlot, string>> | undefined;
  onCopied?: () => void;
  copyEffect?: ReactNode;
  pill?: boolean;
  variant?: CanvasTabsVariant;
}

const CODE_LINE_HEIGHT_REM = 1.5;
const CODE_PADDING_LINES = 1;
const SCROLLBAR_ALLOWANCE_REM = 0.5;

/**
 * The height of the tallest panel, from its line count, so the block keeps its
 * size when a tab is chosen even though the inactive panels are not rendered
 * (the reset stylesheet forces `display: none` on `hidden`). It mirrors the
 * `.afe-code` rules: one `1.5rem` line each plus `0.75rem` of padding above
 * and below, and a small allowance for a horizontal scrollbar.
 * @param tabs - The panels of the block.
 * @returns A CSS length for the body's `min-height`.
 */
function bodyMinHeight(tabs: readonly CodeBlockTab[]): string {
  const lines = Math.max(0, ...tabs.map((tab) => tab.code.split("\n").length));
  const rem = (lines + CODE_PADDING_LINES) * CODE_LINE_HEIGHT_REM + SCROLLBAR_ALLOWANCE_REM;
  return `${String(rem)}rem`;
}

/**
 * The shared code block: an optional `line` tab bar, a copy icon button and a
 * body that renders pre-highlighted markup with line numbers. Every panel stays
 * mounted and stacked in one grid cell, so the block keeps the height of its
 * tallest panel and does not jump between tabs. Copy always writes the plain
 * `code` of the active tab, never the highlighted markup.
 * @param props - Component props.
 * @param props.tabs - One entry per panel, with its plain code and its markup.
 * @param props.labels - Localized tab list and copy button labels.
 * @param props.lineNumbers - Whether the gutter shows; defaults to `true`.
 * @param props.leading - Content before the tabs, such as an icon.
 * @param props.activeId - The active tab when the parent controls it.
 * @param props.onActiveChange - Called with the id of a newly chosen tab.
 * @param props.slotValues - New text for the placeholder tokens, swapped in
 * place without touching the rest of the highlighting.
 * @param props.onCopied - Called after each successful copy, never after a
 * failed one.
 * @param props.copyEffect - Decoration anchored to the copy button, such as a
 * burst of particles; it must not affect layout.
 * @param props.pill - Swaps the line tab bar for brand pills with a sliding
 * indicator behind the active tab; off by default.
 * @param props.variant - A canvas tab style; it implies `pill`. With `cmd` the
 * tab bar is its own row and the command row below shows the plain mono
 * command of the active tab, without syntax colours, next to the copy button.
 * @returns The code block card.
 */
export default function CodeBlock({
  tabs,
  labels,
  lineNumbers = true,
  leading,
  activeId,
  onActiveChange,
  slotValues,
  onCopied,
  copyEffect,
  pill: pillProperty = false,
  variant,
}: CodeBlockProps) {
  const pill = pillProperty || variant !== undefined;
  const [ownActive, setOwnActive] = useState(tabs[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const active = activeId ?? ownActive;
  const activeCode = tabs.find((tab) => tab.id === active)?.code ?? "";
  const showTabs = tabs.length > 1 || leading !== undefined;

  useEffect(() => {
    const list = tabsRef.current?.querySelector<HTMLElement>('[role="tablist"]');
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.left < listBox.left) list.scrollLeft -= listBox.left - tabBox.left;
    else if (tabBox.right > listBox.right - 20)
      list.scrollLeft += tabBox.right - (listBox.right - 20);
  }, [active]);

  useEffect(() => {
    if (!slotValues || !bodyRef.current) return;
    swapSnippetSlots(
      bodyRef.current.querySelectorAll<HTMLElement>("[data-snippet-slot]"),
      slotValues,
    );
  }, [slotValues]);

  function handleValueChange(value: unknown) {
    const id = String(value);
    setOwnActive(id);
    onActiveChange?.(id);
  }

  const copyControl = (
    <span className="relative flex shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? labels.copied : labels.copy}
        onClick={() => void copyWithFeedback(activeCode, setCopied, setCopied, onCopied)}
      >
        <span className="grid *:col-start-1 *:row-start-1">
          <CopyIcon data-copy-icon className={cn(ICON_FADE, copied && ICON_HIDDEN)} />
          <CheckIcon data-check-icon className={cn(ICON_FADE, !copied && ICON_HIDDEN)} />
        </span>
      </Button>
      {copyEffect}
    </span>
  );

  if (variant === "cmd") {
    return (
      <Tabs variant="cmd" value={active} onValueChange={handleValueChange} framed>
        <div ref={tabsRef}>
          <TabsList
            pill
            activateOnFocus
            aria-label={labels.tabsLabel}
            className="scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div
          data-command-row
          className="flex items-center justify-between gap-2.5 py-2.5 pr-2.5 pl-3"
        >
          <div className="grid min-w-0 flex-1">
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} keepMounted crossfade>
                <code className="block scrollbar-none overflow-x-auto font-mono text-meta whitespace-pre text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden">
                  {tab.code}
                </code>
              </TabsContent>
            ))}
          </div>
          {copyControl}
        </div>
        <span role="status" className="sr-only">
          {copied ? labels.copied : ""}
        </span>
      </Tabs>
    );
  }

  return (
    <Tabs
      variant={variant ?? (pill ? "default" : "line")}
      value={active}
      onValueChange={handleValueChange}
      framed
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border pr-1.5 pl-3",
          pill ? "h-12" : "h-10",
        )}
      >
        <div ref={tabsRef} className="flex min-w-0 items-center gap-2">
          {leading}
          {showTabs && (
            <TabsList
              pill={pill}
              activateOnFocus
              aria-label={labels.tabsLabel}
              fade
              className="min-w-0 scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
        </div>
        {copyControl}
      </div>
      <div
        ref={bodyRef}
        className="grid min-h-(--code-body-min-height)"
        style={{ "--code-body-min-height": bodyMinHeight(tabs) } as CSSProperties}
      >
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} keepMounted crossfade>
            <div
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the scrollable code must be keyboard reachable
              tabIndex={0}
              data-line-numbers={lineNumbers}
              className="afe-code overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- the markup is trusted build-time output
              dangerouslySetInnerHTML={{
                __html: trustedCodeHtml(
                  tab.highlightLine ? markHighlightedLine(tab.html, tab.highlightLine) : tab.html,
                ),
              }}
            />
          </TabsContent>
        ))}
      </div>
      <span role="status" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
    </Tabs>
  );
}
