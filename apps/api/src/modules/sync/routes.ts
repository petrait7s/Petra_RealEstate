import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { changesSince, deviceId, tid } from "../../store.js";

/**
 * Read side of sync: a peer pulls this node's changes by cursor.
 * Push/apply (POST) is intentionally not built yet. See docs/sync-design.md.
 */
export const syncModule: FastifyPluginAsync = async (app) => {
  app.get("/changes", async (req) => {
    const q = z.object({ since: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(1000).default(500) }).parse(req.query);
    return { device: deviceId(), ...changesSince(tid(req), q.since, q.limit) };
  });
};
