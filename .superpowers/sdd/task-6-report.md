# Task 6 Report: Write rasters + runBake job

**Status:** Complete  
**Branch:** `cursor/garden-ar-v1-design-8020`  
**Date:** 2026-07-21

## Summary

Implemented `writeRasters(dir, result)` and `runBake(scanId)` so a processing scan can load its uploaded mesh, bake a 512px heightmap, write `heightmap.png`, `boundary.png`, and `preview.png`, then persist raster paths plus scan extents back onto `ScanVersion`.

## Files created

| File | Purpose |
|------|---------|
| `src/lib/bake/write-rasters.ts` | Writes normalized heightmap, boundary mask, and preview rasters with `sharp` |
| `src/lib/bake/run-bake.ts` | Runs the bake pipeline for one `ScanVersion` and updates status/metadata |
| `tests/bake/run-bake.test.ts` | TDD coverage for successful bake output and failed-bake isolation |

## TDD cycle

### Step 1 - RED

Created `tests/bake/run-bake.test.ts` first and ran:

```bash
npx vitest run tests/bake/run-bake.test.ts
```

**Result:** FAIL - `Cannot find module '/src/lib/bake/run-bake'` (expected: Task 6 implementation missing).

### Step 2 - GREEN

Implemented `src/lib/bake/write-rasters.ts` and `src/lib/bake/run-bake.ts`, then re-ran the same test.

**First result:** FAIL - happy path stored `failureReason = "Maximum call stack size exceeded"`.

**Root cause:** `writeRasters()` tried to compute max height with a spread over the full 512x512 typed array, which overflowed the call stack.

**Fix:** Replaced the spread with a linear scan helper and re-ran:

```bash
npx vitest run tests/bake/run-bake.test.ts
```

**Result:** PASS - 2 tests.

### Step 3 - Verification

```bash
npx tsc --noEmit
npx vitest run tests/bake/heightmap.test.ts tests/bake/load-mesh.test.ts tests/bake/run-bake.test.ts
```

**Result:** TypeScript check passes. Focused bake suite passes: 3 files, 13 tests.

## Notes / concerns

- The brief preferred a 16-bit heightmap if practical, but the straightforward `sharp` pipeline in this repo consistently produced 8-bit PNG output. The implementation now documents and intentionally uses the allowed 8-bit fallback.
- `boundary.png` remains the authoritative coverage mask for distinguishing uncovered cells from covered zero-height cells.

## Out of scope

Task 7+ not implemented.
