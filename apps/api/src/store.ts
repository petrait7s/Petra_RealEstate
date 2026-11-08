import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { FastifyRequest } from "fastify";

let conn: DatabaseSync | undefined;
/** Single SQLite connection. DB_PATH=file for persistence (default in-memory). */
export function sql(): DatabaseSync {
  if (!conn) {
    const p = process.env.DB_PATH ?? ":memory:";
    if (p !== ":memory:") mkdirSync(dirname(p), { recursive: true });
    conn = new DatabaseSync(p);
    conn.exec("PRAGMA journal_mode=WAL");
  }
  return conn;
}

/** Tenant-scoped JSON-document collection on SQLite. Call save() after mutating an object. */
export class Collection<T extends { id: string; tenantId: string }> {
  private ready = false;
  constructor(private name: string) {}
  private t() {
    if (!this.ready) {
      sql().exec(`CREATE TABLE IF NOT EXISTS ${this.name} (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data TEXT NOT NULL)`);
      sql().exec(`CREATE INDEX IF NOT EXISTS ${this.name}_tenant ON ${this.name}(tenant_id)`);
      this.ready = true;
    }
    return this.name;
  }
  add(x: T): T {
    sql().prepare(`INSERT INTO ${this.t()} (id, tenant_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`).run(x.id, x.tenantId, JSON.stringify(x));
    return x;
  }
  save(x: T): T { return this.add(x); }
  list(t: string): T[] {
    return (sql().prepare(`SELECT data FROM ${this.t()} WHERE tenant_id = ? ORDER BY rowid`).all(t) as { data: string }[]).map((r) => JSON.parse(r.data));
  }
  all(): T[] {
    return (sql().prepare(`SELECT data FROM ${this.t()} ORDER BY rowid`).all() as { data: string }[]).map((r) => JSON.parse(r.data));
  }
  get(t: string, id: string): T | undefined {
    const r = sql().prepare(`SELECT data FROM ${this.t()} WHERE id = ? AND tenant_id = ?`).get(id, t) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : undefined;
  }
  remove(t: string, id: string) { sql().prepare(`DELETE FROM ${this.t()} WHERE id = ? AND tenant_id = ?`).run(id, t); }
  clear() { sql().exec(`DELETE FROM ${this.t()}`); }
}

export const tid = (req: FastifyRequest) => req.user.tenantId;
