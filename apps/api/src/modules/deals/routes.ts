import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Deal, Money, splitInstallments } from "@petra/domain";
import { db } from "../../db.js";
import { tid } from "../../store.js";
import { emit } from "../../bus.js";

const CreateDeal = z.object({
  leadId: z.string().uuid(),
  listingId: z.string().uuid(),
  price: Money,
  installments: z.number().int().min(1).max(120).default(1),
  firstDue: z.string().optional(),
});

const refresh = (d: Deal) => {
  if (d.status === "cancelled") return;
  const paid = d.installments.filter((i) => i.paidAt).length;
  d.status = paid === 0 ? "booking" : paid === d.installments.length ? "completed" : "paying";
};

export const dealsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tid(req);
    const b = CreateDeal.parse(req.body);
    if (!db.leads.get(t, b.leadId)) return reply.code(404).send({ error: "lead not found" });
    if (!db.listings.get(t, b.listingId)) return reply.code(404).send({ error: "listing not found" });
    const deal: Deal = {
      id: randomUUID(), tenantId: t, leadId: b.leadId, listingId: b.listingId, price: b.price, status: "booking",
      installments: splitInstallments(b.price, b.installments, b.firstDue ? new Date(b.firstDue) : new Date(), randomUUID),
      createdAt: new Date().toISOString(),
    };
    db.deals.add(deal);
    emit("deal.created", t, { name: db.leads.get(t, b.leadId)?.name });
    return reply.code(201).send(deal);
  });
  app.get("/", async (req) => db.deals.list(tid(req)));
  app.post<{ Params: { id: string; iid: string } }>("/:id/installments/:iid/pay", async (req, reply) => {
    const d = db.deals.get(tid(req), req.params.id);
    const inst = d?.installments.find((i) => i.id === req.params.iid);
    if (!d || !inst) return reply.code(404).send({ error: "not found" });
    if (inst.paidAt) return reply.code(409).send({ error: "already paid" });
    inst.paidAt = new Date().toISOString();
    refresh(d);
    db.deals.save(d);
    emit("installment.paid", d.tenantId, { name: db.leads.get(d.tenantId, d.leadId)?.name, stage: d.status });
    return d;
  });
  app.post<{ Params: { id: string } }>("/:id/cancel", async (req, reply) => {
    const d = db.deals.get(tid(req), req.params.id);
    if (!d) return reply.code(404).send({ error: "not found" });
    d.status = "cancelled";
    return db.deals.save(d);
  });
};
