# Task 2 Report: Single-user Auth.js credentials

## Status

Completed Task 2 only. No Task 3+ work was implemented.

## Requirements implemented

- Added `scripts/ensure-user.ts` to upsert the single garden owner from `GARDEN_USER_EMAIL` and `GARDEN_USER_PASSWORD`.
- Added `tests/auth/credentials.test.ts` covering user upsert plus valid and invalid credential checks.
- Added `src/lib/auth-credentials.ts` to isolate the real credential verification logic from the Next runtime wrapper.
- Added `src/lib/auth.ts` exporting `handlers`, `auth`, `signIn`, and `signOut` via Auth.js v5 Credentials with JWT sessions and `/login` as the sign-in page.
- Added `src/app/api/auth/[...nextauth]/route.ts` wiring Auth.js handlers into App Router.
- Added `src/app/login/page.tsx` with an email/password form that calls `signIn("credentials", ...)` through a server action.
- Added `src/middleware.ts` protecting `/upload`, `/garden`, `/api/uploads`, and `/api/scans`.
- Updated `vitest.config.ts` to resolve the existing `@/` alias during tests.

## TDD evidence

### RED

Created `tests/auth/credentials.test.ts` before implementing the auth files.

Ran:

`npx vitest run tests/auth/credentials.test.ts`

Observed result:

- Exit code: `1`
- Failure: `Cannot find module '/scripts/ensure-user' imported from /workspace/tests/auth/credentials.test.ts`

After extending the spec to cover credential authorization, ran the same command again and observed the same missing-module failure across all three tests, confirming the test suite was exercising the intended missing behavior.

### GREEN

Implemented `scripts/ensure-user.ts`, the credential verification helper, and the Auth.js wiring.

Ran:

`npx vitest run tests/auth/credentials.test.ts`

Observed result:

- Exit code: `0`
- `1` test file passed
- `3` tests passed

## Debugging during verification

Two verification failures were reproduced and fixed before completion:

1. Importing `src/lib/auth.ts` directly in Vitest pulled in `next-auth`, which failed to resolve `next/server` in the test runner.
   - Resolution: moved the real credential verification logic into `src/lib/auth-credentials.ts` so tests exercise the auth behavior without coupling to the Next runtime wrapper.
2. `next build` failed TypeScript because Auth.js passes `unknown` credential values to `authorize`.
   - Resolution: kept `authorizeGardenUser()` narrowly typed and added a small normalization wrapper inside `src/lib/auth.ts` before delegating to it.

## Additional verification

Ran:

- `npx vitest run tests/auth/credentials.test.ts`
- `npx vitest run tests/smoke.test.ts tests/auth/credentials.test.ts`
- `npm run build`
- `git diff --check`

Observed result:

- Focused auth tests passed
- Smoke plus auth tests passed (`4` tests total)
- Production build passed successfully
- Diff check reported no whitespace issues

## Notes and concerns

- `next build` emits a Next.js 16 warning that `middleware.ts` is deprecated in favor of `proxy.ts`. I left `src/middleware.ts` in place because the brief explicitly requires that file for Task 2.

## Files added or changed

- `.superpowers/sdd/task-2-report.md`
- `scripts/ensure-user.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/login/page.tsx`
- `src/lib/auth-credentials.ts`
- `src/lib/auth.ts`
- `src/middleware.ts`
- `tests/auth/credentials.test.ts`
- `vitest.config.ts`

## Commit

Planned brief commit message:

`feat: add single-user credentials auth`
