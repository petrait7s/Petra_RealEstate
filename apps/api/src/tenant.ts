import type { Role } from "@petra/domain";

export type Claims = { sub: string; tenantId: string; role: Role; name: string; exp: number };

declare module "fastify" {
  interface FastifyRequest { user: Claims }
}
