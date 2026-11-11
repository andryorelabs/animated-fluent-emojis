const DEFAULT_SIZE = 100;

const NUMERIC_STRING = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Normalizes a requested emoji size. A number is rounded and anything but a
 * finite positive one falls back to 100. A string is any CSS length passed
 * through as-is; a numeric string is read as pixels without rounding and a
 * blank or non-positive one falls back to 100.
 * @param size - The requested size.
 * @returns A positive pixel number, or the original CSS length string.
 */
export const normalizeSize = (size: number | string): number | string => {
  if (typeof size === "string") {
    const trimmed = size.trim();
    if (trimmed === "") return DEFAULT_SIZE;
    if (!NUMERIC_STRING.test(trimmed)) return size;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SIZE;
  }
  return Number.isFinite(size) && Math.round(size) > 0 ? Math.round(size) : DEFAULT_SIZE;
};

/**
 * Converts a normalized size to a CSS length.
 * @param size - A normalized size.
 * @returns The size in `px` for a number, or the string unchanged.
 */
export const toCssLength = (size: number | string): string =>
  typeof size === "number" ? `${String(size)}px` : size;

/**
 * Normalizes an iteration count. `Infinity` becomes `'infinite'`; `NaN` and
 * negative values become 0, which disables autoplay.
 * @param value - The requested iterations.
 * @returns A non-negative number or `'infinite'`.
 */
export const normalizeIterations = (value: number | "infinite"): number | "infinite" => {
  if (value === "infinite" || value === Infinity) return "infinite";
  return Number.isNaN(value) || value < 0 ? 0 : value;
};
