import { afterEach, expect, test, vi } from "vitest";

interface FakeObserver {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  notify: (entries: { target: object; isIntersecting: boolean }[]) => void;
}

const instances: FakeObserver[] = [];

const installFakeObserver = () => {
  instances.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      notify: FakeObserver["notify"];
      constructor(callback: (entries: unknown[]) => void) {
        this.notify = (entries) => {
          callback(entries);
        };
        instances.push(this);
      }
    },
  );
};

const importFresh = async () => {
  vi.resetModules();
  return import("./visibility-observer.js");
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("reports visible once and does nothing where IntersectionObserver is missing", async () => {
  const { observeVisibility } = await importFresh();
  const callback = vi.fn();

  const stop = observeVisibility({} as Element, callback);

  expect(callback).toHaveBeenCalledExactlyOnceWith(true);
  expect(() => {
    stop();
  }).not.toThrow();
});

test("creates the observer lazily and shares it between elements", async () => {
  installFakeObserver();
  const { observeVisibility } = await importFresh();
  expect(instances).toHaveLength(0);

  const first = {} as Element;
  const second = {} as Element;
  const firstCallback = vi.fn();
  const secondCallback = vi.fn();
  observeVisibility(first, firstCallback);
  observeVisibility(second, secondCallback);

  expect(instances).toHaveLength(1);
  instances[0]?.notify([
    { target: first, isIntersecting: true },
    { target: second, isIntersecting: false },
  ]);
  expect(firstCallback).toHaveBeenCalledWith(true);
  expect(secondCallback).toHaveBeenCalledWith(false);
});

test("stops reporting after the returned function runs", async () => {
  installFakeObserver();
  const { observeVisibility } = await importFresh();
  const element = {} as Element;
  const callback = vi.fn();

  const stop = observeVisibility(element, callback);
  stop();
  instances[0]?.notify([{ target: element, isIntersecting: true }]);

  expect(instances[0]?.unobserve).toHaveBeenCalledWith(element);
  expect(callback).not.toHaveBeenCalled();
});
