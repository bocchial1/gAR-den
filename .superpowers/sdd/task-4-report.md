# Task 4 Report: Pure heightmap bake (TDD core)

**Status:** Complete  
**Branch:** `cursor/garden-ar-v1-design-8020`  
**Date:** 2026-07-21

## Summary

Implemented a pure orthographic heightmap baker with no file I/O, plus the shared `MeshGeometry` type, following TDD (red -> green -> verify).

## Files created

| File | Purpose |
|------|---------|
| `src/lib/mesh/types.ts` | Shared `MeshGeometry` interface for indexed or non-indexed triangle meshes |
| `src/lib/bake/heightmap.ts` | `bakeHeightmap()` pure rasterization logic and `BakeResult` metadata |
| `tests/bake/heightmap.test.ts` | Focused vitest coverage for relative heights, coverage mask, extents, defaults, and non-indexed meshes |

## TDD cycle

### Step 1 - RED

Created `tests/bake/heightmap.test.ts` first and ran:

```bash
npx vitest run tests/bake/heightmap.test.ts
```

**Result:** FAIL - `Cannot find module '../../src/lib/bake/heightmap'` (expected: feature missing).

### Step 2 - GREEN

Implemented `src/lib/mesh/types.ts` and `src/lib/bake/heightmap.ts`, then re-ran:

```bash
npx vitest run tests/bake/heightmap.test.ts
```

**Result:** PASS - 5 tests.

### Step 3 - Verification

```bash
npx tsc --noEmit
npm test
```

**Result:** TypeScript check passes. Full suite passes: 4 test files, 10 tests.

## API surface

### `src/lib/mesh/types.ts`

- `MeshGeometry { positions: Float32Array; indices?: Uint32Array }`

### `src/lib/bake/heightmap.ts`

- `bakeHeightmap(mesh, resolution = 256)` returns:
  - `heightmap: Float32Array`
  - `boundary: Uint8Array`
  - `cols`, `rows`
  - `minZ`, `maxZ`
  - `widthMeters`, `heightMeters`
  - `originX`, `originY`

## Notes / concerns

- Heights are normalized relative to the mesh-wide minimum vertex Z, while `minZ` and `maxZ` preserve the original absolute vertical range for metadata.
- Triangle coverage uses XY point sampling at cell centers and keeps the maximum sampled Z per covered cell, which matches the pure bake requirements for this task.

## Out of scope

Tasks 5+ not implemented.
