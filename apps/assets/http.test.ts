import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchOk, fetchOkOrMissing, type FetchLike } from "./http.js";

function sequence(...outcomes: (Response | Error)[]): {
  fetch: FetchLike;
  calls: () => number;
} {
  let index = 0;
  const fetch: FetchLike = () => {
    const outcome = outcomes[Math.min(index, outcomes.length - 1)] ?? new Error("no outcome");
    index += 1;
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome.clone());
  };
  return { fetch, calls: () => index };
}

function status(code: number, headers?: Record<string, string>): Response {
  return new Response("x", headers === undefined ? { status: code } : { status: code, headers });
}

async function settle(promise: Promise<unknown>): Promise<"rejected" | "resolved"> {
  try {
    await promise;
    return "resolved";
  } catch {
    return "rejected";
  }
}

describe("fetchOk", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a successful response without waiting", async () => {
    const { fetch, calls } = sequence(status(200));
    const response = await fetchOk(fetch, "https://x.test/a");
    expect(response.status).toBe(200);
    expect(calls()).toBe(1);
  });

  it("waits for Retry-After seconds on 429 and then succeeds", async () => {
    const { fetch, calls } = sequence(status(429, { "retry-after": "7" }), status(200));
    const pending = fetchOk(fetch, "https://x.test/a");
    await vi.advanceTimersByTimeAsync(6999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("honours a Retry-After HTTP date", async () => {
    const date = new Date("2026-01-01T00:00:10Z").toUTCString();
    const { fetch, calls } = sequence(status(429, { "retry-after": date }), status(200));
    const pending = fetchOk(fetch, "https://x.test/a");
    await vi.advanceTimersByTimeAsync(9999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(calls()).toBe(2);
  });

  it("caps Retry-After at 60 seconds", async () => {
    const { fetch, calls } = sequence(status(429, { "retry-after": "3600" }), status(200));
    const pending = fetchOk(fetch, "https://x.test/a");
    await vi.advanceTimersByTimeAsync(59_999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(calls()).toBe(2);
  });

  it.each([408, 500, 502, 503])("retries status %i", async (code) => {
    const { fetch, calls } = sequence(status(code), status(200));
    const pending = fetchOk(fetch, "https://x.test/a");
    await vi.runAllTimersAsync();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("retries network errors", async () => {
    const { fetch, calls } = sequence(new TypeError("boom"), status(200));
    const pending = fetchOk(fetch, "https://x.test/a");
    await vi.runAllTimersAsync();
    await pending;
    expect(calls()).toBe(2);
  });

  it("backs off exponentially between attempts", async () => {
    const { fetch, calls } = sequence(status(500));
    const pending = settle(fetchOk(fetch, "https://x.test/a"));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(calls()).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls()).toBe(3);
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls()).toBe(4);
    await vi.advanceTimersByTimeAsync(4000);
    expect(calls()).toBe(5);
    expect(await pending).toBe("rejected");
  });

  it.each([400, 401, 403, 404])("does not retry status %i", async (code) => {
    const { fetch, calls } = sequence(status(code), status(200));
    await expect(fetchOk(fetch, "https://x.test/a")).rejects.toThrow(`HTTP ${String(code)}`);
    expect(calls()).toBe(1);
  });

  it("rethrows the last error after 5 attempts", async () => {
    const { fetch, calls } = sequence(
      status(503),
      status(503),
      status(503),
      status(503),
      new TypeError("last"),
    );
    const pending = settle(fetchOk(fetch, "https://x.test/a"));
    await vi.runAllTimersAsync();
    expect(await pending).toBe("rejected");
    expect(calls()).toBe(5);
  });
});

describe("fetchOk timeout", () => {
  it("aborts a stalled attempt and retries it", async () => {
    vi.useRealTimers();
    let calls = 0;
    const fetch: FetchLike = (_url, init) => {
      calls += 1;
      if (calls > 1) return Promise.resolve(status(200));
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    };

    const response = await fetchOk(fetch, "https://x.test/a", undefined, 2, 20);

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("retries when the body read fails after the headers arrived", async () => {
    vi.useRealTimers();
    let calls = 0;
    const fetch: FetchLike = () => {
      calls += 1;
      if (calls > 1) return Promise.resolve(new Response("body"));
      const stalled = new Response("x");
      vi.spyOn(stalled, "arrayBuffer").mockRejectedValue(new Error("body timed out"));
      return Promise.resolve(stalled);
    };

    const response = await fetchOk(fetch, "https://x.test/a", undefined, 2, 20);

    expect(await response.text()).toBe("body");
    expect(calls).toBe(2);
  });
});

describe("fetchOkOrMissing", () => {
  it("resolves undefined on 404 and fails on other client errors", async () => {
    const missing = sequence(status(404)).fetch;
    const forbidden = sequence(status(403)).fetch;
    await expect(fetchOkOrMissing(missing, "https://x.test/a")).resolves.toBeUndefined();
    await expect(fetchOkOrMissing(forbidden, "https://x.test/a")).rejects.toThrow("HTTP 403");
  });
});
