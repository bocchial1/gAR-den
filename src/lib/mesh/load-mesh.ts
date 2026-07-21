import AdmZip from "adm-zip";
import { BufferUtils, NodeIO, Primitive, type JSONDocument } from "@gltf-transform/core";
import OBJFile from "obj-file-parser";
import path from "node:path";

import type { MeshGeometry } from "./types";

export class UnsupportedMeshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMeshError";
  }
}

export async function loadMeshFromUpload(
  buf: Buffer,
  filename: string,
): Promise<MeshGeometry> {
  const extension = path.extname(filename).toLowerCase();

  switch (extension) {
    case ".glb":
      return loadGltfDocument(await new NodeIO().readBinary(toUint8Array(buf)));
    case ".gltf":
      return loadGltfDocument(await new NodeIO().readJSON(parseStandaloneGltf(buf)));
    case ".obj":
      return loadObj(buf.toString("utf8"));
    case ".zip":
      return loadZip(buf);
    default:
      throw new UnsupportedMeshError(`Unsupported mesh upload type: ${filename}`);
  }
}

async function loadZip(buf: Buffer) {
  const entry = new AdmZip(buf)
    .getEntries()
    .find((candidate) => {
      if (candidate.isDirectory) {
        return false;
      }

      const extension = path.extname(candidate.entryName).toLowerCase();
      return extension === ".glb" || extension === ".gltf" || extension === ".obj";
    });

  if (!entry) {
    throw new UnsupportedMeshError("Zip upload does not contain a supported mesh file");
  }

  return loadMeshFromUpload(entry.getData(), entry.entryName);
}

function loadObj(source: string): MeshGeometry {
  const parsed = new OBJFile(source).parse();
  const positions: number[] = [];
  const indices: number[] = [];

  for (const model of parsed.models) {
    const vertexOffset = positions.length / 3;

    for (const vertex of model.vertices) {
      positions.push(vertex.x, vertex.y, vertex.z);
    }

    for (const face of model.faces) {
      if (face.vertices.length < 3) {
        continue;
      }

      const firstIndex = vertexOffset + face.vertices[0].vertexIndex - 1;
      for (let index = 1; index < face.vertices.length - 1; index += 1) {
        indices.push(
          firstIndex,
          vertexOffset + face.vertices[index].vertexIndex - 1,
          vertexOffset + face.vertices[index + 1].vertexIndex - 1,
        );
      }
    }
  }

  return createMeshGeometry(positions, indices);
}

function loadGltfDocument(document: Awaited<ReturnType<NodeIO["readBinary"]>>): MeshGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== Primitive.Mode.TRIANGLES) {
        continue;
      }

      const positionAccessor = primitive.getAttribute("POSITION");
      if (!positionAccessor || positionAccessor.getElementSize() !== 3) {
        continue;
      }

      const positionArray = positionAccessor.getArray();
      if (!positionArray) {
        continue;
      }

      const vertexOffset = positions.length / 3;
      positions.push(...Array.from(positionArray));

      const indexAccessor = primitive.getIndices();
      if (indexAccessor?.getArray()) {
        indices.push(
          ...Array.from(indexAccessor.getArray()!, (value) => Number(value) + vertexOffset),
        );
      } else {
        for (let index = 0; index < positionAccessor.getCount(); index += 1) {
          indices.push(vertexOffset + index);
        }
      }
    }
  }

  return createMeshGeometry(positions, indices);
}

function parseStandaloneGltf(buf: Buffer): JSONDocument {
  const json = JSON.parse(buf.toString("utf8")) as JSONDocument["json"] & {
    buffers?: Array<{ uri?: string }>;
  };
  const resources: JSONDocument["resources"] = {};

  for (const buffer of json.buffers ?? []) {
    if (!buffer.uri) {
      continue;
    }

    if (!buffer.uri.startsWith("data:")) {
      throw new UnsupportedMeshError("GLTF uploads must embed buffer data");
    }

    resources[buffer.uri] = BufferUtils.createBufferFromDataURI(buffer.uri);
  }

  return { json, resources };
}

function createMeshGeometry(positions: number[], indices: number[]): MeshGeometry {
  if (positions.length === 0 || indices.length === 0) {
    throw new UnsupportedMeshError("Mesh upload does not contain triangle geometry");
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function toUint8Array(buf: Buffer) {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
