import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { getPrisma } from "../../src/lib/db";

describe("ensure user", () => {
  beforeAll(async () => {
    process.env.AUTH_SECRET = "test-secret";
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
  });

  it("upserts the single user from env", async () => {
    const { ensureGardenUser } = await import("../../scripts/ensure-user");
    await ensureGardenUser();
    const user = await getPrisma().user.findUnique({
      where: { email: "test@garden.local" },
    });
    expect(user).toBeTruthy();
    expect(bcrypt.compareSync("test-password", user!.passwordHash)).toBe(true);
  });

  it("authorizes the single user with matching credentials", async () => {
    const { ensureGardenUser } = await import("../../scripts/ensure-user");
    const { authorizeGardenUser } = await import(
      "../../src/lib/auth-credentials"
    );

    await ensureGardenUser();

    await expect(
      authorizeGardenUser({
        email: "test@garden.local",
        password: "test-password",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        email: "test@garden.local",
      }),
    );
  });

  it("rejects the single user with an invalid password", async () => {
    const { ensureGardenUser } = await import("../../scripts/ensure-user");
    const { authorizeGardenUser } = await import(
      "../../src/lib/auth-credentials"
    );

    await ensureGardenUser();

    await expect(
      authorizeGardenUser({
        email: "test@garden.local",
        password: "wrong-password",
      }),
    ).resolves.toBeNull();
  });
});
