import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.js";
import { db, resetDb } from "./db.js";
import { createUser } from "./modules/auth/routes.js";

const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const bdt = (amount: number) => ({ amount, currency: "BDT" });

async function client(app = buildApp(), email = "o@t1.test", tenant = T1, role: "owner" | "manager" | "agent" = "owner") {
  if (!db.users.all().some((u) => u.email === email)) createUser(tenant, email, "U", role, "secret1");
  const r = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "secret1" } });
  assert.equal(r.statusCode, 200);
  const headers = { authorization: `Bearer ${r.json().token}` };
  return async (method: string, url: string, payload?: unknown) => {
    const x = await app.inject({ method: method as never, url, headers, payload: payload as never });
    return { code: x.statusCode, body: x.headers["content-type"]?.toString().includes("json") ? x.json() : x.body };
  };
}

test("health is public, API needs auth", async () => {
  resetDb();
  const app = buildApp();
  assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/v1/properties" })).statusCode, 401);
  assert.equal((await app.inject({ url: "/v1/properties", headers: { authorization: "Bearer a.b.c" } })).statusCode, 401);
});

test("login rejects bad password; token tampering rejected", async () => {
  resetDb();
  const app = buildApp();
  createUser(T1, "o@t1.test", "O", "owner", "secret1");
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "o@t1.test", password: "nope" } })).statusCode, 401);
  const tok = (await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "o@t1.test", password: "secret1" } })).json().token as string;
  const [h, , s] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "x", tenantId: T2, role: "owner", name: "x", exp: 9999999999 })).toString("base64url");
  assert.equal((await app.inject({ url: "/v1/properties", headers: { authorization: `Bearer ${h}.${forged}.${s}` } })).statusCode, 401);
});

test("tenant isolation", async () => {
  resetDb();
  const app = buildApp();
  const a = await client(app, "o@t1.test", T1);
  const b = await client(app, "o@t2.test", T2);
  assert.equal((await a("POST", "/v1/properties", { type: "apartment", title: "Flat A", address: "Dhaka" })).code, 201);
  assert.equal((await a("GET", "/v1/properties")).body.length, 1);
  assert.equal((await b("GET", "/v1/properties")).body.length, 0);
});

test("roles: agent cannot write deals/leases/team; manager cannot manage team", async () => {
  resetDb();
  const app = buildApp();
  const agent = await client(app, "a@t1.test", T1, "agent");
  const manager = await client(app, "m@t1.test", T1, "manager");
  assert.equal((await agent("POST", "/v1/deals", {})).code, 403);
  assert.equal((await agent("POST", "/v1/leases", {})).code, 403);
  assert.equal((await agent("GET", "/v1/users")).code, 403);
  assert.equal((await agent("POST", "/v1/leads", { name: "Ok" })).code, 201);
  assert.equal((await manager("GET", "/v1/users")).code, 403);
  assert.notEqual((await manager("POST", "/v1/deals", {})).code, 403);
});

test("lead stage machine enforced + automation creates task", async () => {
  resetDb();
  const app = buildApp();
  const c = await client(app);
  await c("POST", "/v1/automations", { name: "Book visit", trigger: "lead.stage", stage: "site_visit", taskTitle: "Visit for {name}" });
  const lead = (await c("POST", "/v1/leads", { name: "Rahim" })).body;
  assert.equal((await c("POST", `/v1/leads/${lead.id}/stage`, { stage: "won" })).code, 409);
  assert.equal((await c("POST", `/v1/leads/${lead.id}/stage`, { stage: "contacted" })).code, 200);
  assert.equal((await c("GET", "/v1/tasks")).body.length, 0);
  await c("POST", `/v1/leads/${lead.id}/stage`, { stage: "site_visit" });
  const tasks = (await c("GET", "/v1/tasks")).body;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Visit for Rahim");
  const t = (await c("POST", `/v1/tasks/${tasks[0].id}/toggle`)).body;
  assert.equal(t.done, true);
});

test("disabled automation does not fire; validation errors are 400", async () => {
  resetDb();
  const c = await client();
  const rule = (await c("POST", "/v1/automations", { name: "r", trigger: "lead.created", taskTitle: "Call {name}" })).body;
  await c("POST", `/v1/automations/${rule.id}/toggle`);
  await c("POST", "/v1/leads", { name: "X" });
  assert.equal((await c("GET", "/v1/tasks")).body.length, 0);
  assert.equal((await c("POST", "/v1/leads", {})).code, 400);
});

test("deal flow, overdue, rent invoice idempotent, dashboard", async () => {
  resetDb();
  const c = await client();
  const prop = (await c("POST", "/v1/properties", { type: "apartment", title: "F", address: "D" })).body;
  const listing = (await c("POST", "/v1/listings", { propertyId: prop.id, kind: "sale", status: "active", price: bdt(1000000) })).body;
  const lead = (await c("POST", "/v1/leads", { name: "A" })).body;
  const deal = (await c("POST", "/v1/deals", { leadId: lead.id, listingId: listing.id, price: bdt(1000000), installments: 2, firstDue: "2020-01-01" })).body;
  assert.equal((await c("GET", "/v1/dashboard")).body.overdue.installments, 2);
  const i0 = deal.installments[0].id, i1 = deal.installments[1].id;
  assert.equal((await c("POST", `/v1/deals/${deal.id}/installments/${i0}/pay`)).body.status, "paying");
  assert.equal((await c("POST", `/v1/deals/${deal.id}/installments/${i0}/pay`)).code, 409);
  assert.equal((await c("POST", `/v1/deals/${deal.id}/installments/${i1}/pay`)).body.status, "completed");

  const lease = (await c("POST", "/v1/leases", { propertyId: prop.id, occupant: "X", rent: bdt(50000), startDate: "2026-01-01" })).body;
  const a = (await c("POST", `/v1/leases/${lease.id}/invoices`, { month: "2020-02" })).body;
  const b = (await c("POST", `/v1/leases/${lease.id}/invoices`, { month: "2020-02" })).body;
  assert.equal(a.id, b.id);
  const d = (await c("GET", "/v1/dashboard")).body;
  assert.equal(d.sales.collected, 1000000);
  assert.equal(d.sales.outstanding, 0);
  assert.equal(d.rent.due, 50000);
  assert.equal(d.overdue.invoices, 1);
  assert.equal(d.overdue.installments, 0);
});

test("documents: upload, list by entity, download, size limit, tenant isolation", async () => {
  resetDb();
  process.env.DATA_DIR = `/tmp/petra-test-${process.pid}`;
  const app = buildApp();
  const a = await client(app, "o@t1.test", T1);
  const b = await client(app, "o@t2.test", T2);
  const lead = (await a("POST", "/v1/leads", { name: "A" })).body;
  const up = await a("POST", "/v1/documents", { name: "nid.txt", mime: "text/plain", entityType: "lead", entityId: lead.id, dataBase64: Buffer.from("hello").toString("base64") });
  assert.equal(up.code, 201);
  assert.equal(up.body.size, 5);
  assert.equal((await a("GET", `/v1/documents?entityType=lead&entityId=${lead.id}`)).body.length, 1);
  assert.equal((await a("GET", "/v1/documents?entityType=deal")).body.length, 0);
  assert.equal((await a("GET", `/v1/documents/${up.body.id}/download`)).body, "hello");
  assert.equal((await b("GET", `/v1/documents/${up.body.id}/download`)).code, 404);
  assert.equal((await b("GET", "/v1/documents")).body.length, 0);
  const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
  assert.equal((await a("POST", "/v1/documents", { name: "big", dataBase64: big })).code, 413);
});

test("team: owner creates user, duplicate email rejected, password never leaked", async () => {
  resetDb();
  const c = await client();
  const u = await c("POST", "/v1/users", { email: "new@t1.test", name: "N", role: "agent", password: "abcdef" });
  assert.equal(u.code, 201);
  assert.equal(u.body.passHash, undefined);
  assert.equal((await c("POST", "/v1/users", { email: "new@t1.test", name: "N", role: "agent", password: "abcdef" })).code, 409);
  assert.ok(!JSON.stringify((await c("GET", "/v1/users")).body).includes("passHash"));
});

test("first-run setup: only when no users, then locked; short password rejected", async () => {
  resetDb();
  const app = buildApp();
  assert.equal((await app.inject({ url: "/v1/auth/status" })).json().needsSetup, true);
  const bad = await app.inject({ method: "POST", url: "/v1/auth/setup", payload: { name: "A", email: "a@x.test", password: "short" } });
  assert.equal(bad.statusCode, 400);
  const ok = await app.inject({ method: "POST", url: "/v1/auth/setup", payload: { name: "A", email: "a@x.test", password: "longenough" } });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.json().user.role, "owner");
  assert.equal((await app.inject({ url: "/v1/auth/status" })).json().needsSetup, false);
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/setup", payload: { name: "B", email: "b@x.test", password: "longenough" } })).statusCode, 409);
  const me = await app.inject({ url: "/v1/auth/me", headers: { authorization: `Bearer ${ok.json().token}` } });
  assert.equal(me.json().role, "owner");
});
