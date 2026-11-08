import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Lease } from "@petra/domain";
import { db } from "../../db.js";
import { tid } from "../../store.js";

const CreateLease = Lease.omit({ id: true, tenantId: true });

export const rentalsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tid(req);
    const b = CreateLease.parse(req.body);
    if (!db.properties.get(t, b.propertyId)) return reply.code(404).send({ error: "property not found" });
    return reply.code(201).send(db.leases.add({ ...b, id: randomUUID(), tenantId: t }));
  });
  app.get("/", async (req) => db.leases.list(tid(req)));
  app.get("/invoices", async (req) => db.invoices.list(tid(req)));
  // idempotent: one invoice per lease per month
  app.post<{ Params: { id: string } }>("/:id/invoices", async (req, reply) => {
    const t = tid(req);
    const lease = db.leases.get(t, req.params.id);
    if (!lease) return reply.code(404).send({ error: "not found" });
    const { month } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.body);
    const existing = db.invoices.list(t).find((i) => i.leaseId === lease.id && i.month === month);
    if (existing) return existing;
    return reply.code(201).send(db.invoices.add({ id: randomUUID(), tenantId: t, leaseId: lease.id, month, amount: lease.rent }));
  });
  app.post<{ Params: { id: string } }>("/invoices/:id/pay", async (req, reply) => {
    const inv = db.invoices.get(tid(req), req.params.id);
    if (!inv) return reply.code(404).send({ error: "not found" });
    if (inv.paidAt) return reply.code(409).send({ error: "already paid" });
    inv.paidAt = new Date().toISOString();
    return inv;
  });
};
