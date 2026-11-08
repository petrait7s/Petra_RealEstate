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
