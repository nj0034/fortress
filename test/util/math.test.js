import test from "node:test";
import assert from "node:assert/strict";
import { clamp, lerp, degToRad, wrapAngleRadians, distance } from "../../src/util/math.js";

test("clamp bounds value", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test("lerp interpolates linearly", () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test("degToRad converts degrees to radians", () => {
  assert.ok(Math.abs(degToRad(180) - Math.PI) < 1e-10);
  assert.equal(degToRad(0), 0);
});

test("wrapAngleRadians returns value in [-PI, PI]", () => {
  const r = wrapAngleRadians(3 * Math.PI);
  assert.ok(r > -Math.PI && r <= Math.PI);
});

test("distance computes euclidean distance", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});
