import type { CSSProperties } from "react";

import type { SkinTone } from "../gallery/public-index";
import { SKIN_TONE_COLORS } from "../lib/skin-tone-colors";

interface ToneDotProps {
  tone: "default" | SkinTone;
}

/**
 * A small decorative color dot for a skin tone. It is hidden from assistive
 * technology; the adjacent text label names the tone.
 * @param props - The tone to render as a dot.
 * @param props.tone - Which skin tone, or `default`, to paint.
 * @returns A 10px circle filled with the tone color.
 */
export function ToneDot({ tone }: ToneDotProps) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full bg-(--tone-color) ring-1 ring-black/15 dark:ring-white/20"
      style={{ "--tone-color": SKIN_TONE_COLORS[tone] } as CSSProperties}
    />
  );
}
