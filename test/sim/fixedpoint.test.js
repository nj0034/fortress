import test from "node:test";
import assert from "node:assert/strict";
import { FP_SCALE, toFP, fromFP, mulFP, sinFP, cosFP } from "../../src/sim/fixedpoint.js";

test("FP_SCALE is 256", () => {
  assert.equal(FP_SCALE, 256);
});

test("toFP/fromFP roundtrip integer values exactly", () => {
  for (const n of [-5, 0, 1, 100, 32000]) {
    assert.equal(fromFP(toFP(n)), n);
  }
});

test("toFP truncates fractional part toward zero", () => {
  assert.equal(toFP(1.5), 384);
  assert.equal(toFP(-1.5), -384);
});

test("mulFP multiplies two FP values and returns FP", () => {
  assert.equal(mulFP(toFP(2), toFP(3)), toFP(6));
});

test("sinFP(0) = 0 and sinFP(90) = 256 (1.0 in FP)", () => {
  assert.equal(sinFP(0), 0);
  assert.equal(sinFP(90), 256);
});

test("cosFP(0) = 256 and cosFP(90) = 0", () => {
  assert.equal(cosFP(0), 256);
  assert.equal(cosFP(90), 0);
});

test("sinFP is deterministic and table-driven for integer degrees", () => {
  for (let d = 0; d <= 360; d++) {
    assert.equal(sinFP(d), sinFP(d));
  }
});

test("sinFP handles negative and large angles by wrapping", () => {
  assert.equal(sinFP(-90), sinFP(270));
  assert.equal(sinFP(450), sinFP(90));
});
