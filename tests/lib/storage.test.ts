import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempRoot = path.join(process.cwd(), "storage-unit-test");

describe("storage helpers", () => {
  afterEach(async () => {
    delete process.env.STORAGE_ROOT;
    vi.resetModules();
    vi.doUnmock("node:path");
    await fs.rm(tempRoot, { force: true, recursive: true });
  });

  it("joins process cwd with a relative storage root without using resolve", async () => {
    process.env.STORAGE_ROOT = "storage-test";

    const joinSpy = vi.fn(path.join);
    const resolveSpy = vi.fn(path.resolve);

    vi.doMock("node:path", async () => {
      const actual = await vi.importActual<typeof import("node:path")>(
        "node:path",
      );

      return {
        ...actual,
        default: {
          ...actual,
          join: joinSpy,
          resolve: resolveSpy,
        },
        join: joinSpy,
        resolve: resolveSpy,
      };
    });

    const { storageRoot } = await import("../../src/lib/storage");

    expect(storageRoot()).toBe(path.join(process.cwd(), "storage-test"));
    expect(joinSpy).toHaveBeenCalledWith(process.cwd(), "storage-test");
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("keeps storagePath and ensureStorageDir working for an absolute root", async () => {
    process.env.STORAGE_ROOT = tempRoot;

    const { ensureStorageDir, storagePath } = await import(
      "../../src/lib/storage"
    );

    const dir = await ensureStorageDir("scans", "unit");

    expect(dir).toBe(path.join(tempRoot, "scans", "unit"));
    expect(storagePath("scans", "unit")).toBe(dir);
    await expect(fs.stat(dir)).resolves.toBeTruthy();
  });
});
