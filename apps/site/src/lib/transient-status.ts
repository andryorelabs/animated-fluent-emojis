/**
 * The state of a {@link TransientStatus}: the last message that was shown and
 * whether it is currently on screen.
 */
export interface TransientStatusState {
  message: string;
  visible: boolean;
}

/**
 * A timer-driven status message.
 */
export interface TransientStatus {
  show: (message: string) => void;
  dispose: () => void;
}

/**
 * Creates a status that shows a message for a fixed time and then hides it
 * while keeping the message, so an exit animation still has text to display.
 * Showing again before the time elapses replaces the message and restarts the
 * timer without ever reporting a hidden state in between.
 * @param onChange - Called with the new state whenever it changes.
 * @param milliseconds - How long a message stays visible.
 * @returns The `show` and `dispose` handles.
 */
export function createTransientStatus(
  onChange: (state: TransientStatusState) => void,
  milliseconds: number,
): TransientStatus {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let message = "";

  return {
    show(next) {
      clearTimeout(timer);
      message = next;
      onChange({ message, visible: true });
      timer = setTimeout(() => {
        onChange({ message, visible: false });
      }, milliseconds);
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
