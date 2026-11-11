import { PauseIcon, PlayIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utilities";

import type { UiStrings } from "../../i18n/ui";

type GalleryStrings = UiStrings["gallery"];

const STAGE_BACKGROUNDS = ["dots", "light", "dark", "checker"] as const;

export type StageBackground = (typeof STAGE_BACKGROUNDS)[number];

const BACKGROUND_LABELS: Record<StageBackground, keyof GalleryStrings> = {
  dots: "backgroundDots",
  light: "backgroundLight",
  dark: "backgroundDark",
  checker: "backgroundChecker",
};

const CHECKER = "[background-image:conic-gradient(#d4d4d4_25%,#fff_0_50%,#d4d4d4_0_75%,#fff_0)]";

/**
 * Tailwind classes that paint each background on the stage.
 */
export const STAGE_BACKGROUND_CLASSES: Record<StageBackground, string> = {
  dots: "bg-muted/40 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]",
  light: "bg-white",
  dark: "bg-neutral-900",
  checker: `bg-white ${CHECKER} [background-size:16px_16px]`,
};

const SWATCH_CLASSES: Record<StageBackground, string> = {
  dots: "bg-muted [background-image:radial-gradient(var(--muted-foreground)_1px,transparent_1px)] [background-size:6px_6px]",
  light: "bg-white",
  dark: "bg-neutral-900",
  checker: `bg-white ${CHECKER} [background-size:10px_10px]`,
};

/**
 * Resolves whether the animation is running from the explicit choice and the
 * motion preference.
 * @param playing - The explicit choice, or undefined when none was made.
 * @param reducedMotion - Whether the visitor prefers reduced motion.
 * @returns True when the animation is running.
 */
export function resolvePlaying(playing: boolean | undefined, reducedMotion: boolean): boolean {
  return playing ?? !reducedMotion;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks the `prefers-reduced-motion` media query; false on the server.
 * @returns Whether the visitor prefers reduced motion.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = globalThis.matchMedia(REDUCED_MOTION_QUERY);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    () => globalThis.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Properties of {@link StageToolbarControls}.
 */
export interface StageToolbarControlsProps {
  strings: GalleryStrings;
  background: StageBackground;
  onBackgroundChange: (background: StageBackground) => void;
  running: boolean;
  onToggleRunning: () => void;
}

/**
 * The background swatches and the play/pause button of the stage toolbar.
 * @param props - The strings, the current background and playback state, and their handlers.
 * @returns The two toolbar groups.
 */
export function StageToolbarControls(props: StageToolbarControlsProps) {
  const { strings, background, onBackgroundChange, running, onToggleRunning } = props;
  return (
    <>
      <div
        role="group"
        aria-label={strings.backgroundLabel}
        className="flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-1.5"
      >
        {STAGE_BACKGROUNDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={strings[BACKGROUND_LABELS[option]]}
            aria-pressed={background === option}
            onClick={() => {
              onBackgroundChange(option);
            }}
            className={cn(
              "size-5 cursor-pointer rounded-md border border-border transition-color-bg-border-shadow-scale duration-(--duration-press) ease-(--ease-out-strong) outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97 aria-pressed:ring-2 aria-pressed:ring-primary",
              SWATCH_CLASSES[option],
            )}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={running ? strings.pauseAnimation : strings.playAnimation}
        onClick={onToggleRunning}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-color-bg-border-shadow-scale duration-(--duration-press) ease-(--ease-out-strong) outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97 [&_svg]:size-4"
      >
        {running ? <PauseIcon /> : <PlayIcon />}
      </button>
    </>
  );
}
