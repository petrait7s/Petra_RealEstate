import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.js";
import { db, resetDb } from "./db.js";
import { createUser } from "./modules/auth/routes.js";
import { changesSince } from "./store.js";
import { seed, seedBusiness, businessCounts, DEMO_TENANT } from "./seed.js";

const T = DEMO_TENANT;
async function as(email: string, role: "owner" | "manager" | "agent" = "owner") {
  const app = buildApp();
  if (!db.users.all().some((u) => u.email === email)) createUser(T, email, "U", role, "secret1");
  const tok = (await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "secret1" } })).json().token;
  return async (method: string, url: string, payload?: unknown) => {
    const r = await app.inject({ method: method as never, url, headers: { authorization: `Bearer ${tok}` }, payload: payload as never });
    return { code: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
  };
}
const bdt = (n: number) => ({ amount: n, currency: "BDT" });

test("demo: load fills data, refuses when data exists, clear needs confirm and empties, rules kept", async () => {
  resetDb();
  const c = await as("o@x.test");
  assert.equal((await c("GET", "/v1/demo/status")).body.empty, true);
  const loaded = await c("POST", "/v1/demo/load");
  assert.equal(loaded.code, 200);
  assert.equal(loaded.body.counts.properties, 10);
  assert.equal(loaded.body.counts.leads, 14);
  assert.ok(loaded.body.counts.deals >= 3 && loaded.body.counts.leases === 3);
  assert.equal((await c("POST", "/v1/demo/load")).code, 409);
  assert.equal((await c("POST", "/v1/demo/clear", {})).code, 400);
  assert.equal((await c("POST", "/v1/demo/clear", { confirm: "yes" })).code, 400);
  assert.equal((await c("GET", "/v1/properties")).body.length, 10);
  const cleared = await c("POST", "/v1/demo/clear", { confirm: "CLEAR" });
  assert.equal(cleared.body.empty, true);
  assert.equal((await c("GET", "/v1/properties")).body.length, 0);
  assert.equal((await c("GET", "/v1/automations")).body.length, 4); // rules survive
  assert.equal((await c("POST", "/v1/demo/load")).code, 200); // can reload after clear
  assert.equal((await c("GET", "/v1/automations")).body.length, 4); // no duplicate rules
});

test("demo: clear is tombstones (sync sees deletes), other tenant untouched, agent forbidden", async () => {
  resetDb();
  const OTHER = "22222222-2222-2222-2222-222222222222";
  seedBusiness(OTHER);
  const c = await as("o@x.test");
  await c("POST", "/v1/demo/load");
  await c("POST", "/v1/demo/clear", { confirm: "CLEAR" });
  assert.ok(changesSince(T, 0, 1000).changes.some((x) => x.op === "delete" && x.coll === "properties"));
  assert.equal(businessCounts(OTHER).properties, 10);
  const a = await as("a@x.test", "agent");
  assert.equal((await a("POST", "/v1/demo/load")).code, 403);
  assert.equal((await a("POST", "/v1/demo/clear", { confirm: "CLEAR" })).code, 403);
});

test("demo data is coherent: refs valid, overdue exists, no orphan ids", async () => {
  resetDb();
  seedBusiness(T);
  const props = new Set(db.properties.list(T).map((x) => x.id));
  const listings = db.listings.list(T), leads = new Set(db.leads.list(T).map((x) => x.id));
  assert.ok(listings.every((l) => props.has(l.propertyId)));
  assert.ok(db.deals.list(T).every((d) => leads.has(d.leadId) && listings.some((l) => l.id === d.listingId)));
  assert.ok(db.visits.list(T).every((v) => leads.has(v.leadId)));
  const c = await as("o@x.test");
  const dash = (await c("GET", "/v1/dashboard")).body;
  assert.ok(dash.overdue.installments >= 2);
  assert.ok(dash.overdue.invoices >= 1);
  assert.equal(db.tasks.list(T).length, 5);
});

test("seed() creates the three demo users + data", () => {
  resetDb();
  seed();
  assert.equal(db.users.all().length, 3);
  assert.equal(businessCounts(T).leads, 14);
});

test("edit property/lead/listing; stage cannot be patched; invalid values rejected", async () => {
  resetDb();
  const c = await as("o@x.test");
  const p = (await c("POST", "/v1/properties", { type: "apartment", title: "A", address: "D" })).body;
  const e = await c("PATCH", `/v1/properties/${p.id}`, { title: "A2", bedrooms: 3 });
  assert.equal(e.body.title, "A2"); assert.equal(e.body.bedrooms, 3); assert.equal(e.body.id, p.id);
  assert.equal((await c("PATCH", `/v1/properties/${p.id}`, { type: "spaceship" })).code, 400);
  assert.equal((await c("PATCH", "/v1/properties/00000000-0000-0000-0000-000000000000", {})).code, 404);
  const l = (await c("POST", "/v1/leads", { name: "L" })).body;
  const le = await c("PATCH", `/v1/leads/${l.id}`, { name: "L2", stage: "won", budget: bdt(500) });
  assert.equal(le.body.name, "L2"); assert.equal(le.body.stage, "new"); assert.equal(le.body.budget.amount, 500);
  const li = (await c("POST", "/v1/listings", { propertyId: p.id, kind: "sale", status: "active", price: bdt(100) })).body;
  const lu = await c("PATCH", `/v1/listings/${li.id}`, { price: bdt(250), propertyId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(lu.body.price.amount, 250); assert.equal(lu.body.propertyId, p.id);
});

test("delete: tombstones, blocked by deals/leases, cascades listings/visits, agent forbidden", async () => {
  resetDb();
  const c = await as("o@x.test");
  const p = (await c("POST", "/v1/properties", { type: "apartment", title: "A", address: "D" })).body;
  const li = (await c("POST", "/v1/listings", { propertyId: p.id, kind: "sale", status: "active", price: bdt(1000) })).body;
  const lead = (await c("POST", "/v1/leads", { name: "L" })).body;
  const visit = (await c("POST", "/v1/visits", { leadId: lead.id, listingId: li.id, scheduledAt: new Date().toISOString() })).body;
  const deal = (await c("POST", "/v1/deals", { leadId: lead.id, listingId: li.id, price: bdt(1000), installments: 1 })).body;
  assert.equal((await c("DELETE", `/v1/properties/${p.id}`)).code, 409);
  assert.equal((await c("DELETE", `/v1/listings/${li.id}`)).code, 409);
  assert.equal((await c("DELETE", `/v1/leads/${lead.id}`)).code, 409);
  const a = await as("a@x.test", "agent");
  assert.equal((await a("DELETE", `/v1/visits/${visit.id}`)).code, 403);
  assert.equal((await c("DELETE", `/v1/visits/${visit.id}`)).code, 204);
  assert.equal((await c("GET", "/v1/visits")).body.length, 0);
  db.deals.remove(T, deal.id); // deal gone -> deletable
  assert.equal((await c("DELETE", `/v1/leads/${lead.id}`)).code, 204);
  assert.equal((await c("DELETE", `/v1/properties/${p.id}`)).code, 204);
  assert.equal((await c("GET", "/v1/listings")).body.length, 0); // cascaded
  assert.equal((await c("DELETE", `/v1/properties/${p.id}`)).code, 404);
  const lease = (await c("POST", "/v1/properties", { type: "house", title: "H", address: "x" })).body;
  await c("POST", "/v1/leases", { propertyId: lease.id, occupant: "O", rent: bdt(5), startDate: "2026-01-01" });
  assert.equal((await c("DELETE", `/v1/properties/${lease.id}`)).code, 409);
});
