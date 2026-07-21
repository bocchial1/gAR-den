import fs from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "../db";
import { loadMeshFromUpload } from "../mesh/load-mesh";
import { bakeHeightmap } from "./heightmap";
import { writeRasters } from "./write-rasters";

export async function runBake(scanId: string): Promise<void> {
  const scan = await getPrisma().scanVersion.findUnique({
    where: { id: scanId },
  });

  if (!scan) {
    throw new Error(`Scan ${scanId} not found`);
  }

  try {
    if (!scan.rawPath) {
      throw new Error("Scan is missing rawPath");
    }

    const raw = await fs.readFile(scan.rawPath);
    const mesh = await loadMeshFromUpload(raw, scan.sourceFilename || scan.rawPath);
    const baked = bakeHeightmap(mesh, 512);
    const rasters = await writeRasters(path.dirname(scan.rawPath), baked);

    await getPrisma().scanVersion.update({
      where: { id: scan.id },
      data: {
        status: "ready",
        failureReason: null,
        heightmapPath: rasters.heightmapPath,
        boundaryPath: rasters.boundaryPath,
        previewPath: rasters.previewPath,
        minZ: baked.minZ,
        maxZ: baked.maxZ,
        widthMeters: baked.widthMeters,
        heightMeters: baked.heightMeters,
      },
    });
  } catch (error) {
    await getPrisma().scanVersion.update({
      where: { id: scan.id },
      data: {
        status: "failed",
        failureReason: truncateFailureReason(error),
      },
    });
  }
}

function truncateFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}
