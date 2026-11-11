import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `twMerge` taught the site's `@theme` names, so `text-caption` is read as a
 * font size rather than a color, and `rounded-10` and `ease-native` replace
 * the utilities of their own group.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "micro",
        "caption",
        "meta",
        "compact",
        "heading-sm",
        "heading-md",
        "fluid-title",
        "fluid-closing",
        "fluid-hero",
      ],
      radius: ["brand", "7", "9", "10", "14", "18", "22", "28", "toggle"],
      ease: ["spring", "native", "out-gentle"],
    },
  },
});

/**
 * Joins conditional class names and resolves conflicting Tailwind utilities so
 * the last one wins.
 * @param inputs - Class names, arrays or conditional objects.
 * @returns The merged class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
