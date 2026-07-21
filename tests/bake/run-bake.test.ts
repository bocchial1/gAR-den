import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPrisma } from "../../src/lib/db";
import { getOrCreateGarden } from "../../src/lib/garden";
import { ensureStorageDir, storagePath } from "../../src/lib/storage";
import { ensureGardenUser } from "../../scripts/ensure-user";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/tiny-slab.glb",
);

describe("runBake", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    process.env.STORAGE_ROOT = path.join(process.cwd(), "storage-test");
    await ensureGardenUser();
  });

  it("marks scan ready and writes assets", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const garden = await getOrCreateGarden(user.id);
    const dir = await ensureStorageDir("scans", `test-scan-${Date.now()}`);
    const raw = path.join(dir, "raw.glb");

    fs.copyFileSync(fixturePath, raw);

    const scan = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "processing",
        rawPath: raw,
        sourceFilename: "tiny-slab.glb",
      },
    });

    const { runBake } = await import("../../src/lib/bake/run-bake");
    await runBake(scan.id);

    const updated = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: scan.id },
    });

    expect(updated.status).toBe("ready");
    expect(updated.heightmapPath && fs.existsSync(updated.heightmapPath)).toBe(
      true,
    );
    expect(updated.boundaryPath && fs.existsSync(updated.boundaryPath)).toBe(
      true,
    );
    expect(updated.previewPath && fs.existsSync(updated.previewPath)).toBe(
      true,
    );
    expect(updated.minZ).not.toBeNull();
    expect(updated.maxZ).not.toBeNull();
    expect(updated.widthMeters).toBeCloseTo(1, 5);
    expect(updated.heightMeters).toBeCloseTo(1, 5);
  });

  it("failed bake does not change a prior ready scan", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const garden = await getOrCreateGarden(user.id);

    const ready = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "ready",
        rawPath: "x",
        heightmapPath: "x",
        boundaryPath: "x",
        previewPath: "x",
      },
    });

    const bad = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "processing",
        rawPath: storagePath("missing.glb"),
        sourceFilename: "missing.glb",
      },
    });

    const { runBake } = await import("../../src/lib/bake/run-bake");
    await runBake(bad.id);

    const badUpdated = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: bad.id },
    });
    const readyStill = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: ready.id },
    });

    expect(badUpdated.status).toBe("failed");
    expect(badUpdated.failureReason).toMatch(/missing|enoent|raw/i);
    expect((badUpdated.failureReason ?? "").length).toBeLessThanOrEqual(500);
    expect(readyStill.status).toBe("ready");
  });
});
