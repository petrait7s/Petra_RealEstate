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

## Features
Overview dashboard, properties + listings, lead pipeline (drag between stages, state machine enforced), site visits, deals with installment schedules, rentals with monthly invoices.

## Not done yet
Auth/roles (demo tenant header), Postgres/SQLite persistence (in-memory stores), documents, automation, sync, desktop packaging.
