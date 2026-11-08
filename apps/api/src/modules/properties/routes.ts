import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { Property } from "@petra/domain";
import { tenantId } from "../../tenant.js";

// In-memory store placeholder. Swap for Postgres repo (see db/migrations).
const store = new Map<string, Property>();
const CreateProperty = Property.omit({ id: true, tenantId: true });

export const propertiesModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tenantId(req);
    const body = CreateProperty.parse(req.body);
    const p: Property = { ...body, id: randomUUID(), tenantId: t };
    store.set(p.id, p);
    return reply.code(201).send(p);
  });
  app.get("/", async (req) => {
    const t = tenantId(req);
    return [...store.values()].filter((p) => p.tenantId === t);
  });
};
