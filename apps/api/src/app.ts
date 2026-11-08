import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { propertiesModule, listingsModule } from "./modules/properties/routes.js";
import { leadsModule, visitsModule } from "./modules/leads/routes.js";
import { dealsModule } from "./modules/deals/routes.js";
import { rentalsModule } from "./modules/rentals/routes.js";
import { dashboardModule } from "./modules/dashboard/routes.js";
import { authModule, usersModule } from "./modules/auth/routes.js";
import { documentsModule } from "./modules/documents/routes.js";
import { automationModule, tasksModule } from "./modules/automation/routes.js";
import { syncModule } from "./modules/sync/routes.js";
import { verifyToken } from "./auth.js";

export function buildApp() {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 * 1024 });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err?.name === "ZodError") return reply.code(400).send({ error: "validation", issues: err.issues });
    reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  app.decorateRequest("user", undefined as never);
  app.addHook("onRequest", async (req, reply) => {
    const url = req.url.split("?")[0];
    if (!url.startsWith("/v1/") || ["/v1/auth/login", "/v1/auth/status", "/v1/auth/setup"].includes(url)) return;
    const h = req.headers.authorization;
    const claims = h?.startsWith("Bearer ") ? verifyToken(h.slice(7)) : undefined;
    if (!claims) return reply.code(401).send({ error: "unauthorized" });
    req.user = claims;
    const write = req.method !== "GET";
    // Role matrix: owner = all; manager = all except team; agent = no money/rental writes, no automation/team.
    if (url.startsWith("/v1/users") && claims.role !== "owner") return reply.code(403).send({ error: "forbidden" });
    if (url.startsWith("/v1/sync") && claims.role === "agent") return reply.code(403).send({ error: "forbidden" });
    if (claims.role === "agent" && write && /^\/v1\/(deals|leases|automations)/.test(url)) return reply.code(403).send({ error: "forbidden" });
  });

  app.get("/health", async () => ({ ok: true }));
  app.register(authModule, { prefix: "/v1/auth" });
  app.register(usersModule, { prefix: "/v1/users" });
  app.register(propertiesModule, { prefix: "/v1/properties" });
  app.register(listingsModule, { prefix: "/v1/listings" });
  app.register(leadsModule, { prefix: "/v1/leads" });
  app.register(visitsModule, { prefix: "/v1/visits" });
  app.register(dealsModule, { prefix: "/v1/deals" });
  app.register(rentalsModule, { prefix: "/v1/leases" });
  app.register(documentsModule, { prefix: "/v1/documents" });
  app.register(automationModule, { prefix: "/v1/automations" });
  app.register(tasksModule, { prefix: "/v1/tasks" });
  app.register(syncModule, { prefix: "/v1/sync" });
  app.register(dashboardModule, { prefix: "/v1/dashboard" });

  // Serve the built web UI (desktop app / single-binary deploy).
  const webDir = process.env.WEB_DIR;
  if (webDir && existsSync(webDir)) {
    app.register(fastifyStatic, { root: webDir });
    app.setNotFoundHandler((req, reply) =>
      req.method === "GET" && !req.url.startsWith("/v1/") ? reply.sendFile("index.html") : reply.code(404).send({ error: "not found" }));
  }
  return app;
}
