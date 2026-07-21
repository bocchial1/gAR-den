import { describe, expect, it } from "vitest";

import { renderStatusLabel } from "../../src/components/ScanStatus";

describe("renderStatusLabel", () => {
  it("maps scan lifecycle states to readable labels", () => {
    expect(renderStatusLabel("processing")).toMatch(/processing/i);
    expect(renderStatusLabel("ready")).toMatch(/ready/i);
    expect(renderStatusLabel("failed")).toMatch(/failed/i);
  });
});
