import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion.js";

const Probe = () => {
  usePrefersReducedMotion();
  return null;
};

const fifty = Array.from({ length: 50 }, (_, index) => index);

test("attaches one media-query change listener for 50 consumers", async () => {
  const addSpy = vi.spyOn(MediaQueryList.prototype, "addEventListener");

  await render(
    <div>
      {fifty.map((key) => (
        <Probe key={key} />
      ))}
    </div>,
  );

  const calls = addSpy.mock.calls.filter(([type]) => type === "change");
  expect(calls).toHaveLength(1);
  addSpy.mockRestore();
});
