import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Lead, LeadStage, Visit, canTransition } from "@petra/domain";
import { db } from "../../db.js";
import { tid } from "../../store.js";

const CreateLead = Lead.omit({ id: true, tenantId: true, stage: true });
const CreateVisit = Visit.omit({ id: true, tenantId: true });

export const leadsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const l: Lead = { ...CreateLead.parse(req.body), id: randomUUID(), tenantId: tid(req), stage: "new" };
    return reply.code(201).send(db.leads.add(l));
  });
  app.get("/", async (req) => db.leads.list(tid(req)));
  app.post<{ Params: { id: string } }>("/:id/stage", async (req, reply) => {
    const lead = db.leads.get(tid(req), req.params.id);
    if (!lead) return reply.code(404).send({ error: "not found" });
    const { stage } = z.object({ stage: LeadStage }).parse(req.body);
    if (!canTransition(lead.stage, stage)) return reply.code(409).send({ error: `bad transition ${lead.stage}->${stage}` });
    lead.stage = stage;
    return lead;
  });
};

export const visitsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tid(req);
    const body = CreateVisit.parse(req.body);
    if (!db.leads.get(t, body.leadId)) return reply.code(404).send({ error: "lead not found" });
    return reply.code(201).send(db.visits.add({ ...body, id: randomUUID(), tenantId: t }));
  });
  app.get("/", async (req) => db.visits.list(tid(req)));
  app.post<{ Params: { id: string } }>("/:id/status", async (req, reply) => {
    const v = db.visits.get(tid(req), req.params.id);
    if (!v) return reply.code(404).send({ error: "not found" });
    v.status = z.object({ status: Visit.shape.status }).parse(req.body).status;
    return v;
  });
};
