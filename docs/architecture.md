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
