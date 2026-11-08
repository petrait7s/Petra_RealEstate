import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Lead, LeadStage, Visit, canTransition } from "@petra/domain";
import { db } from "../../db.js";
import { tid, tx } from "../../store.js";
import { emit } from "../../bus.js";

const CreateLead = Lead.omit({ id: true, tenantId: true, stage: true });
const CreateVisit = Visit.omit({ id: true, tenantId: true });

export const leadsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const l: Lead = { ...CreateLead.parse(req.body), id: randomUUID(), tenantId: tid(req), stage: "new" };
    db.leads.add(l);
    emit("lead.created", l.tenantId, { name: l.name });
    return reply.code(201).send(l);
  });
  app.get("/", async (req) => db.leads.list(tid(req)));
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const cur = db.leads.get(tid(req), req.params.id);
    if (!cur) return reply.code(404).send({ error: "not found" });
    const patch = CreateLead.partial().parse(req.body); // stage only changes via /:id/stage (state machine)
    return db.leads.save(Lead.parse({ ...cur, ...patch, id: cur.id, tenantId: cur.tenantId, stage: cur.stage }));
  });
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const t = tid(req);
    if (!db.leads.get(t, req.params.id)) return reply.code(404).send({ error: "not found" });
    if (db.deals.list(t).some((d) => d.leadId === req.params.id)) return reply.code(409).send({ error: "Lead has a deal. It cannot be deleted." });
    tx(() => { db.visits.list(t).filter((v) => v.leadId === req.params.id).forEach((v) => db.visits.remove(t, v.id)); db.leads.remove(t, req.params.id); });
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>("/:id/stage", async (req, reply) => {
    const lead = db.leads.get(tid(req), req.params.id);
    if (!lead) return reply.code(404).send({ error: "not found" });
    const { stage } = z.object({ stage: LeadStage }).parse(req.body);
    if (!canTransition(lead.stage, stage)) return reply.code(409).send({ error: `bad transition ${lead.stage}->${stage}` });
    lead.stage = stage;
    db.leads.save(lead);
    emit("lead.stage", lead.tenantId, { name: lead.name, stage });
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
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!db.visits.get(tid(req), req.params.id)) return reply.code(404).send({ error: "not found" });
    db.visits.remove(tid(req), req.params.id);
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>("/:id/status", async (req, reply) => {
    const v = db.visits.get(tid(req), req.params.id);
    if (!v) return reply.code(404).send({ error: "not found" });
    v.status = z.object({ status: Visit.shape.status }).parse(req.body).status;
    db.visits.save(v);
    if (v.status === "done") emit("visit.done", v.tenantId, { name: db.leads.get(v.tenantId, v.leadId)?.name });
    return v;
  });
};
