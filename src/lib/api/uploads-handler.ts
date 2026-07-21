import fs from "node:fs/promises";
import path from "node:path";

import { runBake } from "@/lib/bake/run-bake";
import { getPrisma } from "@/lib/db";
import { getOrCreateGarden } from "@/lib/garden";
import { ensureStorageDir } from "@/lib/storage";

export const MAX_UPLOAD_BYTES = 50_000_000;
export const ALLOWED_EXT = new Set([".glb", ".gltf", ".obj", ".zip"]);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type HandleUploadInput = {
  userId: string;
  filename: string;
  bytes: Buffer;
  startBake: boolean;
};

export async function handleUpload({
  userId,
  filename,
  bytes,
  startBake,
}: HandleUploadInput): Promise<{ scanId: string; status: "processing" }> {
  const extension = path.extname(filename).toLowerCase();

  if (!ALLOWED_EXT.has(extension)) {
    throw new HttpError(400, `Unsupported upload type: ${filename}`);
  }

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, "Upload exceeds maximum size");
  }

  const garden = await getOrCreateGarden(userId);
  const scan = await getPrisma().scanVersion.create({
    data: {
      gardenId: garden.id,
      status: "processing",
      sourceFilename: filename,
    },
  });

  let rawPath: string | null = null;

  try {
    const dir = await ensureStorageDir("gardens", garden.id, scan.id);
    rawPath = path.join(dir, `raw${extension}`);

    await fs.writeFile(rawPath, bytes);
    await getPrisma().scanVersion.update({
      where: { id: scan.id },
      data: { rawPath },
    });
  } catch (error) {
    await failScanUpload(scan.id, rawPath, error);
    throw error;
  }

  if (startBake) {
    void runBake(scan.id);
  }

  return {
    scanId: scan.id,
    status: "processing",
  };
}

async function failScanUpload(
  scanId: string,
  rawPath: string | null,
  error: unknown,
) {
  if (rawPath) {
    await fs.rm(rawPath, { force: true }).catch(() => undefined);
  }

  await getPrisma()
    .scanVersion.update({
      where: { id: scanId },
      data: {
        status: "failed",
        failureReason: truncateFailureReason(error),
        rawPath: null,
      },
    })
    .catch(() => undefined);
}

function truncateFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}
