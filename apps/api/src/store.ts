import type { FastifyRequest } from "fastify";
import { tenantId } from "./tenant.js";

/** Tenant-scoped in-memory collection. Replace with Repository adapters (Postgres/SQLite). */
export class Collection<T extends { id: string; tenantId: string }> {
  private m = new Map<string, T>();
  add(x: T) { this.m.set(x.id, x); return x; }
  list(t: string) { return [...this.m.values()].filter((x) => x.tenantId === t); }
  get(t: string, id: string) { const x = this.m.get(id); return x && x.tenantId === t ? x : undefined; }
  clear() { this.m.clear(); }
}
export const tid = (req: FastifyRequest) => tenantId(req);
