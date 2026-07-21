# gAR-den

Personal web app for processing garden LiDAR mesh exports into orthographic height maps with version history.

## Prerequisites

- Node.js 20+
- npm

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file and set credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   - `AUTH_SECRET` — random string for session signing
   - `GARDEN_USER_EMAIL` — login email for the single garden owner
   - `GARDEN_USER_PASSWORD` — login password

3. Apply the database schema:

   ```bash
   npx prisma migrate dev
   ```

4. Create or update the garden user from your env credentials:

   ```bash
   npx tsx scripts/ensure-user.ts
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign in, then use **Upload scan** or **Open garden**.

## Polycam workflow

1. Capture a garden mesh in [Polycam](https://poly.cam/) (or a similar LiDAR app) on iPhone/iPad.
2. Export the scan as `.glb`, `.gltf`, `.obj`, or `.zip` (under 50 MB).
3. On your phone, open `/upload` in Safari, sign in, and upload the export.
4. On desktop, open `/garden` to view the baked height map, boundary overlay, and version history.

The latest **ready** scan is always the current garden view. Failed uploads do not replace a ready scan.

## Testing

Run the automated suite:

```bash
npx vitest run
```

For a manual end-to-end walkthrough, see `docs/superpowers/plans/manual-checklist-v1.md`.
