# Petra Real Estate OS: architecture

Modular monolith. One deployable API, modules own their routes + tables, talk via domain events.

## Layers
identity/tenancy, property graph, CRM, transactions, rentals, finance, documents, marketplace, automation, analytics, AI.

## Rules
- `tenant_id` on every row; Postgres RLS enforces it.
- Money = integer minor units + currency.
- Property (physical) != Listing (time-bound offer).
- Per-org custom fields in `properties.attributes` JSONB.
- No cross-module table joins; use service interfaces / events.

## Layout
- `packages/domain`: zod schemas + pure domain logic (shared by api/web/mobile)
- `apps/api`: Fastify API, one folder per module under `src/modules`
- `db/migrations`: SQL
- Planned: `apps/web`, `apps/portal`, `apps/mobile`, `services/worker`, `services/ai`

## Roadmap
1. Auth + tenancy + property/listing + media  <- scaffolded (in-memory stores)
2. CRM pipeline + site visits
3. Public portal + search
4. Deals, payments, ledger
5. Rentals + recurring billing
6. Automation + WhatsApp
7. Analytics + AI

## Desktop distribution (Windows .exe + Linux AppImage)
Decision: ship same web UI + API as a desktop app.

- Shell: Electron + electron-builder. Targets: `nsis` (Windows .exe), `AppImage` (Linux). API is Node/Fastify, so it runs in-process inside Electron main; no sidecar needed. (Tauri rejected: would need Node sidecar.)
- Layout: `apps/desktop` (Electron main + preload), loads `apps/web` build, starts `apps/api` on a random localhost port.
- Storage: repository interface per module with two adapters: Postgres (cloud/multi-user) and SQLite (desktop/offline). Do not use Postgres-only features (RLS, PostGIS) in domain logic; keep them inside the Postgres adapter. Desktop = single tenant, tenant check still enforced in repo layer.
- Sync (later): desktop SQLite <-> cloud via outbox/event log.
- Auth: desktop uses local login; cloud uses JWT. Same module interface.
- Packaging CI: GitHub Actions matrix (windows-latest, ubuntu-latest) builds `.exe` and `.AppImage`, uploads as release assets. Cross-building the .exe from Linux is unreliable; build on the Windows runner.
- Auto-update: electron-updater.

### Consequences for current code
- In-memory stores in `apps/api/src/modules/*` become `Repository` interfaces next.
- Keep API free of Postgres-specific calls outside the adapter.
