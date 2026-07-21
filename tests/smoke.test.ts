import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("exports a prisma getter", async () => {
    const { getPrisma } = await import("../src/lib/db");
    expect(typeof getPrisma).toBe("function");
  });
});
