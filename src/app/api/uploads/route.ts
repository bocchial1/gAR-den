import { after } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import { runBake } from "@/lib/bake/run-bake";
import { handleUpload, HttpError } from "@/lib/api/uploads-handler";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "Missing file upload");
    }

    const result = await handleUpload({
      userId,
      filename: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
      startBake: false,
    });

    after(() => {
      void runBake(result.scanId);
    });

    return Response.json(result);
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
