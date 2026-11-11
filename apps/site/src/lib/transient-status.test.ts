import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTransientStatus, type TransientStatusState } from "./transient-status";

describe("transient status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the message and hides it after the delay, keeping the text", () => {
    const states: TransientStatusState[] = [];
    const status = createTransientStatus((state) => {
      states.push(state);
    }, 2000);
    status.show("Copied");
    expect(states).toEqual([{ message: "Copied", visible: true }]);
    vi.advanceTimersByTime(2000);
    expect(states.at(-1)).toEqual({ message: "Copied", visible: false });
  });

  it("retargets a second message within the delay without hiding", () => {
    const states: TransientStatusState[] = [];
    const status = createTransientStatus((state) => {
      states.push(state);
    }, 2000);
    status.show("Copied");
    vi.advanceTimersByTime(1500);
    status.show("Copied again");
    vi.advanceTimersByTime(1500);
    expect(states.every((state) => state.visible)).toBe(true);
    vi.advanceTimersByTime(500);
    expect(states.at(-1)).toEqual({ message: "Copied again", visible: false });
  });

  it("cancels the pending hide on dispose", () => {
    const onChange = vi.fn();
    const status = createTransientStatus(onChange, 2000);
    status.show("Copied");
    status.dispose();
    vi.advanceTimersByTime(5000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
