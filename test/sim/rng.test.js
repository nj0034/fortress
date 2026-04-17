import test from "node:test";
import assert from "node:assert/strict";
import { mulberry32, createPurposeRng } from "../../src/sim/rng.js";

test("mulberry32 is deterministic given a seed", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test("mulberry32 outputs are in [0, 1)", () => {
  const r = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test("createPurposeRng derives different streams per purpose", () => {
  const terrain = createPurposeRng("match-abc", "terrain");
  const wind = createPurposeRng("match-abc", "wind");
  const t0 = terrain();
  const w0 = wind();
  assert.notEqual(t0, w0);
});

test("createPurposeRng is reproducible for same (seed, purpose)", () => {
  const a = createPurposeRng("match-abc", "terrain");
  const b = createPurposeRng("match-abc", "terrain");
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});
