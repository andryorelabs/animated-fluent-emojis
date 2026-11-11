import { Profiler } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useDocumentHidden } from "./use-document-hidden.js";

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => {
  Reflect.deleteProperty(document, "hidden");
  vi.restoreAllMocks();
});

const Probe = ({ isActive }: { isActive: boolean }) => {
  useDocumentHidden(isActive);
  return null;
};

const fifty = Array.from({ length: 50 }, (_, index) => index);

test("registers one visibilitychange listener for 50 active consumers", async () => {
  const addSpy = vi.spyOn(document, "addEventListener");

  await render(
    <div>
      {fifty.map((key) => (
        <Probe key={key} isActive />
      ))}
    </div>,
  );

  const calls = addSpy.mock.calls.filter(([type]) => type === "visibilitychange");
  expect(calls).toHaveLength(1);
});

test("inactive consumers do not re-render on visibility changes", async () => {
  let activeRenders = 0;
  let inactiveRenders = 0;
  const countActive = () => {
    activeRenders += 1;
  };
  const countInactive = () => {
    inactiveRenders += 1;
  };
  await render(
    <div>
      <Profiler id="active" onRender={countActive}>
        <Probe isActive />
      </Profiler>
      <Profiler id="inactive" onRender={countInactive}>
        <Probe isActive={false} />
      </Profiler>
    </div>,
  );
  const activeBefore = activeRenders;
  const inactiveBefore = inactiveRenders;

  setDocumentHidden(true);
  await vi.waitFor(() => {
    expect(activeRenders).toBeGreaterThan(activeBefore);
  });

  expect(inactiveRenders).toBe(inactiveBefore);
});
