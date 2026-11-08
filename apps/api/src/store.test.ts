import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";
import { db, resetDb } from "./db.js";
import { changesSince, deviceId, sql, tx } from "./store.js";
import { createUser } from "./modules/auth/routes.js";

const T = "11111111-1111-1111-1111-111111111111";
const lead = (name: string) => ({ id: randomUUID(), tenantId: T, name, source: "manual", stage: "new" as const });

test("rev bumps on every write, updatedAt stamped", () => {
  resetDb();
  const l = db.leads.add(lead("A"));
  assert.equal((db.leads.rawById(l.id) as any).rev, 1);
  l.name = "B"; db.leads.save(l);
  const raw = db.leads.rawById(l.id) as any;
  assert.equal(raw.rev, 2);
  assert.ok(raw.updatedAt);
});

test("remove is a tombstone: hidden from reads, visible to sync, logged as delete", () => {
  resetDb();
  const l = db.leads.add(lead("A"));
  db.leads.remove(T, l.id);
  assert.equal(db.leads.list(T).length, 0);
  assert.equal(db.leads.get(T, l.id), undefined);
  const raw = db.leads.rawById(l.id) as any;
  assert.ok(raw.deletedAt);
  assert.equal(raw.rev, 2);
  const feed = changesSince(T, 0);
  assert.deepEqual(feed.changes.map((c) => c.op), ["upsert", "delete"]);
  db.leads.remove(T, l.id); // idempotent: no extra change
  assert.equal(changesSince(T, 0).changes.length, 2);
});

test("change feed: ordered seq, cursor paging, device id, tenant scoped", () => {
  resetDb();
  const a = db.leads.add(lead("A")), b = db.leads.add(lead("B"));
  db.leads.add({ ...lead("other"), tenantId: "22222222-2222-2222-2222-222222222222" });
  const f1 = changesSince(T, 0, 1);
  assert.equal(f1.changes.length, 1);
  assert.equal(f1.changes[0].id, a.id);
  const f2 = changesSince(T, f1.cursor);
  assert.equal(f2.changes.length, 1);
  assert.equal(f2.changes[0].id, b.id);
  assert.equal(f2.changes[0].device, deviceId());
  assert.equal(changesSince(T, f2.cursor).changes.length, 0);
  assert.equal(changesSince(T, f2.cursor).cursor, f2.cursor);
});

test("applyRemote: higher rev wins, stale ignored, tombstone applied, origin device kept", () => {
  resetDb();
  const l = db.leads.add(lead("local")); // rev 1
  const remote = { ...(db.leads.rawById(l.id) as any), name: "remote", rev: 3, updatedAt: new Date(Date.now() + 1000).toISOString() };
  assert.equal(db.leads.applyRemote(remote, "peer-1"), "applied");
  assert.equal(db.leads.get(T, l.id)!.name, "remote");
  assert.equal(db.leads.applyRemote({ ...remote, name: "older", rev: 2 }, "peer-2"), "stale");
  assert.equal(db.leads.applyRemote({ ...remote }, "peer-2"), "stale"); // same rev + same time
  assert.equal(db.leads.applyRemote({ ...remote, rev: 4, deletedAt: remote.updatedAt }, "peer-1"), "applied");
  assert.equal(db.leads.get(T, l.id), undefined);
  const last = changesSince(T, 0).changes.at(-1)!;
  assert.equal(last.op, "delete");
  assert.equal(last.device, "peer-1");
  assert.throws(() => db.leads.applyRemote({ ...remote, rev: undefined } as any, "x"));
});

test("applyRemote refuses to overwrite a record owned by another tenant", () => {
  resetDb();
  const l = db.leads.add(lead("mine"));
  const evil = { ...(db.leads.rawById(l.id) as any), tenantId: "22222222-2222-2222-2222-222222222222", rev: 99, updatedAt: "2999-01-01T00:00:00.000Z" };
  assert.equal(db.leads.applyRemote(evil, "peer"), "stale");
  assert.equal(db.leads.get(T, l.id)!.name, "mine");
});

test("tx rolls back data and change log together", () => {
  resetDb();
  assert.throws(() => tx(() => { db.leads.add(lead("X")); throw new Error("boom"); }));
  assert.equal(db.leads.list(T).length, 0);
  assert.equal(changesSince(T, 0).changes.length, 0);
});

test("schema version recorded", () => {
  assert.equal((sql().prepare("SELECT v FROM meta WHERE k='schema_version'").get() as any).v, "1");
});

test("GET /v1/sync/changes: owner ok, agent forbidden, tenant isolated, docs carry sha256", async () => {
  resetDb();
  process.env.DATA_DIR = `/tmp/petra-test-${process.pid}`;
  const app = buildApp();
  createUser(T, "o@a.test", "O", "owner", "secret1");
  createUser(T, "a@a.test", "A", "agent", "secret1");
  createUser("22222222-2222-2222-2222-222222222222", "o@b.test", "O2", "owner", "secret1");
  const tok = async (email: string) => ({ authorization: `Bearer ${(await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "secret1" } })).json().token}` });
  const owner = await tok("o@a.test"), agent = await tok("a@a.test"), other = await tok("o@b.test");
  await app.inject({ method: "POST", url: "/v1/leads", headers: owner, payload: { name: "Z" } });
  await app.inject({ method: "POST", url: "/v1/documents", headers: owner, payload: { name: "f.txt", dataBase64: Buffer.from("hello").toString("base64") } });
  const feed = (await app.inject({ url: "/v1/sync/changes?since=0", headers: owner })).json();
  assert.equal(feed.device, deviceId());
  const colls = feed.changes.map((c: any) => c.coll);
  assert.ok(colls.includes("leads") && colls.includes("docs"));
  assert.ok(!colls.includes("users"), "credentials must not be in the feed");
  assert.ok(!JSON.stringify(feed).includes("passHash"));
  const doc = feed.changes.find((c: any) => c.coll === "docs").record;
  assert.equal(doc.sha256, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  assert.equal((await app.inject({ url: "/v1/sync/changes", headers: agent })).statusCode, 403);
  assert.equal((await app.inject({ url: "/v1/sync/changes", headers: other })).json().changes.length, 0);
  assert.equal((await app.inject({ url: "/v1/sync/changes?since=abc", headers: owner })).statusCode, 400);
});
