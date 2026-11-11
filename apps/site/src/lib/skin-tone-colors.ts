import type { SkinTone } from "../gallery/public-index";

/**
 * Display color of each skin tone dot, sampled from the waving-hand art on the
 * files site. The dot is decorative; the text label names the tone.
 */
export const SKIN_TONE_COLORS: Record<"default" | SkinTone, string> = {
  default: "#feba46",
  light: "#fac7b4",
  "medium-light": "#e3aa94",
  medium: "#b3867a",
  "medium-dark": "#865858",
  dark: "#533938",
};
