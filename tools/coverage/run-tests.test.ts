import { afterEach, describe, expect, it, vi } from "vitest";

const spawnSync = vi.fn();
const runGate = vi.fn();

vi.mock("node:child_process", () => ({ spawnSync }));
vi.mock("./check", () => ({ runGate }));

const { runTests } = await import("./run-tests");

describe("runTests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes when the tasks and the gate pass", async () => {
    spawnSync.mockReturnValue({ status: 0 });
    runGate.mockResolvedValue(0);
    expect(await runTests()).toBe(0);
  });

  it("still runs the gate and fails when a task fails", async () => {
    spawnSync.mockReturnValue({ status: 1 });
    runGate.mockResolvedValue(0);
    expect(await runTests()).toBe(1);
    expect(runGate).toHaveBeenCalledOnce();
  });

  it("fails when only the gate fails", async () => {
    spawnSync.mockReturnValue({ status: 0 });
    runGate.mockResolvedValue(1);
    expect(await runTests()).toBe(1);
  });
});
