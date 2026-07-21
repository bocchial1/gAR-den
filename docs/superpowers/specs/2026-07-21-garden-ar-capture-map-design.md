# gAR-den v1 — Capture ingest & living height map

**Date:** 2026-07-21  
**Status:** Approved for spec review  
**Product:** gAR-den (personal AR garden tracker)

## Goal

Build a personal garden map system: scan a ~300 sq ft outdoor space with iPhone/iPad Pro LiDAR (via an existing app), store versioned scans on a web backend, and view a **2D top-down canvas with an elevation height layer** as the living map.

v1 is **capture ingest + living map (view-only)**. Classification, action plans, and the full garden journal come later on the same web app.

## Long-term product context (out of v1)

Intended full pipeline:

1. **LiDAR scan** — mesh, boundary, heights (~300 sq ft)
2. **RGB visual overlay** — classify turf, dirt, weeds (yellow vs green zones)
3. **Action plan engine** — mulch volume, water zones, cut list
4. **Garden journal** — plants, tasks, photos, seasonal history on the living map

Day-to-day product goal is **ongoing tracking** (a living map updated by re-scans), not one-shot planning. v1 only delivers the durable spatial base those later stages need.

## Decisions

| Topic | Choice |
|---|---|
| Device | iPhone/iPad Pro with LiDAR |
| Primary day-to-day job | Ongoing living map (re-scan over time) |
| Long-term map contents | Full journal (surfaces, plants, tasks, photos, history) |
| v1 scope | Capture ingest + living 2D/height map only |
| v1 map interaction | View only (no markup, pins, or photos yet) |
| Primary UI | Saved 2D top-down canvas; AR only in the external scanner |
| Re-scans | Store every version; v1 UI shows latest; diff/compare later |
| Data home | Web app backend (not iCloud-only); journaling/analysis will live on web |
| Capture client | **Existing LiDAR app** (e.g. Polycam) — no custom iOS scanner in v1 |
| Phone role in gAR-den | Mobile-friendly **upload + status + preview** only |
| Desktop role | Full map viewer + version list |

## Approach

**Raster heightmap pipeline**

1. Capture mesh/point cloud in Polycam (or similar).
2. Upload export to gAR-den web.
3. Server bakes an orthographic **heightmap** + **boundary mask** + **preview** image.
4. Web renders a 2D top-down map with elevation as a color scale (optional contours).
5. Raw export is archived on each version for future classify / plan / journal / 3D work.

Rejected for v1: full interactive mesh-first web viewer; custom ARKit capture app; third-party managed scan platforms as the system of record.

## Architecture

```
[Polycam / similar]          [gAR-den mobile web]         [Backend]
 LiDAR scan ──export──►  upload + status + preview  ──►  store raw
                                                         bake job
                              [gAR-den desktop web]  ◄──  heightmap
                               2D map + versions          boundary
                                                          preview
```

| Piece | Responsibility |
|---|---|
| Existing LiDAR app | Scan ~300 sq ft; export mesh (glTF/OBJ) or zip containing it |
| Mobile web | Sign-in, upload to garden, processing status, preview when ready |
| Desktop web | Living 2D map (latest ready scan), pan/zoom, height layer, version list |
| Backend | Auth, object storage, DB, async bake worker |

## Components

### Web app (one responsive app, two focused experiences)

- **Auth** — single user (owner); required for upload and view
- **Garden** — one garden in v1 (additional gardens later)
- **Mobile upload UI** — file picker / share into browser; upload to the single garden; show `processing` → `ready` / `failed`; show preview image when ready
- **Desktop map UI** — 2D top-down canvas; height color scale; boundary; pan/zoom; version list (latest default; open any ready version; no side-by-side diff)
- **Empty / error states** — no ready scans; failed version detail + re-upload CTA

### Backend

- **Ingest** — accept upload, create `ScanVersion` with `status: processing`, store raw bytes
- **Bake job** — load mesh/cloud → orthographic projection → write heightmap, boundary, preview → `ready` or `failed`
- **API** — garden + versions metadata; signed URLs or equivalent for assets

### Accepted upload types (v1)

- `.glb` / `.gltf`
- `.obj` (and accompanying material/texture files if present in a zip)
- `.zip` containing one of the above

Exact size limit set at implementation (order of tens of MB); reject oversize and unsupported types with clear errors.

## Data model

- `User` — account
- `Garden` — belongs to user; one in v1
- `ScanVersion` — belongs to garden
  - `createdAt`
  - `status`: `processing` | `ready` | `failed`
  - `failureReason` (optional short string)
  - `rawExport` (stored file)
  - `heightmap` (raster, when ready)
  - `boundary` (mask, when ready)
  - `preview` (image, when ready)
  - optional source label (e.g. original filename)

**Coordinate frame:** local meters from the scan. No GPS georeferencing in v1.  
**Height reference:** heights are relative to the **minimum Z** in that scan’s geometry (lowest point = 0), so the color scale stays readable without a separate ground-fitting step in v1.

**Versioning rule:** each upload creates a new `ScanVersion`. The garden’s current map is the latest `ready` version. Failed versions never become current.

## Data flow

1. Scan in Polycam (or similar) on iPhone/iPad Pro.
2. Export mesh (glTF/OBJ, zip OK) to Files / share sheet.
3. Open gAR-den mobile web → sign in → garden is auto-selected (only one in v1) → upload.
4. Backend creates `ScanVersion` (`processing`) and stores raw export.
5. Bake worker produces heightmap, boundary, preview → `ready` (or `failed`).
6. Mobile UI shows status and preview when ready.
7. Desktop UI loads latest ready version into the 2D height map; user may open older ready versions from the list.
8. Re-scan = new upload / new version; history retained for a future diff feature.

## Error handling

- Invalid/corrupt/unsupported uploads rejected before becoming current.
- Upload interrupted → retry; no partial “ready” map.
- Bake failure → `failed` + reason; raw kept for retry; previous latest ready map unchanged.
- Long bake stays `processing` with honest status (no fake completion).
- Signed-out users cannot upload or view garden data.
- No sharing / multi-user access in v1.

## Testing

- **Bake:** fixture mesh → non-empty heightmap/boundary, sane height range.
- **API:** upload → processing → ready; failed bake does not replace latest ready.
- **Web:** empty garden; latest map renders; version switch; mobile upload + status.
- **Manual:** one real Polycam garden export end-to-end on iPhone Safari and desktop viewer.

## Tech direction (shape only)

Frameworks chosen in the implementation plan. Required shape:

- One web app (responsive) with mobile upload routes and desktop map viewer
- Auth + DB + object storage + async worker
- Server-side mesh load and orthographic height rasterization
- Hosting suitable for a single personal user

## Explicit non-goals (v1)

- Custom iOS/ARKit capture app
- RGB turf/dirt/weed classification
- Mulch / water / cut-list action plans
- Plant inventory, tasks, photos, seasonal journal UI
- Scan diff / side-by-side compare UI
- Full dual living-map parity on phone and desktop
- GPS georeferencing / multi-garden management
- Multi-user sharing

## Future hooks

- Archived raw mesh + version history enable classify → plan → journal on the same web app.
- Optional later: thin iOS helper (“Open in gAR-den”) or custom capture if export friction hurts.
- Diff UI can consume stored versions without changing the v1 data model.
