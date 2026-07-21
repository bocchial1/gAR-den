import { after } from "next/server";

import { auth } from "@/lib/auth";
import { runBake } from "@/lib/bake/run-bake";
import { getPrisma } from "@/lib/db";
import { handleUpload, HttpError } from "@/lib/api/uploads-handler";

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
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

async function resolveAuthenticatedUserId() {
  const session = await auth();
  const user = session?.user as { id?: string | null; email?: string | null } | undefined;

  if (user?.id) {
    return user.id;
  }

  if (!user?.email) {
    return null;
  }

  const record = await getPrisma().user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  return record?.id ?? null;
}

function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ message: error.message }, { status: error.status });
  }

  return Response.json({ message: "Internal server error" }, { status: 500 });
}
