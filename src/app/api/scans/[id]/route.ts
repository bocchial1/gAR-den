import { getSessionUserId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const scan = await getPrisma().scanVersion.findFirst({
    where: {
      id,
      garden: { userId },
    },
    select: {
      id: true,
      status: true,
      failureReason: true,
      sourceFilename: true,
      createdAt: true,
      minZ: true,
      maxZ: true,
      widthMeters: true,
      heightMeters: true,
      rawPath: true,
      heightmapPath: true,
      boundaryPath: true,
      previewPath: true,
    },
  });

  if (!scan) {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  return Response.json({
    id: scan.id,
    status: scan.status,
    failureReason: scan.failureReason,
    sourceFilename: scan.sourceFilename,
    createdAt: scan.createdAt,
    minZ: scan.minZ,
    maxZ: scan.maxZ,
    widthMeters: scan.widthMeters,
    heightMeters: scan.heightMeters,
    hasRaw: Boolean(scan.rawPath),
    hasHeightmap: Boolean(scan.heightmapPath),
    hasBoundary: Boolean(scan.boundaryPath),
    hasPreview: Boolean(scan.previewPath),
  });
}
