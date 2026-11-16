import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import CopyBurst, { BURST_PARTICLES, BurstParticles } from "./CopyBurst";

function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => new Promise(vi.fn()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("nothing renders before the first copy", () => {
  stubReducedMotion(false);
  const { container } = render(<CopyBurst burst={0} />);

  expect(container.querySelector("[data-copy-burst]")).toBeNull();
});

test("a copy mounts one particle per definition", () => {
  stubReducedMotion(false);
  const { container } = render(<CopyBurst burst={1} />);

  expect(container.querySelectorAll(".copy-burst-particle")).toHaveLength(BURST_PARTICLES.length);
  expect(container.querySelector("[data-copy-burst]")?.getAttribute("aria-hidden")).toBe("true");
});

test("reduced motion suppresses the burst", () => {
  stubReducedMotion(true);
  const { container } = render(<CopyBurst burst={3} />);

  expect(container.querySelector("[data-copy-burst]")).toBeNull();
});

test("the particle layer unmounts itself once the animation has run", async () => {
  vi.useFakeTimers();
  const { container } = render(<BurstParticles />);
  expect(container.querySelector("[data-copy-burst]")).not.toBeNull();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(700);
  });

  expect(container.querySelector("[data-copy-burst]")).toBeNull();
});
