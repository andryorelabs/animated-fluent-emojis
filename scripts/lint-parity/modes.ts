/**
 * The inputs the harness can lint: the committed fixtures, this repository,
 * the pinned external corpus, or all three.
 */
export const MODES = ["fixtures", "repo", "corpus", "all"] as const;

export type Mode = (typeof MODES)[number];

/**
 * Validates the `--mode` flag value; throws on anything outside {@link MODES}.
 * @param value The raw `--mode` flag value.
 * @returns The validated mode.
 */
export function parseMode(value: string): Mode {
  const mode = MODES.find((candidate) => candidate === value);
  if (mode === undefined) {
    throw new Error(`--mode must be one of ${MODES.join(", ")} (got "${value}")`);
  }
  return mode;
}
