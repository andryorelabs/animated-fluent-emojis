import { SKIN_TONES, type SkinTone } from "./public-index";

/**
 * The sizes the gallery can render emojis at.
 */
export const GALLERY_SIZES = [64, 96, 128] as const;

/**
 * One of the {@link GALLERY_SIZES}.
 */
export type GallerySize = (typeof GALLERY_SIZES)[number];

/**
 * The size the gallery renders at when the URL does not say otherwise.
 */
const DEFAULT_GALLERY_SIZE: GallerySize = 64;

/**
 * Gallery filters that live in the page URL, so a search can be reloaded and
 * shared.
 */
export interface GalleryUrlState {
  query: string;
  tone: SkinTone | undefined;
  category: string | undefined;
  size: GallerySize;
}

/**
 * Reads the gallery filters from a query string. Unknown tones and blank
 * values are dropped, and an unknown size falls back to 64.
 * @param search - The query string, with or without the leading `?`.
 * @returns The parsed filters.
 */
export function parseGalleryUrl(search: string): GalleryUrlState {
  const parameters = new URLSearchParams(search);
  const tone = parameters.get("tone");
  const category = parameters.get("c")?.trim();
  const size = GALLERY_SIZES.find((candidate) => String(candidate) === parameters.get("s"));
  return {
    query: parameters.get("q") ?? "",
    tone: SKIN_TONES.find((candidate) => candidate === tone),
    category: category === "" ? undefined : category,
    size: size ?? DEFAULT_GALLERY_SIZE,
  };
}

/**
 * Writes the gallery filters as a query string.
 * @param state - The filters to write.
 * @returns A query string with a leading `?`, or an empty string when no
 * filter is set and the size is the default.
 */
export function serializeGalleryUrl(state: GalleryUrlState): string {
  const parameters = new URLSearchParams();
  if (state.query.trim() !== "") parameters.set("q", state.query);
  if (state.tone) parameters.set("tone", state.tone);
  if (state.category) parameters.set("c", state.category);
  if (state.size !== DEFAULT_GALLERY_SIZE) parameters.set("s", String(state.size));
  const text = parameters.toString();
  return text === "" ? "" : `?${text}`;
}
