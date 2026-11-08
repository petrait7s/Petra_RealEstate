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
