import Fastify from "fastify";
import { propertiesModule, listingsModule } from "./modules/properties/routes.js";
import { leadsModule, visitsModule } from "./modules/leads/routes.js";
import { dealsModule } from "./modules/deals/routes.js";
import { rentalsModule } from "./modules/rentals/routes.js";
import { dashboardModule } from "./modules/dashboard/routes.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler((err: any, _req, reply) => {
    if (err?.name === "ZodError") return reply.code(400).send({ error: "validation", issues: err.issues });
    reply.code(err.statusCode ?? 500).send({ error: err.message });
  });
  app.get("/health", async () => ({ ok: true }));
  // Each module owns its routes + data. Cross-module talk via events (later).
  app.register(propertiesModule, { prefix: "/v1/properties" });
  app.register(listingsModule, { prefix: "/v1/listings" });
  app.register(leadsModule, { prefix: "/v1/leads" });
  app.register(visitsModule, { prefix: "/v1/visits" });
  app.register(dealsModule, { prefix: "/v1/deals" });
  app.register(rentalsModule, { prefix: "/v1/leases" });
  app.register(dashboardModule, { prefix: "/v1/dashboard" });
  return app;
}
