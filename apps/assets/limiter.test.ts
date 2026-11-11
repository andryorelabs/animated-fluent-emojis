import { expect, test } from "vitest";

import { createLimiter } from "./limiter.js";

test("never runs more tasks at once than the limit", async () => {
  const limit = createLimiter(2);
  let active = 0;
  let peak = 0;
  const task = async (): Promise<void> => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
  };

  await Promise.all(Array.from({ length: 8 }, () => limit(task)));

  expect(peak).toBe(2);
});

test("a failing task releases its slot", async () => {
  const limit = createLimiter(1);
  const failed = limit(() => Promise.reject(new Error("boom")));
  const next = limit(() => Promise.resolve("ok"));

  await expect(failed).rejects.toThrow("boom");
  await expect(next).resolves.toBe("ok");
});

test("rejects an invalid limit", () => {
  expect(() => createLimiter(0)).toThrow("Invalid concurrency limit");
});
