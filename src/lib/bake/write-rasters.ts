import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import type { BakeResult } from "./heightmap";

export interface RasterPaths {
  heightmapPath: string;
  boundaryPath: string;
  previewPath: string;
}

export async function writeRasters(dir: string, result: BakeResult): Promise<RasterPaths> {
  await fs.mkdir(dir, { recursive: true });

  const heightmapPath = path.join(dir, "heightmap.png");
  const boundaryPath = path.join(dir, "boundary.png");
  const previewPath = path.join(dir, "preview.png");
  const cellCount = result.cols * result.rows;
  const maxRelativeHeight = maxFiniteHeight(result.heightmap);

  const heightmap = new Uint8Array(cellCount);
  const boundary = new Uint8Array(cellCount);
  const preview = new Uint8Array(cellCount * 3);

  for (let index = 0; index < cellCount; index += 1) {
    const height = result.heightmap[index];
    const covered = result.boundary[index] === 1 && Number.isFinite(height);
    const normalized = covered ? normalize(height, maxRelativeHeight) : 0;

    // Sharp's straightforward PNG path in this repo reliably produces 8-bit output, so
    // we normalize the relative heights into 0..255 and rely on boundary.png to distinguish
    // uncovered cells from covered zero-height cells.
    heightmap[index] = Math.round(normalized * 255);
    boundary[index] = covered ? 255 : 0;

    const offset = index * 3;
    const [r, g, b] = covered ? previewColor(normalized) : [0, 0, 0];
    preview[offset] = r;
    preview[offset + 1] = g;
    preview[offset + 2] = b;
  }

  await sharp(Buffer.from(heightmap.buffer), {
    raw: {
      width: result.cols,
      height: result.rows,
      channels: 1,
    },
  })
    .png()
    .toFile(heightmapPath);

  await sharp(boundary, {
    raw: {
      width: result.cols,
      height: result.rows,
      channels: 1,
    },
  })
    .png()
    .toFile(boundaryPath);

  await sharp(preview, {
    raw: {
      width: result.cols,
      height: result.rows,
      channels: 3,
    },
  })
    .png()
    .toFile(previewPath);

  return { heightmapPath, boundaryPath, previewPath };
}

function normalize(value: number, maxValue: number) {
  if (maxValue <= 0) {
    return 0;
  }

  return clamp(value / maxValue, 0, 1);
}

function maxFiniteHeight(heightmap: Float32Array) {
  let maxValue = 0;

  for (const value of heightmap) {
    if (Number.isFinite(value) && value > maxValue) {
      maxValue = value;
    }
  }

  return maxValue;
}

function previewColor(normalized: number): [number, number, number] {
  const stops: Array<[number, number, number]> = [
    [32, 74, 135],
    [42, 157, 143],
    [233, 196, 106],
  ];
  const scaled = normalized * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const mix = scaled - lowerIndex;
  const lower = stops[lowerIndex];
  const upper = stops[upperIndex];

  return [
    Math.round(lower[0] + (upper[0] - lower[0]) * mix),
    Math.round(lower[1] + (upper[1] - lower[1]) * mix),
    Math.round(lower[2] + (upper[2] - lower[2]) * mix),
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
