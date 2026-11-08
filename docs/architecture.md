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

## Status (what is built)
- Persistence: `node:sqlite` JSON-document `Collection` (DB_PATH). Postgres adapter not built; `db/migrations/0001_core.sql` is the target schema for the cloud path.
- Auth: HS256 tokens, scrypt passwords, roles owner/manager/agent, first-run `/v1/auth/setup` (only while no users exist).
- Modules: properties, listings, leads (state machine), visits, deals (installments), rentals (idempotent invoices), documents (10MB cap), automation + tasks (event bus), dashboard (overdue).
- Desktop: Electron shell runs the bundled API in-process on 127.0.0.1:random, data in the OS user-data dir. Linux AppImage verified here; Windows `.exe` is built by `.github/workflows/desktop.yml` on a Windows runner (not verified here).
- Not built: multi-user sync (desktop <-> cloud), Postgres adapter, e-sign/OCR, WhatsApp/SMS, payments gateway, auto-update, app icon.

## Desktop distribution (Windows .exe + Linux AppImage)
Electron + electron-builder (`nsis`, `AppImage`). API is Node, so it runs inside Electron main; Tauri rejected (needs Node sidecar).

- `pnpm dist:linux` / `pnpm dist:win` from repo root. `apps/desktop/scripts/bundle.mjs` esbuilds the API into one file and copies the web build.
- Sync (later, for several project managers): cloud API + Postgres is source of truth; desktop keeps SQLite + outbox, pushes/pulls by cursor, field-level last-write-wins with `rev`, money/ledger conflicts rejected.
