import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";

const { authMock, afterMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  afterMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("next/server", () => ({
  after: afterMock,
}));

import { GET } from "../../src/app/api/scans/[id]/route";
import { POST } from "../../src/app/api/uploads/route";
import { handleUpload } from "../../src/lib/api/uploads-handler";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/tiny-slab.glb",
);

async function getUser(email: string) {
  return getPrisma().user.findUniqueOrThrow({
    where: { email },
  });
}

describe("upload API", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    process.env.STORAGE_ROOT = path.join(process.cwd(), "storage-test");

    await ensureGardenUser();
    await getPrisma().user.upsert({
      where: { email: "other@garden.local" },
      create: {
        email: "other@garden.local",
        passwordHash: "unused",
      },
      update: {
        passwordHash: "unused",
      },
    });
  });

  beforeEach(() => {
    authMock.mockReset();
    afterMock.mockReset();
    afterMock.mockImplementation(() => {});
  });

  it("creates a processing scan, writes the raw upload, and finishes baking", async () => {
    const user = await getUser("test@garden.local");
    const result = await handleUpload({
      userId: user.id,
      filename: "tiny-slab.glb",
      bytes: fs.readFileSync(fixturePath),
      startBake: true,
    });

    expect(result.status).toBe("processing");

    const created = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: result.scanId },
    });

    expect(created.rawPath && fs.existsSync(created.rawPath)).toBe(true);
    expect(path.basename(created.rawPath ?? "")).toBe("raw.glb");
    expect(path.relative(process.cwd(), created.rawPath ?? "")).toContain(
      path.join("storage-test", "gardens", created.gardenId, created.id),
    );

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const updated = await getPrisma().scanVersion.findUniqueOrThrow({
        where: { id: result.scanId },
      });

      if (updated.status !== "processing") {
        expect(updated.status).toBe("ready");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("bake did not finish");
  });

  it("rejects unsupported upload extensions", async () => {
    const user = await getUser("test@garden.local");

    await expect(
      handleUpload({
        userId: user.id,
        filename: "scan.pdf",
        bytes: Buffer.from("nope"),
        startBake: false,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects oversize uploads", async () => {
    const user = await getUser("test@garden.local");

    await expect(
      handleUpload({
        userId: user.id,
        filename: "big.glb",
        bytes: Buffer.alloc(50_000_001),
        startBake: false,
      }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("POST returns 401 without an authenticated user", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
  });

  it("POST accepts multipart uploads and schedules baking", async () => {
    const user = await getUser("test@garden.local");
    authMock.mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
      },
    });

    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(fixturePath)]), "tiny-slab.glb");

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scanId: expect.any(String),
      status: "processing",
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(typeof afterMock.mock.calls[0]?.[0]).toBe("function");
  });

  it("POST rejects requests without a file field", async () => {
    const user = await getUser("test@garden.local");
    authMock.mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Missing file upload",
    });
  });

  it("GET returns the safe scan payload only to the garden owner", async () => {
    const owner = await getUser("test@garden.local");
    const otherUser = await getUser("other@garden.local");

    const result = await handleUpload({
      userId: owner.id,
      filename: "tiny-slab.glb",
      bytes: fs.readFileSync(fixturePath),
      startBake: false,
    });

    authMock.mockResolvedValue({
      user: {
        id: owner.id,
        email: owner.email,
      },
    });

    const okResponse = await GET(new Request(`http://localhost/api/scans/${result.scanId}`), {
      params: Promise.resolve({ id: result.scanId }),
    });

    expect(okResponse.status).toBe(200);
    await expect(okResponse.json()).resolves.toEqual({
      id: result.scanId,
      status: "processing",
      failureReason: null,
      sourceFilename: "tiny-slab.glb",
      createdAt: expect.any(String),
      minZ: null,
      maxZ: null,
      widthMeters: null,
      heightMeters: null,
      hasRaw: true,
      hasHeightmap: false,
      hasBoundary: false,
      hasPreview: false,
    });

    authMock.mockResolvedValue({
      user: {
        id: otherUser.id,
        email: otherUser.email,
      },
    });

    const missingResponse = await GET(
      new Request(`http://localhost/api/scans/${result.scanId}`),
      {
        params: Promise.resolve({ id: result.scanId }),
      },
    );

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({ message: "Not found" });
  });
});
