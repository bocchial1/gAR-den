import { describe, expect, it } from "vitest";

import { heightToColor } from "../../src/components/HeightMapViewer";

describe("heightToColor", () => {
  it("returns distinct colors for low and high heights", () => {
    const low = heightToColor(0);
    const high = heightToColor(1);

    expect(low).not.toEqual(high);
  });
});
