import Fastify from "fastify";
import { propertiesModule } from "./modules/properties/routes.js";
import { leadsModule } from "./modules/leads/routes.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ ok: true }));
  // Each module owns its routes + data. Cross-module talk via events (later).
  app.register(propertiesModule, { prefix: "/v1/properties" });
  app.register(leadsModule, { prefix: "/v1/leads" });
  return app;
}
