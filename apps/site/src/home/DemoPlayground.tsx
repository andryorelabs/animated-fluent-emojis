import { Emoji } from "animated-fluent-emojis/react";
import { RotateCcwIcon } from "lucide-react";
import {
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type PointerEvent,
  type ReactNode,
} from "react";
import "animated-fluent-emojis/style.css";

import CodeBlock, { type CodeBlockLabels } from "@/components/CodeBlock";
import { ToneDot } from "@/components/ToneDot";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { PublicEmoji } from "../gallery/public-index";
import type { SnippetKind } from "../gallery/snippets";
import {
  DEMO_EMOJIS,
  DEMO_PLAYS,
  DEMO_SIZES,
  DEMO_TONES,
  demoEmojiProps,
  demoSlotValues,
  demoSnippetCode,
  demoTone,
  INITIAL_DEMO_STATE,
  isInitialDemoState,
  isTapPlayTrigger,
  type DemoEmojiName,
  type DemoState,
  type DemoTabs,
} from "./demo";

interface DemoLabels {
  emojiLabel: string;
  sizeLabel: string;
  toneLabel: string;
  playsLabel: string;
  reset: string;
  emojis: Record<DemoEmojiName, string>;
  tones: Record<"default" | "light" | "medium" | "dark", string>;
  plays: Record<"hover" | "hoverTap" | "load" | "loop", string>;
  code: CodeBlockLabels;
}

export interface DemoPlaygroundProps {
  emojis: readonly PublicEmoji[];
  tabs: DemoTabs;
  labels: DemoLabels;
  initialState?: DemoState;
}

interface SegmentedProps<Value extends string | number> {
  label: string;
  options: readonly {
    value: Value;
    text: string;
    coarseText?: string | undefined;
    name?: string;
    leading?: ReactNode;
  }[];
  selected: Value;
  onSelect: (value: Value) => void;
  disabled?: boolean;
  className?: string;
}

function OptionText({ option }: { option: { text: string; coarseText?: string | undefined } }) {
  if (option.coarseText === undefined) return option.text;
  return (
    <>
      <span className="pointer-coarse:hidden">{option.text}</span>
      <span className="hidden pointer-coarse:inline">{option.coarseText}</span>
    </>
  );
}

function Segmented<Value extends string | number>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  className = "",
}: SegmentedProps<Value>) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span
        aria-hidden="true"
        className="font-mono text-xs tracking-label-wide text-muted-foreground uppercase"
      >
        {label}
      </span>
      <Tabs
        variant="segmented"
        value={String(selected)}
        onValueChange={(tabValue) => {
          const next = options.find((option) => String(option.value) === tabValue);
          if (next) onSelect(next.value);
        }}
      >
        <TabsList pill aria-label={label} className="group-data-[variant=segmented]/tabs:w-full">
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={String(option.value)}
              disabled={disabled}
              aria-label={option.name}
              className="flex-1"
            >
              {option.leading === undefined ? (
                <OptionText option={option} />
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  {option.leading}
                  {option.text}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/**
 * The no-op unsubscribe of {@link subscribeNever}.
 */
function unsubscribe(): void {
  return;
}

function subscribeNever(): typeof unsubscribe {
  return unsubscribe;
}

interface StageEmojiProps {
  emojiProps: ComponentProps<typeof Emoji>;
  animateIn: boolean;
}

function StageEmoji({ emojiProps, animateIn }: StageEmojiProps) {
  const [settled, setSettled] = useState(!animateIn);
  const settle = () => {
    setSettled(true);
  };
  return (
    <span
      className={`inline-flex transition-opacity-transform duration-150 ease-(--ease-out-strong) ${settled ? "" : "scale-96 opacity-0 motion-reduce:scale-100"}`}
    >
      <Emoji {...emojiProps} onLoad={settle} onError={settle} />
    </span>
  );
}

/**
 * The hero customizer: one live emoji on a fixed-height dot-grid stage, compact
 * segmented controls for emoji, size, skin tone and playback, and the shared
 * code block below, which follows the controls by swapping its placeholder
 * tokens. A React island hydrated when the browser is idle.
 * @param props - Component props.
 * @param props.emojis - The curated emojis, in display order.
 * @param props.tabs - Highlighted snippets for every play, with and without a
 * tone attribute.
 * @param props.labels - Localized control, emoji and code block labels.
 * @param props.initialState - The starting selection; the untouched demo
 * state when omitted. Reset always returns to the untouched demo state.
 * @returns The customizer card.
 */
export default function DemoPlayground({
  emojis,
  tabs: demoTabs,
  labels,
  initialState = INITIAL_DEMO_STATE,
}: DemoPlaygroundProps) {
  const [state, setState] = useState<DemoState>(initialState);
  const [tap, setTap] = useState({ key: "", run: 0 });
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const emoji = emojis.find((candidate) => candidate.id === state.emojiId);
  const initialEmoji = emojis.find((candidate) => candidate.id === INITIAL_DEMO_STATE.emojiId);
  const current = emoji ?? initialEmoji;
  const hasTones = (current?.tones.length ?? 0) > 0;
  const slotValues = useMemo(
    () => (current ? demoSlotValues(current, state) : undefined),
    [current, state],
  );
  if (!current) return null;

  const toned = demoTone(current, state) !== undefined;
  const tabs = demoTabs[state.play][toned ? "toned" : "plain"].map((tab) => ({
    ...tab,
    code: demoSnippetCode(current, tab.id as SnippetKind, state),
  }));
  const playKey = `${state.emojiId}-${state.play}-${state.tone}-${String(state.size)}`;
  const tapRun = tap.key === playKey ? tap.run : 0;
  const startTapPlay = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !isTapPlayTrigger(state.play, event.pointerType) ||
      (event.target instanceof Element && event.target.closest("button"))
    ) {
      return;
    }
    setTap((previous) => ({ key: playKey, run: previous.run + 1 }));
  };
  const name =
    labels.emojis[DEMO_EMOJIS.find((candidate) => candidate.id === current.id)?.name ?? "wave"];

  return (
    <div className="grid min-w-0 gap-3 split:grid-cols-demo">
      <div
        className="relative flex h-55 items-center justify-center overflow-hidden rounded-22 border border-border bg-card bg-glow-demo min-[860px]:h-auto split:min-h-80"
        data-testid="demo-stage"
        onPointerDown={startTapPlay}
      >
        <StageEmoji
          key={`${playKey}-${String(tapRun)}`}
          animateIn={ready && tapRun === 0}
          emojiProps={{
            id: current.id,
            alt: name,
            ...demoEmojiProps(current, state),
            ...(tapRun > 0 && state.play === "hover" && { playing: true }),
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2"
          disabled={isInitialDemoState(state)}
          onClick={() => {
            setState(INITIAL_DEMO_STATE);
          }}
        >
          <RotateCcwIcon aria-hidden="true" />
          {labels.reset}
        </Button>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-22 border border-border bg-card p-4">
          <Segmented
            className="col-span-2"
            label={labels.emojiLabel}
            options={DEMO_EMOJIS.filter((option) =>
              emojis.some((candidate) => candidate.id === option.id),
            ).map((option) => ({
              value: option.id,
              text: emojis.find((candidate) => candidate.id === option.id)?.unicode ?? "",
              name: labels.emojis[option.name],
            }))}
            selected={state.emojiId}
            onSelect={(emojiId) => {
              setState((previous) => ({ ...previous, emojiId }));
            }}
          />
          <Segmented
            className="col-span-2 sm:col-span-1"
            label={labels.sizeLabel}
            options={DEMO_SIZES.map((size) => ({
              value: size,
              text: String(size),
            }))}
            selected={state.size}
            onSelect={(size) => {
              setState((previous) => ({ ...previous, size }));
            }}
          />
          <Segmented
            className="col-span-2 sm:col-span-1"
            label={labels.playsLabel}
            options={DEMO_PLAYS.map((play) => ({
              value: play.id,
              text: labels.plays[play.id],
              coarseText: play.id === "hover" ? labels.plays.hoverTap : undefined,
            }))}
            selected={state.play}
            onSelect={(play) => {
              setState((previous) => ({ ...previous, play }));
            }}
          />
          <Segmented
            className="col-span-2"
            label={labels.toneLabel}
            disabled={!hasTones}
            options={DEMO_TONES.map((tone) => ({
              value: tone.id,
              text: labels.tones[tone.id],
              leading: <ToneDot tone={tone.id} />,
            }))}
            selected={state.tone}
            onSelect={(tone) => {
              setState((previous) => ({ ...previous, tone }));
            }}
          />
        </div>
        <div className="demo-code">
          <CodeBlock tabs={tabs} labels={labels.code} slotValues={slotValues} />
        </div>
      </div>
    </div>
  );
}
