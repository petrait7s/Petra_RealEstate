import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";

let conn: DatabaseSync | undefined;
/** Single SQLite connection. DB_PATH=file for persistence (default in-memory). */
export function sql(): DatabaseSync {
  if (!conn) {
    const p = process.env.DB_PATH ?? ":memory:";
    if (p !== ":memory:") mkdirSync(dirname(p), { recursive: true });
    conn = new DatabaseSync(p);
    conn.exec("PRAGMA journal_mode=WAL");
    conn.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    // Append-only change log: the future sync engine reads this by `seq` cursor.
    conn.exec(`CREATE TABLE IF NOT EXISTS changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, coll TEXT NOT NULL, id TEXT NOT NULL, tenant_id TEXT NOT NULL,
      op TEXT NOT NULL CHECK (op IN ('upsert','delete')), rev INTEGER NOT NULL, at TEXT NOT NULL, device TEXT NOT NULL)`);
    conn.exec("CREATE INDEX IF NOT EXISTS changes_tenant_seq ON changes(tenant_id, seq)");
    conn.exec("INSERT OR IGNORE INTO meta (k, v) VALUES ('schema_version', '1')");
  }
  return conn;
}

export function meta(k: string): string | undefined {
  return (sql().prepare("SELECT v FROM meta WHERE k = ?").get(k) as { v: string } | undefined)?.v;
}
export function setMeta(k: string, v: string) {
  sql().prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, v);
}
/** Stable id of this installation. Tags every local change so a sync peer can tell origins apart. */
export function deviceId(): string {
  let d = meta("device_id");
  if (!d) { d = randomUUID(); setMeta("device_id", d); }
  return d;
}

let depth = 0;
/** Run fn atomically (re-entrant). Data write + change-log row must commit together. */
export function tx<R>(fn: () => R): R {
  if (depth > 0) return fn();
  const d = sql();
  d.exec("BEGIN");
  depth++;
  try { const r = fn(); d.exec("COMMIT"); return r; }
  catch (e) { d.exec("ROLLBACK"); throw e; }
  finally { depth--; }
}

/** Sync metadata carried by every stored record. */
export type Synced = { rev?: number; updatedAt?: string; deletedAt?: string };
type Row = { id: string; tenantId: string };

const registry = new Map<string, Collection<any>>();

/**
 * Tenant-scoped JSON-document collection on SQLite.
 * Sync-ready: every write bumps `rev`, stamps `updatedAt`, and appends to `changes`.
 * Deletes are tombstones (`deletedAt`), never hard deletes, so peers can learn about them.
 * Call save() after mutating an object.
 */
export class Collection<T extends Row> {
  private ready = false;
  constructor(readonly name: string) { registry.set(name, this); }
  private t() {
    if (!this.ready) {
      sql().exec(`CREATE TABLE IF NOT EXISTS ${this.name} (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data TEXT NOT NULL)`);
      sql().exec(`CREATE INDEX IF NOT EXISTS ${this.name}_tenant ON ${this.name}(tenant_id)`);
      this.ready = true;
    }
    return this.name;
  }
  private write(x: T & Synced, op: "upsert" | "delete", device: string) {
    sql().prepare(`INSERT INTO ${this.t()} (id, tenant_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`).run(x.id, x.tenantId, JSON.stringify(x));
    sql().prepare("INSERT INTO changes (coll, id, tenant_id, op, rev, at, device) VALUES (?, ?, ?, ?, ?, ?, ?)").run(this.name, x.id, x.tenantId, op, x.rev!, x.updatedAt!, device);
  }
  /** Raw row including tombstones. For sync code only. */
  rawById(id: string): (T & Synced) | undefined {
    const r = sql().prepare(`SELECT data FROM ${this.t()} WHERE id = ?`).get(id) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : undefined;
  }
  add(x: T): T {
    return tx(() => {
      const s = x as T & Synced;
      s.rev = (this.rawById(x.id)?.rev ?? 0) + 1;
      s.updatedAt = new Date().toISOString();
      this.write(s, "upsert", deviceId());
      return x;
    });
  }
  save(x: T): T { return this.add(x); }
  list(t: string): T[] {
    return (sql().prepare(`SELECT data FROM ${this.t()} WHERE tenant_id = ? AND json_extract(data, '$.deletedAt') IS NULL ORDER BY rowid`).all(t) as { data: string }[]).map((r) => JSON.parse(r.data));
  }
  all(): T[] {
    return (sql().prepare(`SELECT data FROM ${this.t()} WHERE json_extract(data, '$.deletedAt') IS NULL ORDER BY rowid`).all() as { data: string }[]).map((r) => JSON.parse(r.data));
  }
  get(t: string, id: string): T | undefined {
    const r = sql().prepare(`SELECT data FROM ${this.t()} WHERE id = ? AND tenant_id = ? AND json_extract(data, '$.deletedAt') IS NULL`).get(id, t) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : undefined;
  }
  /** Soft delete (tombstone). */
  remove(t: string, id: string) {
    tx(() => {
      const cur = this.rawById(id);
      if (!cur || cur.tenantId !== t || cur.deletedAt) return;
      const now = new Date().toISOString();
      this.write({ ...cur, deletedAt: now, updatedAt: now, rev: (cur.rev ?? 0) + 1 }, "delete", deviceId());
    });
  }
  /**
   * Apply a record received from a peer. Higher rev wins; equal rev -> later updatedAt wins; else stale.
   * Keeps the peer's rev/updatedAt (no bump) and tags the change with the peer's device id.
   * Not wired to any endpoint yet: this is the primitive the sync engine will call.
   */
  applyRemote(x: T & Synced, fromDevice: string): "applied" | "stale" {
    if (!x.rev || !x.updatedAt) throw new Error("remote record needs rev and updatedAt");
    return tx(() => {
      const cur = this.rawById(x.id);
      if (cur && (cur.tenantId !== x.tenantId || (cur.rev ?? 0) > x.rev! || ((cur.rev ?? 0) === x.rev && (cur.updatedAt ?? "") >= x.updatedAt!))) return "stale";
      this.write(x, x.deletedAt ? "delete" : "upsert", fromDevice);
      return "applied";
    });
  }
  clear() { sql().exec(`DELETE FROM ${this.t()}`); }
}

/** Never exposed through the change feed: credentials need a dedicated peer-auth channel, not an owner token. */
const NOT_IN_FEED = ["users"];

export type Change = { seq: number; coll: string; id: string; op: "upsert" | "delete"; rev: number; at: string; device: string; record?: unknown };
/** Change feed for one tenant after cursor `since`. Includes the current record state (tombstones too). */
export function changesSince(tenantId: string, since: number, limit = 500): { cursor: number; changes: Change[] } {
  const rows = sql().prepare(`SELECT seq, coll, id, op, rev, at, device FROM changes WHERE tenant_id = ? AND seq > ? AND coll NOT IN (${NOT_IN_FEED.map(() => "?").join(",")}) ORDER BY seq LIMIT ?`)
    .all(tenantId, since, ...NOT_IN_FEED, Math.min(Math.max(limit, 1), 1000)) as Omit<Change, "record">[];
  const changes = rows.map((r) => ({ ...r, record: registry.get(r.coll)?.rawById(r.id) }));
  return { cursor: rows.length ? rows[rows.length - 1].seq : since, changes };
}
export const resetChanges = () => sql().exec("DELETE FROM changes");

export const tid = (req: FastifyRequest) => req.user.tenantId;
