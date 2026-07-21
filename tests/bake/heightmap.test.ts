import { describe, expect, it } from "vitest";

import { bakeHeightmap } from "../../src/lib/bake/heightmap";

function slabMesh() {
  const positions = new Float32Array([
    0, 0, 2,
    1, 0, 2,
    1, 1, 2,
    0, 1, 2,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

  return { positions, indices };
}

function rectangularMesh() {
  const positions = new Float32Array([
    0, 0, 3,
    2, 0, 3,
    2, 1, 3,
    0, 1, 3,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

  return { positions, indices };
}

function nonIndexedTriangleMesh() {
  return {
    positions: new Float32Array([
      0, 0, 0,
      1, 0, 1,
      0, 1, 2,
    ]),
  };
}

describe("bakeHeightmap", () => {
  it("sets relative heights with minZ as zero", () => {
    const result = bakeHeightmap(slabMesh(), 32);

    expect(result.minZ).toBeCloseTo(2, 5);
    expect(result.maxZ).toBeCloseTo(2, 5);

    const covered = [...result.heightmap].filter((value) => !Number.isNaN(value));
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((value) => Math.abs(value - 0) < 1e-5)).toBe(true);
  });

  it("marks boundary only where geometry exists", () => {
    const result = bakeHeightmap(nonIndexedTriangleMesh(), 32);

    const ones = [...result.boundary].filter((value) => value === 1).length;
    const zeros = [...result.boundary].filter((value) => value === 0).length;

    expect(ones).toBeGreaterThan(0);
    expect(zeros).toBeGreaterThan(0);
  });

  it("reports XY extent in meters", () => {
    const result = bakeHeightmap(slabMesh(), 32);

    expect(result.widthMeters).toBeCloseTo(1, 5);
    expect(result.heightMeters).toBeCloseTo(1, 5);
  });

  it("uses the default resolution and scales rows to the XY aspect ratio", () => {
    const result = bakeHeightmap(rectangularMesh());

    expect(result.cols).toBe(256);
    expect(result.rows).toBe(128);
  });

  it("treats triangle edges as covered at low resolution", () => {
    const result = bakeHeightmap(slabMesh(), 1);

    expect(result.cols).toBe(1);
    expect(result.rows).toBe(1);
    expect(result.boundary[0]).toBe(1);
    expect(result.heightmap[0]).toBeCloseTo(0, 5);
  });

  it("supports non-indexed triangle meshes", () => {
    const result = bakeHeightmap(nonIndexedTriangleMesh(), 32);
    const covered = [...result.heightmap].filter((value) => !Number.isNaN(value));

    expect(result.minZ).toBeCloseTo(0, 5);
    expect(result.maxZ).toBeCloseTo(2, 5);
    expect(covered.length).toBeGreaterThan(0);
  });
});
