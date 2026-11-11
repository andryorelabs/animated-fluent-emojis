import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { COPIED_MS, copyWithFeedback } from "@/lib/copy-feedback";

import CopyBurst, {
  BURST_PARTICLES,
  BurstParticles,
  CopyBurstView,
  particleStyle,
} from "./CopyBurst";

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("onCopied fires after a successful copy", async () => {
  writeText.mockResolvedValue(undefined);
  const onCopied = vi.fn();
  await copyWithFeedback("npm i x", vi.fn(), {}, onCopied);
  expect(onCopied).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(COPIED_MS);
  expect(onCopied).toHaveBeenCalledOnce();
});

test("onCopied never fires when the clipboard write is rejected", async () => {
  writeText.mockRejectedValue(new Error("denied"));
  const onCopied = vi.fn();
  await copyWithFeedback("npm i x", vi.fn(), {}, onCopied);
  expect(onCopied).not.toHaveBeenCalled();
});

test("CopyBurst renders nothing before the first copy", () => {
  expect(renderToString(<CopyBurst burst={0} />)).toBe("");
});

test("CopyBurstView renders nothing under reduced motion", () => {
  expect(CopyBurstView({ burst: 3, reducedMotion: true })).toBeNull();
});

test("CopyBurstView renders five decorative non-interactive particles", () => {
  expect(CopyBurstView({ burst: 1, reducedMotion: false })).not.toBeNull();
  const html = renderToString(<BurstParticles />);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("pointer-events-none");
  expect(html.match(/copy-burst-particle/g)).toHaveLength(5);
  expect(BURST_PARTICLES).toHaveLength(5);
});

test("CopyBurstView re-keys the particles on every copy", () => {
  const first = CopyBurstView({ burst: 1, reducedMotion: false });
  const second = CopyBurstView({ burst: 2, reducedMotion: false });
  expect(first?.key).toBe("1");
  expect(second?.key).toBe("2");
});

test("particleStyle keeps every particle within 24 to 48px of the button", () => {
  for (const particle of BURST_PARTICLES) {
    const style = particleStyle(particle) as Record<string, string>;
    const x = Number((style["--burst-x"] ?? "").replace("px", ""));
    const y = Number((style["--burst-y"] ?? "").replace("px", ""));
    const distance = Math.hypot(x, y);
    expect(distance).toBeGreaterThanOrEqual(23.9);
    expect(distance).toBeLessThanOrEqual(48.1);
  }
});
