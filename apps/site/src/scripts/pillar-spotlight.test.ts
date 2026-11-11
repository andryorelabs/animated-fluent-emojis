import { afterEach, describe, expect, it, vi } from "vitest";

import { attachPillarSpotlight } from "./pillar-spotlight";

function createCard() {
  type Listener = (event: { clientX: number; clientY: number }) => void;

  const listeners = new Map<string, Listener>();
  const properties = new Map<string, string>();
  const spies = {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    }),
    getBoundingClientRect: () => ({ left: 100, top: 50 }),
    style: {
      setProperty: vi.fn((name: string, value: string) => {
        properties.set(name, value);
      }),
    },
  };
  return { card: spies as unknown as HTMLElement, listeners, properties, spies };
}

function stubEnvironment(options: { fine: boolean; reduced: boolean }) {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? options.reduced : options.fine,
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  return {
    pending: () => frames.size,
    flush: () => {
      const callbacks = frames.values().toArray();
      frames.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

describe("attachPillarSpotlight", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the pointer position relative to the card once per frame", () => {
    const environment = stubEnvironment({ fine: true, reduced: false });
    const { card, listeners, properties, spies } = createCard();
    attachPillarSpotlight([card]);
    const move = listeners.get("pointermove");
    expect(move).toBeDefined();

    move?.({ clientX: 110, clientY: 60 });
    move?.({ clientX: 130, clientY: 90 });
    expect(environment.pending()).toBe(1);
    expect(properties.size).toBe(0);

    environment.flush();
    expect(properties.get("--spotlight-x")).toBe("30px");
    expect(properties.get("--spotlight-y")).toBe("40px");
    expect(spies.style.setProperty).toHaveBeenCalledTimes(2);
  });

  it("writes again on the next frame", () => {
    const environment = stubEnvironment({ fine: true, reduced: false });
    const { card, listeners, properties } = createCard();
    attachPillarSpotlight([card]);
    listeners.get("pointermove")?.({ clientX: 110, clientY: 60 });
    environment.flush();
    listeners.get("pointermove")?.({ clientX: 120, clientY: 70 });
    environment.flush();
    expect(properties.get("--spotlight-x")).toBe("20px");
    expect(properties.get("--spotlight-y")).toBe("20px");
  });

  it("does nothing on coarse or hover-less pointers", () => {
    stubEnvironment({ fine: false, reduced: false });
    const { card, spies } = createCard();
    const detach = attachPillarSpotlight([card]);
    expect(spies.addEventListener).not.toHaveBeenCalled();
    expect(() => {
      detach();
    }).not.toThrow();
  });

  it("does nothing with reduced motion", () => {
    stubEnvironment({ fine: true, reduced: true });
    const { card, spies } = createCard();
    attachPillarSpotlight([card]);
    expect(spies.addEventListener).not.toHaveBeenCalled();
  });

  it("removes the listeners and drops a pending frame on detach", () => {
    const environment = stubEnvironment({ fine: true, reduced: false });
    const { card, listeners, properties } = createCard();
    const detach = attachPillarSpotlight([card]);
    listeners.get("pointermove")?.({ clientX: 110, clientY: 60 });
    detach();
    expect(listeners.size).toBe(0);
    environment.flush();
    expect(properties.size).toBe(0);
  });
});
