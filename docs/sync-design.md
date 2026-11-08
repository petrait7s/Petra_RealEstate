# Sync design (not built; data layer is ready)

Goal: several project managers, each with a desktop app, plus a cloud node. Today: one PC, fully offline.

## Already in the code
- **Client-generated UUIDs** on every record: no id collisions across nodes.
- **`rev` + `updatedAt`** on every stored record (bumped by `Collection.add/save`).
- **Tombstones**: `remove()` sets `deletedAt`, never hard-deletes. Reads hide them, sync sees them.
- **`changes` table**: append-only log `(seq, coll, id, tenant_id, op, rev, at, device)`, written in the same transaction as the data (`tx()`), so log and data cannot diverge.
- **`device_id`** in `meta`: tags each local change with its origin.
- **`GET /v1/sync/changes?since=<seq>&limit=`**: a peer pulls changes after its cursor; includes the current record (tombstones too). Owner/manager only, tenant-scoped. `users` (credentials) are never in the feed.
- **`Collection.applyRemote(record, fromDevice)`**: the merge primitive. Higher `rev` wins; equal `rev` -> later `updatedAt`; otherwise stale. Refuses cross-tenant overwrite. Keeps the peer's `rev`, logs with the peer's device id (so it is not echoed back).
- **Documents carry `sha256`**: peers can fetch file blobs only when the hash is missing.
- **`schema_version`** in `meta` for future migrations.

## To build later
1. `POST /v1/sync/apply` (batch of records + origin device) calling `applyRemote`.
2. Sync client in the desktop app: pull from cloud by cursor, push local `changes` with `device = self` since last pushed seq, retry with backoff, store both cursors in `meta`.
3. Peer authentication: a dedicated device credential (not a user token); sync of `users` over that channel only.
4. Blob sync for `docs` by `sha256`.
5. Conflict policy beyond last-writer-wins:
   - money records (deal installments, rent invoices `paidAt`): do not overwrite a paid state with an unpaid one; surface a conflict to the user.
   - automation tasks: LWW is fine.
6. Cloud node: same API on Postgres (adapter implementing `Collection`'s interface) + `db/migrations`.

## Known limits of the current primitive
- `rev` is a per-record counter, not a vector clock: two offline edits with the same `rev` resolve by clock time, so badly skewed device clocks can pick the wrong winner. Acceptable for MVP; revisit with hybrid logical clocks.
- A deal stores installments inside one record: two managers editing different installments offline will conflict at record level. Split installments into their own collection before enabling multi-writer sync.
- Databases created before this change have records without `rev`; they read as rev 0 and get a rev on next write.
