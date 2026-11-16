import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { getUi } from "../../i18n/ui";
import { StageToolbarControls, usePrefersReducedMotion } from "./StageToolbar";

const strings = getUi("en").gallery;

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the toolbar reports background and playback clicks", async () => {
  const user = userEvent.setup();
  const onBackgroundChange = vi.fn();
  const onToggleRunning = vi.fn();
  render(
    <StageToolbarControls
      strings={strings}
      background="dots"
      onBackgroundChange={onBackgroundChange}
      running
      onToggleRunning={onToggleRunning}
    />,
  );

  await user.click(screen.getByRole("button", { name: strings.backgroundDark }));
  expect(onBackgroundChange).toHaveBeenCalledWith("dark");

  await user.click(screen.getByRole("button", { name: strings.pauseAnimation }));
  expect(onToggleRunning).toHaveBeenCalledOnce();
});

test("usePrefersReducedMotion follows the media query and unsubscribes", () => {
  let listener: (() => void) | undefined;
  const list = {
    matches: false,
    addEventListener: vi.fn((_type: string, next: () => void) => {
      listener = next;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => list),
  );

  const { result, unmount } = renderHook(() => usePrefersReducedMotion());
  expect(result.current).toBe(false);

  list.matches = true;
  act(() => {
    listener?.();
  });
  expect(result.current).toBe(true);

  unmount();
  expect(list.removeEventListener).toHaveBeenCalled();
});
