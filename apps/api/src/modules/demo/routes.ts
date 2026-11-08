import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { tid } from "../../store.js";
import { businessCounts, clearBusiness, isEmpty, seedBusiness } from "../../seed.js";

/** Demo data tools (owner/manager). Clear only removes business data; users and automation rules stay. */
export const demoModule: FastifyPluginAsync = async (app) => {
  app.get("/status", async (req) => {
    const counts = businessCounts(tid(req));
    return { empty: isEmpty(tid(req)), counts };
  });
  app.post("/load", async (req, reply) => {
    const t = tid(req);
    if (!isEmpty(t)) return reply.code(409).send({ error: "Data already exists. Clear it first." });
    seedBusiness(t);
    return { empty: false, counts: businessCounts(t) };
  });
  app.post("/clear", async (req, reply) => {
    const { confirm } = z.object({ confirm: z.literal("CLEAR") }).parse(req.body ?? {});
    void confirm;
    clearBusiness(tid(req));
    return { empty: true, counts: businessCounts(tid(req)) };
  });
};
