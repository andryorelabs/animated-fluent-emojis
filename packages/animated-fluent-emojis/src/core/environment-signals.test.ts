import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const importFresh = async () => {
  vi.resetModules();
  return import("./environment-signals.js");
};

test("defaults are safe where document and matchMedia are missing", async () => {
  const signals = await importFresh();
  expect(signals.getDocumentHidden()).toBe(false);
  expect(signals.getPrefersReducedMotion()).toBe(false);
  const stop = signals.subscribeToReducedMotion(vi.fn());
  stop();
});

test("document hidden shares one listener", async () => {
  const target = new EventTarget();
  const state = { hidden: false };
  const addSpy = vi.fn(target.addEventListener.bind(target));
  const removeSpy = vi.fn(target.removeEventListener.bind(target));
  vi.stubGlobal("document", {
    get hidden() {
      return state.hidden;
    },
    addEventListener: addSpy,
    removeEventListener: removeSpy,
  });
  const signals = await importFresh();
  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = signals.subscribeToDocumentHidden(first);
  const stopSecond = signals.subscribeToDocumentHidden(second);
  expect(addSpy).toHaveBeenCalledTimes(1);

  state.hidden = true;
  target.dispatchEvent(new Event("visibilitychange"));
  expect(signals.getDocumentHidden()).toBe(true);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);

  stopFirst();
  stopSecond();
  expect(removeSpy).toHaveBeenCalledTimes(1);
});

test("reduced motion reads one shared media query", async () => {
  const query = Object.assign(new EventTarget(), { matches: true });
  const matchMedia = vi.fn(() => query);
  vi.stubGlobal("matchMedia", matchMedia);
  const signals = await importFresh();
  const listener = vi.fn();
  const stop = signals.subscribeToReducedMotion(listener);
  expect(signals.getPrefersReducedMotion()).toBe(true);
  query.dispatchEvent(new Event("change"));
  expect(listener).toHaveBeenCalledTimes(1);
  stop();
  query.dispatchEvent(new Event("change"));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(matchMedia).toHaveBeenCalledTimes(1);
});
