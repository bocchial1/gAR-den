# gAR-den v1 Capture Ingest & Height Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a personal web app that accepts Polycam (or similar) LiDAR mesh exports, bakes orthographic heightmaps server-side, and shows a view-only 2D top-down living map with version history.

**Architecture:** One Next.js app serves mobile upload + desktop map. Prisma/SQLite stores gardens and scan versions. Uploaded meshes land on local disk; an async bake job writes heightmap, boundary, and preview rasters. Auth is single-user credentials from env vars.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Prisma, SQLite, Auth.js (NextAuth v5) Credentials, Vitest, `sharp`, `@gltf-transform/core` + `obj-file-parser` for mesh load, Canvas 2D map viewer.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-garden-ar-capture-map-design.md`
- No custom iOS capture app; external LiDAR app only
- Accepted uploads: `.glb`, `.gltf`, `.obj`, `.zip` containing those
- Heights relative to **minimum Z** in the scan (lowest point = 0)
- Local meters; no GPS georeferencing
- One garden in v1; auto-selected
- Latest **ready** version is current; failed versions never become current
- Mobile: upload + status + preview only; Desktop: full 2D map + versions
- View-only map (no markup/journal/classify/plans)
- Max upload size: **50 MB**
- Single-user auth; no sharing
- TDD: write failing test → implement → pass → commit per task
- Frequent commits after each task

---

## File Structure

```
apps/web/                          # Next.js app (repo root may be the app; use root if simpler)
  prisma/
    schema.prisma                  # User, Garden, ScanVersion
  storage/                         # gitignored: raw + derived assets
  src/
    lib/
      auth.ts                      # Auth.js config (credentials)
      db.ts                        # Prisma client singleton
      storage.ts                   # read/write paths under storage/
      mesh/
        load-mesh.ts               # glTF/OBJ/zip → MeshGeometry
        types.ts                   # MeshGeometry type
      bake/
        heightmap.ts               # orthographic bake (pure)
        write-rasters.ts           # PNG writes via sharp
        run-bake.ts                # job: load → bake → update DB
      garden.ts                    # getOrCreateGarden, latestReadyVersion
    app/
      api/auth/[...nextauth]/route.ts
      api/uploads/route.ts         # POST multipart upload
      api/scans/[id]/route.ts     # GET status/metadata
      api/scans/[id]/assets/[kind]/route.ts  # heightmap|boundary|preview|raw
      login/page.tsx
      upload/page.tsx              # mobile-friendly upload
      garden/page.tsx              # desktop map + versions
      page.tsx                     # redirect by viewport intent / auth
    components/
      HeightMapViewer.tsx          # canvas pan/zoom + color scale
      VersionList.tsx
      UploadForm.tsx
      ScanStatus.tsx
  tests/
    bake/heightmap.test.ts
    bake/run-bake.test.ts
    api/uploads.test.ts
    fixtures/tiny-slab.glb         # tiny synthetic mesh fixture
  .env.example
  package.json
  vitest.config.ts
```

If scaffolding places the Next app at repo root instead of `apps/web/`, keep the same relative paths under that root and update imports accordingly — do **not** invent a monorepo unless needed.

---

### Task 1: Scaffold app, Vitest, and Prisma schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind` config, `postcss.config.mjs`, `vitest.config.ts`, `prisma/schema.prisma`, `src/lib/db.ts`, `.env.example`, `.gitignore` entries for `storage/`, `.env`, `*.db`
- Create: `tests/smoke.test.ts`
- Modify: `README.md` (run instructions)

**Interfaces:**
- Consumes: none
- Produces: Prisma models `User`, `Garden`, `ScanVersion`; `getPrisma()` from `src/lib/db.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("exports a prisma getter", async () => {
    const { getPrisma } = await import("../src/lib/db");
    expect(typeof getPrisma).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/smoke.test.ts`
Expected: FAIL (cannot resolve `../src/lib/db` or app not scaffolded)

- [ ] **Step 3: Scaffold Next.js + deps and implement schema**

Create the Next.js TypeScript app (App Router + Tailwind). Install:

```bash
npm install @prisma/client next-auth@beta bcryptjs sharp adm-zip @gltf-transform/core @gltf-transform/extensions obj-file-parser
npm install -D prisma vitest @vitejs/plugin-react typescript @types/bcryptjs @types/node
```

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  gardens      Garden[]
  createdAt    DateTime @default(now())
}

model Garden {
  id        String        @id @default(cuid())
  name      String        @default("Home garden")
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  scans     ScanVersion[]
  createdAt DateTime      @default(now())
}

model ScanVersion {
  id             String   @id @default(cuid())
  gardenId       String
  garden         Garden   @relation(fields: [gardenId], references: [id])
  status         String   // processing | ready | failed
  failureReason  String?
  sourceFilename String?
  rawPath        String?
  heightmapPath  String?
  boundaryPath   String?
  previewPath    String?
  minZ           Float?
  maxZ           Float?
  widthMeters    Float?
  heightMeters   Float?
  createdAt      DateTime @default(now())
}
```

`src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
```

`.env.example`:

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-me"
GARDEN_USER_EMAIL="you@example.com"
GARDEN_USER_PASSWORD="replace-me"
STORAGE_ROOT="./storage"
```

Update `.gitignore` to include `storage/`, `.env`, `prisma/*.db`, `*.db`.

- [ ] **Step 4: Migrate and run smoke test**

```bash
npx prisma migrate dev --name init
npx vitest run tests/smoke.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Prisma ScanVersion schema"
```

---

### Task 2: Single-user Auth.js credentials

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`, `src/middleware.ts`
- Create: `scripts/ensure-user.ts`
- Test: `tests/auth/credentials.test.ts`

**Interfaces:**
- Consumes: `getPrisma()`, env `GARDEN_USER_EMAIL`, `GARDEN_USER_PASSWORD`, `AUTH_SECRET`
- Produces: `auth`, `handlers`, `signIn`, `signOut` from `src/lib/auth.ts`; middleware protects `/upload`, `/garden`, `/api/uploads`, `/api/scans`

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth/credentials.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { getPrisma } from "../../src/lib/db";

describe("ensure user", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
  });

  it("upserts the single user from env", async () => {
    const { ensureGardenUser } = await import("../../scripts/ensure-user");
    await ensureGardenUser();
    const user = await getPrisma().user.findUnique({
      where: { email: "test@garden.local" },
    });
    expect(user).toBeTruthy();
    expect(bcrypt.compareSync("test-password", user!.passwordHash)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/credentials.test.ts`
Expected: FAIL (module or function missing)

- [ ] **Step 3: Implement ensure-user + Auth.js**

`scripts/ensure-user.ts`:

```ts
import bcrypt from "bcryptjs";
import { getPrisma } from "../src/lib/db";

export async function ensureGardenUser(): Promise<void> {
  const email = process.env.GARDEN_USER_EMAIL;
  const password = process.env.GARDEN_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("GARDEN_USER_EMAIL and GARDEN_USER_PASSWORD are required");
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  await getPrisma().user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
}

if (require.main === module) {
  ensureGardenUser().then(() => process.exit(0));
}
```

`src/lib/auth.ts` — Auth.js v5 Credentials provider that looks up `User` by email and verifies `bcrypt.compare`. Session strategy: JWT. Export `handlers`, `auth`, `signIn`, `signOut`.

Wire `src/app/api/auth/[...nextauth]/route.ts` to `handlers`.

`src/app/login/page.tsx` — email/password form calling `signIn("credentials", …)`.

`src/middleware.ts` — require auth for `/upload`, `/garden`, `/api/uploads`, `/api/scans`; redirect others to login when unauthenticated for those paths.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/auth/credentials.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add single-user credentials auth"
```

---

### Task 3: Storage helpers + garden accessor

**Files:**
- Create: `src/lib/storage.ts`, `src/lib/garden.ts`
- Test: `tests/lib/garden.test.ts`

**Interfaces:**
- Consumes: `getPrisma()`, `STORAGE_ROOT` env
- Produces:
  - `storagePath(...parts: string[]): string`
  - `ensureStorageDir(rel: string): Promise<string>` absolute path created
  - `getOrCreateGarden(userId: string): Promise<Garden>` — returns the single garden, creating `Home garden` if missing
  - `latestReadyScan(gardenId: string): Promise<ScanVersion | null>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/garden.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";

describe("getOrCreateGarden", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    await ensureGardenUser();
  });

  it("creates one garden then reuses it", async () => {
    const { getOrCreateGarden } = await import("../../src/lib/garden");
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const a = await getOrCreateGarden(user.id);
    const b = await getOrCreateGarden(user.id);
    expect(a.id).toBe(b.id);
    expect(a.name).toBe("Home garden");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/garden.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement storage + garden**

```ts
// src/lib/storage.ts
import fs from "node:fs/promises";
import path from "node:path";

export function storageRoot(): string {
  return path.resolve(process.env.STORAGE_ROOT || "./storage");
}

export function storagePath(...parts: string[]): string {
  return path.join(storageRoot(), ...parts);
}

export async function ensureStorageDir(...parts: string[]): Promise<string> {
  const dir = storagePath(...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
```

```ts
// src/lib/garden.ts
import { getPrisma } from "./db";

export async function getOrCreateGarden(userId: string) {
  const existing = await getPrisma().garden.findFirst({ where: { userId } });
  if (existing) return existing;
  return getPrisma().garden.create({
    data: { userId, name: "Home garden" },
  });
}

export async function latestReadyScan(gardenId: string) {
  return getPrisma().scanVersion.findFirst({
    where: { gardenId, status: "ready" },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/garden.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add storage paths and single-garden accessor"
```

---

### Task 4: Pure heightmap bake (TDD core)

**Files:**
- Create: `src/lib/mesh/types.ts`, `src/lib/bake/heightmap.ts`
- Test: `tests/bake/heightmap.test.ts`

**Interfaces:**
- Consumes: `MeshGeometry { positions: Float32Array; indices?: Uint32Array }` — positions are xyz triples
- Produces:
  - `bakeHeightmap(mesh: MeshGeometry, resolution?: number): BakeResult`
  - `BakeResult { heightmap: Float32Array; boundary: Uint8Array; cols: number; rows: number; minZ: number; maxZ: number; widthMeters: number; heightMeters: number; originX: number; originY: number }`
  - Height values are **relative to mesh min Z** (absolute minZ stored separately for metadata)
  - Cells with no geometry: height `NaN`, boundary `0`; covered cells boundary `1`
  - Default `resolution` = 256 (cols); rows scale to aspect of XY AABB

- [ ] **Step 1: Write the failing tests**

```ts
// tests/bake/heightmap.test.ts
import { describe, it, expect } from "vitest";
import { bakeHeightmap } from "../../src/lib/bake/heightmap";

/** Unit square slab at z=1..2 (top face z=2) */
function slabMesh() {
  // two triangles covering x0..1, y0..1 at z=2
  const positions = new Float32Array([
    0, 0, 2, 1, 0, 2, 1, 1, 2, 0, 1, 2,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  return { positions, indices };
}

describe("bakeHeightmap", () => {
  it("sets relative heights with minZ as zero", () => {
    const result = bakeHeightmap(slabMesh(), 32);
    expect(result.minZ).toBeCloseTo(2, 5);
    expect(result.maxZ).toBeCloseTo(2, 5);
    const covered = [...result.heightmap].filter((v) => !Number.isNaN(v));
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((v) => Math.abs(v - 0) < 1e-5)).toBe(true);
  });

  it("marks boundary only where geometry exists", () => {
    const result = bakeHeightmap(slabMesh(), 32);
    const ones = [...result.boundary].filter((b) => b === 1).length;
    const zeros = [...result.boundary].filter((b) => b === 0).length;
    expect(ones).toBeGreaterThan(0);
    expect(zeros).toBeGreaterThan(0);
  });

  it("reports XY extent in meters", () => {
    const result = bakeHeightmap(slabMesh(), 32);
    expect(result.widthMeters).toBeCloseTo(1, 5);
    expect(result.heightMeters).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bake/heightmap.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement bake**

Algorithm:
1. Read all vertex XYZ from `positions` (and index triangles if `indices` present; else non-indexed triples).
2. Compute AABB over vertices.
3. Choose `cols = resolution`, `rows = max(1, round(cols * (aabb.ySize / aabb.xSize)))`.
4. Allocate `heightmap` with `NaN`, `boundary` with `0`.
5. For each triangle, rasterize into grid cells it overlaps (barycentric or bounding-box sample). For each covered cell, keep **maximum absolute Z**.
6. `minZ` / `maxZ` from covered cells’ absolute Z. Subtract `minZ` from each covered height so relative heights start at 0.
7. Return `BakeResult` including `widthMeters = aabb.xSize`, `heightMeters = aabb.ySize`, `originX/Y = aabb.min`.

Keep implementation in `src/lib/bake/heightmap.ts` under ~150 lines; no file I/O here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bake/heightmap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add orthographic heightmap bake"
```

---

### Task 5: Mesh loading (glTF / OBJ / zip)

**Files:**
- Create: `src/lib/mesh/load-mesh.ts`
- Create: `tests/fixtures/generate-fixture.mjs` (or checked-in tiny glb bytes)
- Test: `tests/bake/load-mesh.test.ts`
- Create fixture: `tests/fixtures/tiny-slab.glb`

**Interfaces:**
- Consumes: file `Buffer` + filename
- Produces: `loadMeshFromUpload(buf: Buffer, filename: string): Promise<MeshGeometry>`
  - Supports `.glb`, `.gltf`, `.obj`, `.zip` (finds first mesh file inside)
  - Throws `UnsupportedMeshError` with message for bad types / empty geometry

- [ ] **Step 1: Write the failing test**

Generate a tiny `.glb` fixture (script using `@gltf-transform/core` writing the same unit slab). Then:

```ts
// tests/bake/load-mesh.test.ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadMeshFromUpload } from "../../src/lib/mesh/load-mesh";
import { bakeHeightmap } from "../../src/lib/bake/heightmap";

describe("loadMeshFromUpload", () => {
  it("loads glb fixture and bakes", async () => {
    const buf = fs.readFileSync(
      path.join(__dirname, "../fixtures/tiny-slab.glb"),
    );
    const mesh = await loadMeshFromUpload(buf, "tiny-slab.glb");
    expect(mesh.positions.length).toBeGreaterThan(0);
    const baked = bakeHeightmap(mesh, 16);
    expect([...baked.boundary].some((b) => b === 1)).toBe(true);
  });

  it("rejects unsupported extensions", async () => {
    await expect(
      loadMeshFromUpload(Buffer.from("nope"), "scan.pdf"),
    ).rejects.toThrow(/unsupported/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bake/load-mesh.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement loader + fixture**

- Use `@gltf-transform/core` to read GLB/GLTF and concatenate all mesh primitive POSITION accessors (and indices if present; otherwise expand).
- Use `obj-file-parser` for OBJ vertices/faces → `Float32Array` / `Uint32Array`.
- For zip: `adm-zip`, pick first entry ending in `.glb|.gltf|.obj`, recurse into `loadMeshFromUpload`.
- If no positions, throw.

Commit the generated `tests/fixtures/tiny-slab.glb`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bake/load-mesh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: load glTF/OBJ/zip uploads into mesh geometry"
```

---

### Task 6: Write rasters + runBake job

**Files:**
- Create: `src/lib/bake/write-rasters.ts`, `src/lib/bake/run-bake.ts`
- Test: `tests/bake/run-bake.test.ts`

**Interfaces:**
- Consumes: `loadMeshFromUpload`, `bakeHeightmap`, `storagePath`, `getPrisma`
- Produces:
  - `writeRasters(dir: string, result: BakeResult): Promise<{ heightmapPath; boundaryPath; previewPath }>`
    - `heightmap.png` — 16-bit grayscale relative height (NaN → 0 black; map 0..maxRel → 0..65535)
    - `boundary.png` — 8-bit mask 0/255
    - `preview.png` — 8-bit colorized height (simple viridis-like or blue→yellow ramp) for mobile
  - `runBake(scanId: string): Promise<void>`
    - Loads scan; if missing raw, mark failed
    - On success: set paths, minZ/maxZ/widthMeters/heightMeters, `status: "ready"`
    - On error: `status: "failed"`, `failureReason` truncated to 500 chars
    - Never deletes prior ready scans

- [ ] **Step 1: Write the failing test**

```ts
// tests/bake/run-bake.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";
import { getOrCreateGarden } from "../../src/lib/garden";
import { ensureStorageDir, storagePath } from "../../src/lib/storage";

describe("runBake", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    process.env.STORAGE_ROOT = path.join(process.cwd(), "storage-test");
    await ensureGardenUser();
  });

  it("marks scan ready and writes assets", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const garden = await getOrCreateGarden(user.id);
    const dir = await ensureStorageDir("scans", "test-scan");
    const raw = path.join(dir, "raw.glb");
    fs.copyFileSync(
      path.join(__dirname, "../fixtures/tiny-slab.glb"),
      raw,
    );
    const scan = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "processing",
        rawPath: raw,
        sourceFilename: "tiny-slab.glb",
      },
    });
    const { runBake } = await import("../../src/lib/bake/run-bake");
    await runBake(scan.id);
    const updated = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: scan.id },
    });
    expect(updated.status).toBe("ready");
    expect(updated.heightmapPath && fs.existsSync(updated.heightmapPath)).toBe(
      true,
    );
    expect(updated.boundaryPath && fs.existsSync(updated.boundaryPath)).toBe(
      true,
    );
    expect(updated.previewPath && fs.existsSync(updated.previewPath)).toBe(
      true,
    );
  });

  it("failed bake does not change a prior ready scan", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const garden = await getOrCreateGarden(user.id);
    const ready = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "ready",
        rawPath: "x",
        heightmapPath: "x",
        boundaryPath: "x",
        previewPath: "x",
      },
    });
    const bad = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "processing",
        rawPath: storagePath("missing.glb"),
        sourceFilename: "missing.glb",
      },
    });
    const { runBake } = await import("../../src/lib/bake/run-bake");
    await runBake(bad.id);
    const badUpdated = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: bad.id },
    });
    const readyStill = await getPrisma().scanVersion.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(badUpdated.status).toBe("failed");
    expect(readyStill.status).toBe("ready");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bake/run-bake.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement write-rasters + runBake**

Use `sharp` to write PNGs. Encode heightmap as grayscale PNG (16-bit if practical; 8-bit acceptable if sharp path is simpler — document choice in code comment; prefer 16-bit raw buffer).

`runBake` reads `rawPath` bytes, `loadMeshFromUpload`, `bakeHeightmap(mesh, 512)`, `writeRasters`, updates row.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bake/run-bake.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: bake job writes heightmap boundary preview"
```

---

### Task 7: Upload API

**Files:**
- Create: `src/app/api/uploads/route.ts`, `src/app/api/scans/[id]/route.ts`
- Test: `tests/api/uploads.test.ts`

**Interfaces:**
- Consumes: `auth()`, `getOrCreateGarden`, `ensureStorageDir`, `runBake`
- Produces:
  - `POST /api/uploads` multipart field `file` → `{ scanId: string, status: "processing" }`
  - Rejects if unauthenticated (401), missing file (400), unsupported ext (400), size > 50_000_000 bytes (413)
  - Creates `ScanVersion` `processing`, saves raw under `storage/gardens/{gardenId}/{scanId}/raw{ext}`, then schedules bake with Next.js `after(() => { void runBake(scanId) })` so the HTTP response returns immediately while bake continues
  - `GET /api/scans/[id]` → scan JSON for owner’s garden only (404 otherwise)

- [ ] **Step 1: Write the failing test**

Prefer calling handler functions extracted to `src/lib/api/uploads-handler.ts` so Vitest can invoke without full HTTP:

```ts
// tests/api/uploads.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";
import { handleUpload } from "../../src/lib/api/uploads-handler";

describe("handleUpload", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    process.env.STORAGE_ROOT = path.join(process.cwd(), "storage-test");
    await ensureGardenUser();
  });

  it("creates processing scan then bake makes ready", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const buf = fs.readFileSync(
      path.join(__dirname, "../fixtures/tiny-slab.glb"),
    );
    const result = await handleUpload({
      userId: user.id,
      filename: "tiny-slab.glb",
      bytes: buf,
      startBake: true,
    });
    expect(result.status).toBe("processing");
    // wait for bake
    for (let i = 0; i < 50; i++) {
      const scan = await getPrisma().scanVersion.findUniqueOrThrow({
        where: { id: result.scanId },
      });
      if (scan.status !== "processing") {
        expect(scan.status).toBe("ready");
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("bake did not finish");
  });

  it("rejects oversize", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    await expect(
      handleUpload({
        userId: user.id,
        filename: "big.glb",
        bytes: Buffer.alloc(50_000_001),
        startBake: false,
      }),
    ).rejects.toMatchObject({ status: 413 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/uploads.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement handler + routes**

```ts
// src/lib/api/uploads-handler.ts — validate, persist, optionally kick runBake
export const MAX_UPLOAD_BYTES = 50_000_000;
export const ALLOWED_EXT = new Set([".glb", ".gltf", ".obj", ".zip"]);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
```

Route `POST` parses `FormData`, calls `auth()`, maps to `handleUpload`.  
`GET /api/scans/[id]` returns safe fields: `id, status, failureReason, sourceFilename, createdAt, minZ, maxZ, widthMeters, heightMeters` plus boolean flags for asset presence.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/uploads.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scan upload API with async bake"
```

---

### Task 8: Asset serving API

**Files:**
- Create: `src/lib/api/assets-handler.ts`, `src/app/api/scans/[id]/assets/[kind]/route.ts`
- Test: `tests/api/assets.test.ts`

**Interfaces:**
- Consumes: `getPrisma()`, scan row paths
- Produces:
  - `getScanAsset(opts: { userId: string; scanId: string; kind: "heightmap" | "boundary" | "preview" }): Promise<{ bytes: Buffer; contentType: "image/png" }>`
  - Throws `HttpError(404)` if scan missing, not owned by user, status ≠ `ready`, unknown kind, or file missing
  - Route `GET /api/scans/[id]/assets/[kind]` calls `auth()` then `getScanAsset`
  - Do **not** expose `raw` in v1

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/assets.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../../src/lib/db";
import { ensureGardenUser } from "../../scripts/ensure-user";
import { getOrCreateGarden } from "../../src/lib/garden";
import { ensureStorageDir } from "../../src/lib/storage";
import { runBake } from "../../src/lib/bake/run-bake";
import { getScanAsset } from "../../src/lib/api/assets-handler";
import { HttpError } from "../../src/lib/api/uploads-handler";

describe("getScanAsset", () => {
  beforeAll(async () => {
    process.env.GARDEN_USER_EMAIL = "test@garden.local";
    process.env.GARDEN_USER_PASSWORD = "test-password";
    process.env.STORAGE_ROOT = path.join(process.cwd(), "storage-test");
    await ensureGardenUser();
  });

  it("returns png bytes for a ready scan", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    const garden = await getOrCreateGarden(user.id);
    const scan = await getPrisma().scanVersion.create({
      data: {
        gardenId: garden.id,
        status: "processing",
        sourceFilename: "tiny-slab.glb",
        rawPath: "",
      },
    });
    const dir = await ensureStorageDir("scans", scan.id);
    const raw = path.join(dir, "raw.glb");
    fs.copyFileSync(
      path.join(__dirname, "../fixtures/tiny-slab.glb"),
      raw,
    );
    await getPrisma().scanVersion.update({
      where: { id: scan.id },
      data: { rawPath: raw },
    });
    await runBake(scan.id);
    const asset = await getScanAsset({
      userId: user.id,
      scanId: scan.id,
      kind: "preview",
    });
    expect(asset.contentType).toBe("image/png");
    expect(asset.bytes.subarray(0, 8).toString("hex")).toBe(
      "89504e470d0a1a0a",
    );
  });

  it("404s for unknown kind", async () => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { email: "test@garden.local" },
    });
    await expect(
      getScanAsset({
        userId: user.id,
        scanId: "missing",
        kind: "heightmap",
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/assets.test.ts`
Expected: FAIL (handler missing)

- [ ] **Step 3: Implement `getScanAsset` + route**

Map kind → `heightmapPath` | `boundaryPath` | `previewPath`. Verify `scan.garden.userId === userId` and `status === "ready"`. `fs.readFile` the path.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/assets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: serve heightmap boundary preview assets"
```

---

### Task 9: Mobile upload UI

**Files:**
- Create: `src/components/UploadForm.tsx`, `src/components/ScanStatus.tsx`, `src/app/upload/page.tsx`
- Modify: `src/app/page.tsx` (link to upload / garden)

**Interfaces:**
- Consumes: `POST /api/uploads`, `GET /api/scans/[id]`
- Produces: mobile-first page — large file input accepting `.glb,.gltf,.obj,.zip`, submit, poll status every 2s until `ready|failed`, show preview `<img src={/api/scans/id/assets/preview}>` on ready, error text on failed

- [ ] **Step 1: Write the failing status-label test**

```ts
// tests/components/scan-status.test.tsx
import { describe, it, expect } from "vitest";
import { renderStatusLabel } from "../../src/components/ScanStatus";

describe("renderStatusLabel", () => {
  it("maps statuses", () => {
    expect(renderStatusLabel("processing")).toMatch(/processing/i);
    expect(renderStatusLabel("ready")).toMatch(/ready/i);
    expect(renderStatusLabel("failed")).toMatch(/failed/i);
  });
});
```

Export a pure `renderStatusLabel` helper from `ScanStatus.tsx` for easy testing; the component uses it.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement UploadForm + ScanStatus + `/upload` page**

UX requirements:
- Works on narrow viewports (single column, large tap targets)
- Disable submit while uploading
- After success, show scan id + polling status
- On failed: show `failureReason` + “Upload another” reset

- [ ] **Step 4: Run test — expect PASS**; manually `npm run dev` and open `/upload`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add mobile-friendly scan upload page"
```

---

### Task 10: Desktop HeightMapViewer + garden page

**Files:**
- Create: `src/components/HeightMapViewer.tsx`, `src/components/VersionList.tsx`, `src/app/garden/page.tsx`
- Test: `tests/components/height-color.test.ts`

**Interfaces:**
- Consumes: latest ready scan + version list from server components via Prisma; assets via `/api/scans/.../assets/...`
- Produces:
  - `heightToColor(t: number): [r,g,b]` where `t` in 0..1 — pure function tested
  - `HeightMapViewer` — loads heightmap + boundary images, draws to canvas, pan/zoom (wheel + drag), legend for low→high
  - `VersionList` — sorted by `createdAt` desc; click sets selected scan id; label status; latest ready marked “Current”
  - `/garden` — server: auth, `getOrCreateGarden`, list scans, default selected = `latestReadyScan`; empty state “Upload a scan to get started” linking to `/upload`

- [ ] **Step 1: Write failing color helper test**

```ts
// tests/components/height-color.test.ts
import { describe, it, expect } from "vitest";
import { heightToColor } from "../../src/components/HeightMapViewer";

describe("heightToColor", () => {
  it("returns distinct colors for low and high", () => {
    const low = heightToColor(0);
    const high = heightToColor(1);
    expect(low).not.toEqual(high);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement viewer + garden page**

Canvas draw algorithm:
1. Draw heightmap pixels tinted by `heightToColor` where boundary is opaque.
2. Transparent / dim where boundary empty.
3. Affine transform for pan/zoom.

Version list on the side (desktop); stack below on medium widths is OK.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add desktop 2D height map and version list"
```

---

### Task 11: Wire home, README, end-to-end manual checklist

**Files:**
- Modify: `src/app/page.tsx`, `README.md`
- Create: `docs/superpowers/plans/manual-checklist-v1.md` (short)

**Interfaces:**
- Consumes: full app
- Produces: clear local run docs + checklist matching spec testing section

- [ ] **Step 1: Update README**

Include:
1. Copy `.env.example` → `.env` and set email/password/`AUTH_SECRET`
2. `npx prisma migrate dev`
3. `npx tsx scripts/ensure-user.ts`
4. `npm run dev`
5. Workflow: Polycam export → `/upload` on phone → `/garden` on desktop

- [ ] **Step 2: Home page**

Authenticated: links to Upload and Garden. Signed out: redirect to login.

- [ ] **Step 3: Run full automated suite**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 4: Manual checklist file**

```markdown
# v1 manual checklist
- [ ] Login works with env credentials
- [ ] Upload tiny-slab.glb on desktop → ready + preview
- [ ] Garden shows height map for latest
- [ ] Second upload becomes current; first remains in version list
- [ ] Corrupt file → failed; previous ready still current
- [ ] Phone Safari: upload page usable; preview shows
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: add run instructions and v1 manual checklist"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| External LiDAR app capture (no custom iOS) | Docs / Task 11 README |
| Web upload mobile-friendly | Task 9 |
| Server heightmap + boundary + preview bake | Tasks 4–6 |
| Desktop 2D map + height layer | Task 10 |
| Version history; latest ready current | Tasks 3, 7, 10 |
| Failed never replaces ready | Task 6 |
| Auth single user | Task 2 |
| One garden auto-selected | Task 3, 9 |
| Accepted file types + 50MB cap | Task 7 |
| min Z height reference | Task 4 |
| Empty/error states | Tasks 9–10 |
| Automated bake/API tests | Tasks 4–8 |
| Manual Polycam path | Task 11 |
| Non-goals excluded | No tasks for classify/journal/AR app |

## Type consistency notes

- Status strings: `"processing" | "ready" | "failed"` everywhere
- `BakeResult` fields reused by `writeRasters` and `runBake`
- `handleUpload` returns `{ scanId: string; status: "processing" }`
- Asset kinds: `heightmap` | `boundary` | `preview`
