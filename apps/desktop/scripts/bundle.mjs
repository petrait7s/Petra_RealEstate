// Bundle the API (+ fastify, zod, domain) into one ESM file and copy the web build next to it.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const out = join(root, "apps", "desktop", "app");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, "apps/api/src/server.ts")],
  outfile: join(out, "api.mjs"),
  bundle: true, platform: "node", format: "esm", target: "node22",
  external: ["node:*"],
  // CJS deps inside an ESM bundle need require()
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

const web = join(root, "apps/web/dist");
if (!existsSync(web)) throw new Error("apps/web/dist missing: run `pnpm --filter @petra/web build` first");
cpSync(web, join(out, "web"), { recursive: true });
console.log("bundled ->", out);
