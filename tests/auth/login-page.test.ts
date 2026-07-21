import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

class MockAuthError extends Error {}

vi.mock("next-auth", () => ({
  AuthError: MockAuthError,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
}));

function findEmailInput(node: ReactNode): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findEmailInput(child);
      if (match) {
        return match;
      }
    }

    return null;
  }

  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as {
    children?: ReactNode;
    defaultValue?: string;
    name?: string;
  };

  if (node.type === "input" && props.name === "email") {
    return props;
  }

  return findEmailInput(props.children);
}

describe("LoginPage", () => {
  afterEach(() => {
    delete process.env.GARDEN_USER_EMAIL;
    vi.resetModules();
  });

  it("does not prefill the configured owner email", async () => {
    process.env.GARDEN_USER_EMAIL = "owner@garden.local";

    const { default: LoginPage } = await import("../../src/app/login/page");
    const tree = await LoginPage({
      searchParams: Promise.resolve({}),
    });
    const emailInput = findEmailInput(tree);

    expect(emailInput).toBeTruthy();
    expect(emailInput?.name).toBe("email");
    expect(emailInput?.defaultValue).toBeUndefined();
  });
});
