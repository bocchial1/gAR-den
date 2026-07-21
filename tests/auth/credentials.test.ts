import { beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { getPrisma } from "../../src/lib/db";

const { nextAuthMock, credentialsProviderMock } = vi.hoisted(() => ({
  nextAuthMock: vi.fn((config: unknown) => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    config,
  })),
  credentialsProviderMock: vi.fn((config) => config),
}));

vi.mock("next-auth", () => ({
  default: nextAuthMock,
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: credentialsProviderMock,
}));

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

  it("projects the user id onto jwt and session callbacks", async () => {
    await import("../../src/lib/auth");
    const config = nextAuthMock.mock.calls.at(-1)?.[0] as
      | {
          callbacks?: {
            jwt: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
            session: (args: Record<string, unknown>) => Promise<{
              user?: Record<string, unknown>;
            }>;
          };
        }
      | undefined;

    expect(config?.callbacks).toBeTruthy();
    if (!config?.callbacks) {
      throw new Error("NextAuth callbacks were not configured");
    }

    const token = await config.callbacks.jwt({
      token: {},
      user: {
        id: "user-123",
        email: "test@garden.local",
      } as never,
      account: null,
      profile: undefined,
      trigger: "signIn",
      isNewUser: false,
      session: undefined,
    });

    expect(token).toMatchObject({
      sub: "user-123",
    });

    const session = await config.callbacks.session({
      session: {
        user: {
          email: "test@garden.local",
          name: null,
          image: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token,
      user: {
        id: "user-123",
        email: "test@garden.local",
      } as never,
      newSession: undefined,
      trigger: "update",
    });

    expect(session.user).toMatchObject({
      id: "user-123",
      email: "test@garden.local",
    });
  });
});
