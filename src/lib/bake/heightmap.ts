import type { MeshGeometry } from "../mesh/types";

export interface BakeResult {
  heightmap: Float32Array;
  boundary: Uint8Array;
  cols: number;
  rows: number;
  minZ: number;
  maxZ: number;
  widthMeters: number;
  heightMeters: number;
  originX: number;
  originY: number;
}

const EPSILON = 1e-8;

export function bakeHeightmap(mesh: MeshGeometry, resolution = 256): BakeResult {
  if (mesh.positions.length === 0 || mesh.positions.length % 3 !== 0) {
    throw new Error("Mesh positions must contain xyz triples");
  }

  if (!mesh.indices && mesh.positions.length % 9 !== 0) {
    throw new Error("Non-indexed meshes must contain whole triangles");
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let index = 0; index < mesh.positions.length; index += 3) {
    const x = mesh.positions[index];
    const y = mesh.positions[index + 1];
    const z = mesh.positions[index + 2];

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  const cols = Math.max(1, Math.round(resolution));
  const widthMeters = maxX - minX;
  const heightMeters = maxY - minY;
  const rows =
    widthMeters > 0
      ? Math.max(1, Math.round(cols * (heightMeters / widthMeters)))
      : cols;
  const cellCount = cols * rows;
  const heightmap = new Float32Array(cellCount).fill(Number.NaN);
  const boundary = new Uint8Array(cellCount);

  const rasterizeTriangle = (aIndex: number, bIndex: number, cIndex: number) => {
    const ax = mesh.positions[aIndex * 3];
    const ay = mesh.positions[aIndex * 3 + 1];
    const az = mesh.positions[aIndex * 3 + 2];
    const bx = mesh.positions[bIndex * 3];
    const by = mesh.positions[bIndex * 3 + 1];
    const bz = mesh.positions[bIndex * 3 + 2];
    const cx = mesh.positions[cIndex * 3];
    const cy = mesh.positions[cIndex * 3 + 1];
    const cz = mesh.positions[cIndex * 3 + 2];

    const area = orient(ax, ay, bx, by, cx, cy);
    if (Math.abs(area) <= EPSILON) {
      return;
    }

    const triangleMinX = Math.min(ax, bx, cx);
    const triangleMaxX = Math.max(ax, bx, cx);
    const triangleMinY = Math.min(ay, by, cy);
    const triangleMaxY = Math.max(ay, by, cy);

    const minCol = clamp(toGridStart(triangleMinX, minX, widthMeters, cols), 0, cols - 1);
    const maxCol = clamp(toGridEnd(triangleMaxX, minX, widthMeters, cols), 0, cols - 1);
    const minRow = clamp(toGridStart(triangleMinY, minY, heightMeters, rows), 0, rows - 1);
    const maxRow = clamp(toGridEnd(triangleMaxY, minY, heightMeters, rows), 0, rows - 1);

    for (let row = minRow; row <= maxRow; row += 1) {
      const y = sampleCenter(row, rows, minY, heightMeters);
      for (let col = minCol; col <= maxCol; col += 1) {
        const x = sampleCenter(col, cols, minX, widthMeters);
        const u = orient(bx, by, cx, cy, x, y) / area;
        const v = orient(cx, cy, ax, ay, x, y) / area;
        const w = orient(ax, ay, bx, by, x, y) / area;

        if (u < -EPSILON || v < -EPSILON || w < -EPSILON) {
          continue;
        }

        const z = u * az + v * bz + w * cz;
        const cellIndex = row * cols + col;

        if (!boundary[cellIndex] || z > heightmap[cellIndex]) {
          heightmap[cellIndex] = z;
          boundary[cellIndex] = 1;
        }
      }
    }
  };

  if (mesh.indices) {
    for (let index = 0; index < mesh.indices.length; index += 3) {
      rasterizeTriangle(mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]);
    }
  } else {
    for (let index = 0; index < mesh.positions.length / 3; index += 3) {
      rasterizeTriangle(index, index + 1, index + 2);
    }
  }

  for (let index = 0; index < cellCount; index += 1) {
    if (boundary[index]) {
      heightmap[index] -= minZ;
    }
  }

  return {
    heightmap,
    boundary,
    cols,
    rows,
    minZ,
    maxZ,
    widthMeters,
    heightMeters,
    originX: minX,
    originY: minY,
  };
}

function orient(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function sampleCenter(index: number, size: number, origin: number, span: number) {
  if (span <= 0) {
    return origin;
  }

  return origin + ((index + 0.5) / size) * span;
}

function toGridStart(value: number, origin: number, span: number, size: number) {
  if (span <= 0) {
    return 0;
  }

  return Math.floor(((value - origin) / span) * size);
}

function toGridEnd(value: number, origin: number, span: number, size: number) {
  if (span <= 0) {
    return 0;
  }

  return Math.ceil(((value - origin) / span) * size) - 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
