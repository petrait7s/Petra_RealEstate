import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.js";

const H = { "x-tenant-id": "11111111-1111-1111-1111-111111111111" };

test("health", async () => {
  const r = await buildApp().inject({ url: "/health" });
  assert.equal(r.statusCode, 200);
});
test("tenant required", async () => {
  const r = await buildApp().inject({ url: "/v1/properties" });
  assert.equal(r.statusCode, 400);
});
test("create+list property, tenant isolated", async () => {
  const app = buildApp();
  const c = await app.inject({ method: "POST", url: "/v1/properties", headers: H, payload: { type: "apartment", title: "Flat A", address: "Dhaka" } });
  assert.equal(c.statusCode, 201);
  const mine = await app.inject({ url: "/v1/properties", headers: H });
  assert.equal(mine.json().length, 1);
  const other = await app.inject({ url: "/v1/properties", headers: { "x-tenant-id": "22222222-2222-2222-2222-222222222222" } });
  assert.equal(other.json().length, 0);
});
test("lead stage machine enforced", async () => {
  const app = buildApp();
  const c = await app.inject({ method: "POST", url: "/v1/leads", headers: H, payload: { name: "Rahim" } });
  const id = c.json().id;
  const bad = await app.inject({ method: "POST", url: `/v1/leads/${id}/stage`, headers: H, payload: { stage: "won" } });
  assert.equal(bad.statusCode, 409);
  const ok = await app.inject({ method: "POST", url: `/v1/leads/${id}/stage`, headers: H, payload: { stage: "contacted" } });
  assert.equal(ok.statusCode, 200);
});

import { resetDb } from "./db.js";
test("deal flow: installments, pay, complete; rent invoice idempotent; dashboard", async () => {
  resetDb();
  const app = buildApp();
  const j = async (method: string, url: string, payload?: unknown) => {
    const r = await app.inject({ method: method as never, url, headers: H, payload: payload as never });
    return { code: r.statusCode, body: r.json() };
  };
  const prop = (await j("POST", "/v1/properties", { type: "apartment", title: "F", address: "D" })).body;
  const listing = (await j("POST", "/v1/listings", { propertyId: prop.id, kind: "sale", status: "active", price: { amount: 1000000, currency: "BDT" } })).body;
  const lead = (await j("POST", "/v1/leads", { name: "A" })).body;
  const deal = (await j("POST", "/v1/deals", { leadId: lead.id, listingId: listing.id, price: { amount: 1000000, currency: "BDT" }, installments: 2 })).body;
  assert.equal(deal.installments.length, 2);
  const d1 = (await j("POST", `/v1/deals/${deal.id}/installments/${deal.installments[0].id}/pay`)).body;
  assert.equal(d1.status, "paying");
  assert.equal((await j("POST", `/v1/deals/${deal.id}/installments/${deal.installments[0].id}/pay`)).code, 409);
  const d2 = (await j("POST", `/v1/deals/${deal.id}/installments/${deal.installments[1].id}/pay`)).body;
  assert.equal(d2.status, "completed");

  const lease = (await j("POST", "/v1/leases", { propertyId: prop.id, occupant: "X", rent: { amount: 50000, currency: "BDT" }, startDate: "2026-01-01" })).body;
  const i1 = (await j("POST", `/v1/leases/${lease.id}/invoices`, { month: "2026-02" })).body;
  const i2 = (await j("POST", `/v1/leases/${lease.id}/invoices`, { month: "2026-02" })).body;
  assert.equal(i1.id, i2.id);

  const dash = (await j("GET", "/v1/dashboard")).body;
  assert.equal(dash.sales.collected, 1000000);
  assert.equal(dash.sales.outstanding, 0);
  assert.equal(dash.rent.due, 50000);
});
