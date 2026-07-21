import { getSessionUserId } from "@/lib/auth";
import { getScanAsset, type ScanAssetKind } from "@/lib/api/assets-handler";
import { HttpError } from "@/lib/api/uploads-handler";

type RouteContext = {
  params: Promise<{ id: string; kind: string }>;
};

const ALLOWED_KINDS = new Set<ScanAssetKind>([
  "heightmap",
  "boundary",
  "preview",
]);

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id, kind } = await context.params;

    if (!ALLOWED_KINDS.has(kind as ScanAssetKind)) {
      throw new HttpError(404, "Asset not found");
    }

    const asset = await getScanAsset({
      userId,
      scanId: id,
      kind: kind as ScanAssetKind,
    });

    return new Response(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ message: error.message }, { status: error.status });
  }

  return Response.json({ message: "Internal server error" }, { status: 500 });
}
