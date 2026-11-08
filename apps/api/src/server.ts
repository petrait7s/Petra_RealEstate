import { buildApp } from "./app.js";
import { db } from "./db.js";
import { seed } from "./seed.js";

/** Start the API. port 0 = random free port (desktop). Returns the bound port. */
export async function start(opts: { port?: number; host?: string } = {}): Promise<{ port: number; close: () => Promise<void> }> {
  if (process.env.SEED !== "0" && db.users.all().length === 0) seed();
  const app = buildApp();
  await app.listen({ port: opts.port ?? 3000, host: opts.host ?? "0.0.0.0" });
  const addr = app.server.address();
  return { port: typeof addr === "object" && addr ? addr.port : (opts.port ?? 3000), close: () => app.close() };
}
