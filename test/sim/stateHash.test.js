import test from "node:test";
import assert from "node:assert/strict";
import {
  hashUint8Array,
  hashPlayerStates,
  combineHashes,
} from "../../src/sim/stateHash.js";

test("hashUint8Array is deterministic", () => {
  const a = new Uint8Array([1, 2, 3, 4, 5]);
  const b = new Uint8Array([1, 2, 3, 4, 5]);
  assert.equal(hashUint8Array(a), hashUint8Array(b));
});

test("hashUint8Array differs when any byte changes", () => {
  const a = new Uint8Array([1, 2, 3, 4, 5]);
  const b = new Uint8Array([1, 2, 3, 4, 6]);
  assert.notEqual(hashUint8Array(a), hashUint8Array(b));
});

test("hashPlayerStates captures id, hp, accumulatedDelay", () => {
  const players = [
    { id: "p1", hp: 100, accumulatedDelay: 0 },
    { id: "p2", hp: 80, accumulatedDelay: 720 },
  ];
  const other = [
    { id: "p1", hp: 100, accumulatedDelay: 0 },
    { id: "p2", hp: 79, accumulatedDelay: 720 },
  ];
  assert.equal(hashPlayerStates(players), hashPlayerStates(players));
  assert.notEqual(hashPlayerStates(players), hashPlayerStates(other));
});

test("hashPlayerStates is order-independent", () => {
  const a = [
    { id: "p1", hp: 100, accumulatedDelay: 0 },
    { id: "p2", hp: 80, accumulatedDelay: 720 },
  ];
  const b = [a[1], a[0]];
  assert.equal(hashPlayerStates(a), hashPlayerStates(b));
});

test("combineHashes is deterministic", () => {
  assert.equal(combineHashes(1, 2, 3), combineHashes(1, 2, 3));
  assert.notEqual(combineHashes(1, 2, 3), combineHashes(3, 2, 1));
});

test("hashPlayerStates is sensitive to accumulatedDelay", () => {
  const a = [{ id: "p1", hp: 100, accumulatedDelay: 0 }, { id: "p2", hp: 100, accumulatedDelay: 0 }];
  const b = [{ id: "p1", hp: 100, accumulatedDelay: 100 }, { id: "p2", hp: 100, accumulatedDelay: 0 }];
  assert.notEqual(hashPlayerStates(a), hashPlayerStates(b));
});

test("hashPlayerStates is id-order-stable", () => {
  const a = [{ id: "a", hp: 1, accumulatedDelay: 10 }, { id: "b", hp: 2, accumulatedDelay: 20 }];
  const b = [{ id: "b", hp: 2, accumulatedDelay: 20 }, { id: "a", hp: 1, accumulatedDelay: 10 }];
  assert.equal(hashPlayerStates(a), hashPlayerStates(b));
});

// Plan G: inventory fields included in hash
test("hashPlayerStates changes when inventory changes", () => {
  const base = [{ id: "p1", hp: 100, accumulatedDelay: 0, inventory: [] }];
  const withItem = [{ id: "p1", hp: 100, accumulatedDelay: 0, inventory: ["repair_kit"] }];
  assert.notEqual(hashPlayerStates(base), hashPlayerStates(withItem));
});

test("hashPlayerStates changes when shieldCharges changes", () => {
  const a = [{ id: "p1", hp: 100, accumulatedDelay: 0, shieldCharges: 0 }];
  const b = [{ id: "p1", hp: 100, accumulatedDelay: 0, shieldCharges: 1 }];
  assert.notEqual(hashPlayerStates(a), hashPlayerStates(b));
});

test("hashPlayerStates changes when gravityOverride changes", () => {
  const a = [{ id: "p1", hp: 100, accumulatedDelay: 0, gravityOverride: 0 }];
  const b = [{ id: "p1", hp: 100, accumulatedDelay: 0, gravityOverride: -600 }];
  assert.notEqual(hashPlayerStates(a), hashPlayerStates(b));
});

test("hashPlayerStates changes when doubleShotPending changes", () => {
  const a = [{ id: "p1", hp: 100, accumulatedDelay: 0, doubleShotPending: false }];
  const b = [{ id: "p1", hp: 100, accumulatedDelay: 0, doubleShotPending: true }];
  assert.notEqual(hashPlayerStates(a), hashPlayerStates(b));
});

test("hashPlayerStates: players without inventory field hash same as empty inventory", () => {
  const a = [{ id: "p1", hp: 100, accumulatedDelay: 0 }];
  const b = [{ id: "p1", hp: 100, accumulatedDelay: 0, inventory: [], shieldCharges: 0, gravityOverride: 0, doubleShotPending: false }];
  assert.equal(hashPlayerStates(a), hashPlayerStates(b));
});
