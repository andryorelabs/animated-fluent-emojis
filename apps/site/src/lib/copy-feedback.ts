/** How long the "Copied" state stays visible, in milliseconds. */
export const COPIED_MS = 2000;

const revertTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();

/**
 * Copies text to the clipboard and reports a temporary copied state.
 * A rejected clipboard write leaves the state untouched.
 * @param text - The text to copy.
 * @param showCopied - Called with `true` after a successful copy and with
 * `false` once `COPIED_MS` has elapsed since the last copy.
 * @param owner - Identifies the button whose revert timer a new copy resets;
 * defaults to `showCopied`.
 * @param onCopied - Called once after each successful copy, never after a
 * rejected clipboard write.
 * @returns Resolves after the clipboard write settles.
 */
export async function copyWithFeedback(
  text: string,
  showCopied: (copied: boolean) => void,
  owner: object = showCopied,
  onCopied?: () => void,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  showCopied(true);
  onCopied?.();
  const pending = revertTimers.get(owner);
  if (pending !== undefined) globalThis.clearTimeout(pending);
  revertTimers.set(
    owner,
    globalThis.setTimeout(() => {
      revertTimers.delete(owner);
      showCopied(false);
    }, COPIED_MS),
  );
}
