# Task 10 Report: Desktop HeightMapViewer + garden page

**Status:** Complete  
**Branch:** `cursor/garden-ar-v1-design-8020`  
**Date:** 2026-07-21

## Summary

Implemented the desktop garden viewer flow:

- `HeightMapViewer` exports `heightToColor()` for tests, loads heightmap and boundary assets, tints height pixels, dims cells outside the baked boundary mask, and supports wheel zoom plus drag pan on a canvas.
- `VersionList` renders garden scan history newest-first, preserves the selected scan in the `/garden?scanId=...` URL, labels each version by status, and marks the latest ready scan as `Current`.
- `/garden` now authenticates with `auth()`, ensures the user has a garden via `getOrCreateGarden()`, loads scan versions from Prisma, defaults selection to `latestReadyScan()`, and shows an empty state that links to `/upload`.

## Files created

| File | Purpose |
|------|---------|
| `src/components/HeightMapViewer.tsx` | Canvas renderer, pan/zoom interactions, legend, exported `heightToColor()` |
| `src/components/VersionList.tsx` | Scan version history with selection links and current badge |
| `src/app/garden/page.tsx` | Authenticated desktop garden page and empty-state flow |
| `tests/components/height-color.test.ts` | TDD coverage for `heightToColor()` |

## TDD cycle

### Step 1 - RED

Created `tests/components/height-color.test.ts` and ran:

```bash
npx vitest run tests/components/height-color.test.ts
```

**Result:** FAIL - missing `src/components/HeightMapViewer` / `heightToColor`.

### Step 2 - GREEN

Implemented the viewer, page, and helper export, then re-ran:

```bash
npx vitest run tests/components/height-color.test.ts
```

**Result:** PASS - 1 file, 1 test.

### Step 3 - Verification

```bash
npx vitest run tests/components/height-color.test.ts tests/components/scan-status.test.ts tests/lib/garden.test.ts tests/api/assets.test.ts
npx tsc --noEmit
npm run build
```

**Result:** Focused suites pass: 4 files, 5 tests. TypeScript check passes. Production build passes and emits `/garden`.

## Notes / concerns

- Manual browser walkthrough was not run in this subagent session; verification is from focused tests, typecheck, and production build output.
- `next build` still reports the pre-existing middleware deprecation and NFT tracing warnings outside Task 10 scope.
