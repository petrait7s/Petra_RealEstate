import test from "node:test";
import assert from "node:assert/strict";
import { addMoney, money, canTransition } from "./index.js";

test("money adds in minor units", () => {
  assert.equal(addMoney(money(100), money(250)).amount, 350);
});
test("money rejects float", () => {
  assert.throws(() => money(1.5));
});
test("lead stage machine", () => {
  assert.equal(canTransition("new", "contacted"), true);
  assert.equal(canTransition("new", "won"), false);
});

import { splitInstallments } from "./index.js";
test("installments sum to total", () => {
  const parts = splitInstallments(money(1000001), 3, new Date("2026-01-05"), () => "00000000-0000-0000-0000-000000000000");
  assert.equal(parts.reduce((s, p) => s + p.amount.amount, 0), 1000001);
  assert.equal(parts.length, 3);
});

import { renderTemplate } from "./index.js";
test("template render", () => {
  assert.equal(renderTemplate("Call {name} ({stage})", { name: "Rahim", stage: "new" }), "Call Rahim (new)");
  assert.equal(renderTemplate("Hi {missing}", {}), "Hi ");
});
