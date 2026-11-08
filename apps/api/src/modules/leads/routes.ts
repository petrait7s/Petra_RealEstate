import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Lead, LeadStage, canTransition } from "@petra/domain";
import { tenantId } from "../../tenant.js";

const store = new Map<string, Lead>();
const CreateLead = Lead.omit({ id: true, tenantId: true, stage: true });

export const leadsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tenantId(req);
    const l: Lead = { ...CreateLead.parse(req.body), id: randomUUID(), tenantId: t, stage: "new" };
    store.set(l.id, l);
    return reply.code(201).send(l);
  });
  app.post<{ Params: { id: string } }>("/:id/stage", async (req, reply) => {
    const t = tenantId(req);
    const lead = store.get(req.params.id);
    if (!lead || lead.tenantId !== t) return reply.code(404).send({ error: "not found" });
    const { stage } = z.object({ stage: LeadStage }).parse(req.body);
    if (!canTransition(lead.stage, stage)) return reply.code(409).send({ error: `bad transition ${lead.stage}->${stage}` });
    lead.stage = stage;
    return lead;
  });
};
