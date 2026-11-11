import { expect, test, vi } from "vitest";

import { createSharedSubscription } from "./shared-subscription.js";

test("attaches once for many subscribers and detaches after the last leaves", () => {
  const detach = vi.fn();
  let notify: () => void = vi.fn();
  const attach = vi.fn((onNotify: () => void) => {
    notify = onNotify;
    return detach;
  });
  const subscribe = createSharedSubscription(attach);
  const first = vi.fn();
  const second = vi.fn();

  const stopFirst = subscribe(first);
  const stopSecond = subscribe(second);
  notify();

  expect(attach).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);

  stopFirst();
  expect(detach).not.toHaveBeenCalled();
  stopSecond();
  expect(detach).toHaveBeenCalledTimes(1);

  subscribe(first);
  expect(attach).toHaveBeenCalledTimes(2);
});
