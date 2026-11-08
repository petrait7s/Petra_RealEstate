import type { FastifyRequest } from "fastify";

/** Tenant from header for now. Replace with JWT claim once auth module lands. */
export function tenantId(req: FastifyRequest): string {
  const t = req.headers["x-tenant-id"];
  if (typeof t !== "string" || !t) throw Object.assign(new Error("x-tenant-id required"), { statusCode: 400 });
  return t;
}
