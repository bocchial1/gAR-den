import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { bakeHeightmap } from "../../src/lib/bake/heightmap";
import { loadMeshFromUpload } from "../../src/lib/mesh/load-mesh";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/tiny-slab.glb",
);

const slabObj = `
v 0 0 2
v 1 0 2
v 1 1 2
v 0 1 2
f 1 2 3
f 1 3 4
`.trim();

describe("loadMeshFromUpload", () => {
  it("loads a glb fixture and produces bakeable geometry", async () => {
    const mesh = await loadMeshFromUpload(fs.readFileSync(fixturePath), "tiny-slab.glb");

    expect(mesh.positions.length).toBeGreaterThan(0);

    const baked = bakeHeightmap(mesh, 16);
    expect([...baked.boundary].some((value) => value === 1)).toBe(true);
  });

  it("loads obj uploads into indexed geometry", async () => {
    const mesh = await loadMeshFromUpload(Buffer.from(slabObj), "tiny-slab.obj");

    expect(Array.from(mesh.positions)).toEqual([
      0, 0, 2,
      1, 0, 2,
      1, 1, 2,
      0, 1, 2,
    ]);
    expect(Array.from(mesh.indices ?? [])).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it("loads the first supported mesh file from zip uploads", async () => {
    const zip = new AdmZip();
    zip.addFile("README.txt", Buffer.from("ignore me"));
    zip.addFile("nested/tiny-slab.glb", fs.readFileSync(fixturePath));

    const mesh = await loadMeshFromUpload(zip.toBuffer(), "bundle.zip");

    expect(mesh.positions.length).toBeGreaterThan(0);
  });

  it("rejects unsupported extensions", async () => {
    await expect(loadMeshFromUpload(Buffer.from("nope"), "scan.pdf")).rejects.toThrow(
      /unsupported/i,
    );
  });

  it("rejects zip uploads with no supported mesh files", async () => {
    const zip = new AdmZip();
    zip.addFile("README.txt", Buffer.from("still nothing"));

    await expect(loadMeshFromUpload(zip.toBuffer(), "empty.zip")).rejects.toThrow(
      /unsupported|mesh/i,
    );
  });
});
