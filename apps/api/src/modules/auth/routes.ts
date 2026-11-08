import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Role } from "@petra/domain";
import { db, type UserRow } from "../../db.js";
import { checkPassword, hashPassword, signToken } from "../../auth.js";

const pub = ({ passHash: _p, ...u }: UserRow) => u;

export function createUser(tenantId: string, email: string, name: string, role: UserRow["role"], password: string): UserRow {
  return db.users.add({ id: randomUUID(), tenantId, email: email.toLowerCase(), name, role, passHash: hashPassword(password) });
}

export const authModule: FastifyPluginAsync = async (app) => {
  app.post("/login", async (req, reply) => {
    const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
    const u = db.users.all().find((x) => x.email === email.toLowerCase());
    if (!u || !checkPassword(password, u.passHash)) return reply.code(401).send({ error: "invalid email or password" });
    return { token: signToken({ sub: u.id, tenantId: u.tenantId, role: u.role, name: u.name }), user: pub(u) };
  });
  // First-run: allowed only while no user exists (fresh desktop install / new deployment).
  app.get("/status", async () => ({ needsSetup: db.users.all().length === 0 }));
  app.post("/setup", async (req, reply) => {
    if (db.users.all().length > 0) return reply.code(409).send({ error: "already set up" });
    const b = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8) }).parse(req.body);
    const u = createUser(randomUUID(), b.email, b.name, "owner", b.password);
    return reply.code(201).send({ token: signToken({ sub: u.id, tenantId: u.tenantId, role: u.role, name: u.name }), user: pub(u) });
  });
  app.get("/me", async (req) => ({ id: req.user.sub, name: req.user.name, role: req.user.role, tenantId: req.user.tenantId }));
};

export const usersModule: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => db.users.list(req.user.tenantId).map(pub));
  app.post("/", async (req, reply) => {
    const b = z.object({ email: z.string().email(), name: z.string().min(1), role: Role, password: z.string().min(6) }).parse(req.body);
    if (db.users.all().some((u) => u.email === b.email.toLowerCase())) return reply.code(409).send({ error: "email already used" });
    return reply.code(201).send(pub(createUser(req.user.tenantId, b.email, b.name, b.role, b.password)));
  });
};
