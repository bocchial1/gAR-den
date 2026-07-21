import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";

describe("getOrCreateGarden", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    await ensureGardenUser();
  });

  it("creates one garden then reuses it", async () => {
    const { getOrCreateGarden } = await import("../../src/lib/garden");
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const a = await getOrCreateGarden(user.id);
    const b = await getOrCreateGarden(user.id);
    expect(a.id).toBe(b.id);
    expect(a.name).toBe("Home garden");
  });
});
