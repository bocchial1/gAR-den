import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";
import { getOrCreateGarden } from "../../src/lib/garden";
import { ensureStorageDir } from "../../src/lib/storage";
import { runBake } from "../../src/lib/bake/run-bake";
import { getScanAsset } from "../../src/lib/api/assets-handler";
import { HttpError } from "../../src/lib/api/uploads-handler";

describe("getScanAsset", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    process.env.STORAGE_ROOT = path.join(process.cwd(), "storage-test");
    await ensureGardenUser();
  });

  it("returns png bytes for a ready scan", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const garden = await getOrCreateGarden(user.id);
    const scan = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "processing",
        sourceFilename: "tiny-slab.glb",
        rawPath: "",
      },
    });
    const dir = await ensureStorageDir("scans", scan.id);
    const raw = path.join(dir, "raw.glb");
    fs.copyFileSync(
      path.join(__dirname, "../fixtures/tiny-slab.glb"),
      raw,
    );
    await getPrisma().scanVersion.update({
      where: { id: scan.id },
      data: { rawPath: raw },
    });
    await runBake(scan.id);
    const asset = await getScanAsset({
      userId: user.id,
      scanId: scan.id,
      kind: "preview",
    });
    expect(asset.contentType).toBe("image/png");
    expect(asset.bytes.subarray(0, 8).toString("hex")).toBe(
      "89504e470d0a1a0a",
    );
  });

  it("404s for unknown kind", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    await expect(
      getScanAsset({
        userId: user.id,
        scanId: "missing",
        kind: "heightmap",
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
