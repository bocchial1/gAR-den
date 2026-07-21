import { getPrisma } from "./db";

export async function getOrCreateGarden(userId: string) {
  const existing = await getPrisma().garden.findFirst({ where: { userId } });
  if (existing) return existing;
  return getPrisma().garden.create({
    data: { userId, name: "Home garden" },
  });
}

export async function latestReadyScan(gardenId: string) {
  return getPrisma().scanVersion.findFirst({
    where: { gardenId, status: "ready" },
    orderBy: { createdAt: "desc" },
  });
}
