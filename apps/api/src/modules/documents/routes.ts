import type { FastifyPluginAsync } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Doc } from "@petra/domain";
import { db } from "../../db.js";
import { tid } from "../../store.js";

const dir = () => {
  const d = join(process.env.DATA_DIR ?? join(process.env.TMPDIR ?? "/tmp", "petra-data"), "files");
  mkdirSync(d, { recursive: true });
  return d;
};
export const removeDocFile = (id: string) => rmSync(join(dir(), id), { force: true });
const Upload = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().default("application/octet-stream"),
  entityType: Doc.shape.entityType,
  entityId: z.string().uuid().optional(),
  dataBase64: z.string().min(1),
});
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export const documentsModule: FastifyPluginAsync = async (app) => {
  app.post("/", async (req, reply) => {
    const t = tid(req);
    const b = Upload.parse(req.body);
    const buf = Buffer.from(b.dataBase64, "base64");
    if (buf.length > MAX_DOC_BYTES) return reply.code(413).send({ error: "file too large (max 10MB)" });
    const id = randomUUID();
    writeFileSync(join(dir(), id), buf); // id is server-generated: no path traversal
    const doc = db.docs.add({ id, tenantId: t, name: b.name, mime: b.mime, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), entityType: b.entityType, entityId: b.entityId, uploadedBy: req.user.sub, createdAt: new Date().toISOString() });
    return reply.code(201).send(doc);
  });
  app.get<{ Querystring: { entityType?: string; entityId?: string } }>("/", async (req) =>
    db.docs.list(tid(req)).filter((d) => (!req.query.entityType || d.entityType === req.query.entityType) && (!req.query.entityId || d.entityId === req.query.entityId)).reverse());
  app.get<{ Params: { id: string } }>("/:id/download", async (req, reply) => {
    const d = db.docs.get(tid(req), req.params.id);
    if (!d) return reply.code(404).send({ error: "not found" });
    return reply.header("content-type", d.mime).header("content-disposition", `attachment; filename="${encodeURIComponent(d.name)}"`).send(readFileSync(join(dir(), d.id)));
  });
};
