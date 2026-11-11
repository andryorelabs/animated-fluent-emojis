import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFileActionStore,
  DEFAULT_FILE_ACTION,
  downloadFile,
  FILE_ACTION_STORAGE_KEY,
  FILE_ACTIONS,
  isFileAction,
  parseFileAction,
  runFileAction,
} from "./file-action";

const target = {
  filenameBase: "waving-hand",
  urlFor: (format: string) => `https://files.test/wave.${format}`,
};

describe("file actions", () => {
  it("lists download and copy for webp, gif and png", () => {
    expect(FILE_ACTIONS).toEqual([
      "download-webp",
      "download-gif",
      "download-png",
      "copy-webp",
      "copy-gif",
      "copy-png",
    ]);
  });

  it("defaults to downloading the WebP", () => {
    expect(DEFAULT_FILE_ACTION).toBe("download-webp");
    expect(FILE_ACTION_STORAGE_KEY).toBe("afe:file-action");
  });

  it("recognizes only supported actions", () => {
    expect(isFileAction("copy-gif")).toBe(true);
    expect(isFileAction("copy-svg")).toBe(false);
    expect(isFileAction(null)).toBe(false);
  });

  it("splits an action into verb and format", () => {
    expect(parseFileAction("copy-gif")).toEqual({
      verb: "copy",
      format: "gif",
    });
  });

  it("downloads the file under the slug and format", async () => {
    const io = { download: vi.fn(), copy: vi.fn() };
    const outcome = await runFileAction("download-png", target, io);
    expect(outcome).toBe("downloaded");
    expect(io.download).toHaveBeenCalledWith("https://files.test/wave.png", "waving-hand.png");
    expect(io.copy).not.toHaveBeenCalled();
  });

  it("copies the URL of the chosen format", async () => {
    const io = { download: vi.fn(), copy: vi.fn() };
    const outcome = await runFileAction("copy-gif", target, io);
    expect(outcome).toBe("copied");
    expect(io.copy).toHaveBeenCalledWith("https://files.test/wave.gif");
    expect(io.download).not.toHaveBeenCalled();
  });

  it("reports a failure instead of throwing", async () => {
    const io = {
      download: vi.fn().mockRejectedValue(new Error("offline")),
      copy: vi.fn().mockRejectedValue(new Error("denied")),
    };
    expect(await runFileAction("download-webp", target, io)).toBe("failed");
    expect(await runFileAction("copy-webp", target, io)).toBe("failed");
  });

  it("stores the choice under afe:file-action", () => {
    const values = new Map<string, string>();
    const store = createFileActionStore({
      storage: () => ({
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
          values.set(key, value);
        },
      }),
      target: new EventTarget(),
    });
    expect(store.get()).toBe("download-webp");
    store.set("copy-gif");
    expect(values.get("afe:file-action")).toBe("copy-gif");
  });
});

describe("downloadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves the response blob through a temporary link", async () => {
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    const revoke = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("data"))),
    );
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { append },
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:x",
      revokeObjectURL: revoke,
    });
    await downloadFile("https://files.test/a.webp", "a.webp");
    expect(link).toMatchObject({ href: "blob:x", download: "a.webp" });
    expect(append).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalled();
    expect(link.remove).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });

  it("rejects when the file answers an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 }))),
    );
    await expect(downloadFile("https://files.test/a", "a")).rejects.toThrow(/404/);
  });
});
