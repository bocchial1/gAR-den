import fs from "node:fs/promises";

import { getPrisma } from "@/lib/db";
import { HttpError } from "@/lib/api/uploads-handler";

export type ScanAssetKind = "heightmap" | "boundary" | "preview";

const KIND_TO_PATH = {
  heightmap: "heightmapPath",
  boundary: "boundaryPath",
  preview: "previewPath",
} as const satisfies Record<ScanAssetKind, string>;

export type GetScanAssetInput = {
  userId: string;
  scanId: string;
  kind: ScanAssetKind;
};

export async function getScanAsset({
  userId,
  scanId,
  kind,
}: GetScanAssetInput): Promise<{ bytes: Buffer; contentType: "image/png" }> {
  if (!(kind in KIND_TO_PATH)) {
    throw new HttpError(404, "Asset not found");
  }

  const scan = await getPrisma().scanVersion.findFirst({
    where: {
      id: scanId,
      garden: { userId },
    },
    select: {
      status: true,
      heightmapPath: true,
      boundaryPath: true,
      previewPath: true,
    },
  });

  if (!scan || scan.status !== "ready") {
    throw new HttpError(404, "Asset not found");
  }

  const pathKey = KIND_TO_PATH[kind];
  const filePath = scan[pathKey as keyof typeof scan];

  if (!filePath || typeof filePath !== "string") {
    throw new HttpError(404, "Asset not found");
  }

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(filePath);
  } catch {
    throw new HttpError(404, "Asset not found");
  }

  return { bytes, contentType: "image/png" };
}
