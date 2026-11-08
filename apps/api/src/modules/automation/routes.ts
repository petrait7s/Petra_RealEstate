import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Automation, renderTemplate } from "@petra/domain";
import { db } from "../../db.js";
import { tid } from "../../store.js";
import { on } from "../../bus.js";

// Rule engine: every domain event runs matching enabled rules -> creates a task.
on((event, tenantId, payload) => {
  for (const r of db.automations.list(tenantId)) {
    if (!r.enabled || r.trigger !== event) continue;
    if (r.stage && r.stage !== payload.stage) continue;
    db.tasks.add({ id: randomUUID(), tenantId, title: renderTemplate(r.taskTitle, payload), done: false, source: r.name, createdAt: new Date().toISOString() });
  }
});

const CreateRule = Automation.omit({ id: true, tenantId: true, enabled: true });

export const automationModule: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => db.automations.list(tid(req)));
  app.post("/", async (req, reply) =>
    reply.code(201).send(db.automations.add({ ...CreateRule.parse(req.body), id: randomUUID(), tenantId: tid(req), enabled: true })));
  app.post<{ Params: { id: string } }>("/:id/toggle", async (req, reply) => {
    const r = db.automations.get(tid(req), req.params.id);
    if (!r) return reply.code(404).send({ error: "not found" });
    r.enabled = !r.enabled;
    return db.automations.save(r);
  });
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    db.automations.remove(tid(req), req.params.id);
    return reply.code(204).send();
  });
};

export const tasksModule: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => [...db.tasks.list(tid(req))].reverse());
  app.post("/", async (req, reply) => {
    const { title } = z.object({ title: z.string().min(1) }).parse(req.body);
    return reply.code(201).send(db.tasks.add({ id: randomUUID(), tenantId: tid(req), title, done: false, source: "manual", createdAt: new Date().toISOString() }));
  });
  app.post<{ Params: { id: string } }>("/:id/toggle", async (req, reply) => {
    const t = db.tasks.get(tid(req), req.params.id);
    if (!t) return reply.code(404).send({ error: "not found" });
    t.done = !t.done;
    return db.tasks.save(t);
  });
};
