declare module "obj-file-parser" {
  export interface ObjFaceVertex {
    vertexIndex: number;
    textureCoordsIndex: number;
    vertexNormalIndex: number;
  }

  export interface ObjFace {
    material: string;
    group: string;
    smoothingGroup: number;
    vertices: ObjFaceVertex[];
  }

  export interface ObjVertex {
    x: number;
    y: number;
    z: number;
  }

  export interface ObjModel {
    name: string;
    vertices: ObjVertex[];
    faces: ObjFace[];
  }

  export interface ObjParseResult {
    models: ObjModel[];
    materialLibraries: string[];
  }

  export default class OBJFile {
    constructor(fileContents: string, defaultModelName?: string);
    parse(): ObjParseResult;
  }
}
