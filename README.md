# Petra Real Estate OS

See `docs/architecture.md`.

## Run

```bash
pnpm install
pnpm build            # builds packages/domain first (web + api import it)
pnpm dev:api          # :3000, seeded demo data (SEED=0 to disable)
pnpm --filter @petra/web dev   # :5173, proxies /v1 to the API
pnpm test
```

## Login
Dev (seeded): `owner@petra.test` / `manager@petra.test` / `agent@petra.test`, password `petra123`. Never ship with seed on: set `SEED=0` (desktop does) and use first-run setup.

## Features
Overview (with overdue alerts), properties + listings, lead pipeline (state machine), site visits, deals with installments, rentals with monthly invoices, documents, tasks + automation rules, team and roles.

## Desktop app
```bash
pnpm dist:linux   # -> apps/desktop/release/*.AppImage
pnpm dist:win     # run on Windows (or the "Desktop builds" GitHub workflow)
```

## Env
`DB_PATH` (SQLite file; default in-memory), `DATA_DIR` (uploaded files), `JWT_SECRET` (optional; else generated and stored in the DB), `WEB_DIR` (serve built web from the API), `SEED=0`.

## Not done yet
Multi-user sync, Postgres adapter, WhatsApp/SMS, payment gateway, e-sign, auto-update, app icon.
