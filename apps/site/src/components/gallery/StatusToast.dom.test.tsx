import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getUi } from "../../i18n/ui";
import { StatusToast, useStatusAnnouncer } from "./StatusToast";

const strings = getUi("en").gallery;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("StatusToast announces the message only while visible", () => {
  const { rerender } = render(<StatusToast message="Copied" visible />);
  expect(screen.getByRole("status").textContent).toBe("Copied");

  rerender(<StatusToast message="Copied" visible={false} />);
  expect(screen.getByRole("status").textContent).toBe("");
});

test("announce shows a message and hides it after two seconds while keeping the text", () => {
  const { result } = renderHook(() => useStatusAnnouncer(strings));

  act(() => {
    result.current.announce("Hello");
  });
  expect(result.current).toMatchObject({ message: "Hello", visible: true });

  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(result.current).toMatchObject({ message: "Hello", visible: false });
});

test("copy writes to the clipboard and announces the outcome", async () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { result } = renderHook(() => useStatusAnnouncer(strings));

  await act(async () => {
    await result.current.copy("text");
  });
  expect(writeText).toHaveBeenCalledWith("text");
  expect(result.current.message).toBe(strings.copied);

  writeText.mockRejectedValueOnce(new Error("denied"));
  await act(async () => {
    await result.current.copy("text");
  });
  expect(result.current.message).toBe(strings.downloadFailed);
});

test("handleNotice announces copied messages and failures", () => {
  const { result, unmount } = renderHook(() => useStatusAnnouncer(strings));

  act(() => {
    result.current.handleNotice({ kind: "copied", message: "URL copied" });
  });
  expect(result.current.message).toBe("URL copied");

  act(() => {
    result.current.handleNotice({ kind: "failed" });
  });
  expect(result.current.message).toBe(strings.downloadFailed);

  unmount();
});
