# Task 7 Report: Upload API

**Status:** Complete  
**Branch:** `cursor/garden-ar-v1-design-8020`  
**Date:** 2026-07-21

## Summary

Implemented upload persistence and scan lookup for the authenticated garden owner:

- `handleUpload()` validates upload type and size, creates a `processing` `ScanVersion`, writes the raw upload under `storage/gardens/{gardenId}/{scanId}/raw{ext}`, and can optionally kick off `runBake()`.
- `POST /api/uploads` authenticates the caller, parses multipart `file`, persists the upload, and uses Next.js `after()` to schedule `runBake(scanId)` after the response is sent.
- `GET /api/scans/[id]` returns only safe scan fields plus asset-presence booleans, and only when the scan belongs to the authenticated user’s garden.

## Files created

| File | Purpose |
|------|---------|
| `src/lib/api/uploads-handler.ts` | Upload validation, raw-file persistence, scan row creation, optional bake kickoff |
| `src/app/api/uploads/route.ts` | Authenticated multipart upload endpoint that schedules async bake with `after()` |
| `src/app/api/scans/[id]/route.ts` | Owner-scoped scan lookup endpoint with safe JSON payload |
| `tests/api/uploads.test.ts` | TDD coverage for handler behavior and route auth/ownership/form parsing |

## TDD cycle

### Step 1 - RED

Created `tests/api/uploads.test.ts` first and ran:

```bash
npx vitest run tests/api/uploads.test.ts
```

**Result:** FAIL - missing Task 7 modules (`src/app/api/scans/[id]/route`, `src/app/api/uploads/route`, `src/lib/api/uploads-handler`).

### Step 2 - GREEN

Implemented the handler and both routes, then re-ran:

```bash
npx vitest run tests/api/uploads.test.ts
```

**First result:** FAIL - Vitest mock hoisting error (`Cannot access 'authMock' before initialization`).

**Fix:** Switched the mocked `auth()` and `after()` spies to `vi.hoisted(...)`, then re-ran:

```bash
npx vitest run tests/api/uploads.test.ts
```

**Result:** PASS - 1 file, 7 tests.

### Step 3 - Verification

```bash
npx tsc --noEmit
npx vitest run tests/api/uploads.test.ts tests/bake/run-bake.test.ts tests/lib/garden.test.ts
```

**Result:** TypeScript check passes. Focused upload/bake/garden suite passes: 3 files, 10 tests.

## Notes / concerns

- Task 8+ remains unimplemented.

## Review follow-up fixes

- `src/lib/auth.ts` now configures JWT/session callbacks so `session.user.id` is populated from the authenticated user id, and both upload/scan routes now read that value directly through `getSessionUserId()`.
- `src/lib/api/uploads-handler.ts` now marks the scan `failed`, stores a truncated `failureReason`, and best-effort removes the raw file when persistence fails after the `ScanVersion` row already exists.
- Added focused regression coverage for the Auth.js callbacks and for the raw-write failure path that previously left scans stuck in `processing`.

## Fresh verification

```bash
npx tsc --noEmit
npx vitest run tests/api/uploads.test.ts tests/auth/credentials.test.ts
```

**Result:** PASS - typecheck clean; 2 test files, 12 tests passed.
