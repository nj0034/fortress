import { test } from "node:test";
import assert from "node:assert/strict";
import { synth, isValidRecipe, createSynthPlayer } from "../../src/audio/synth.js";

const VALID_RECIPE = {
  freq: 440, duration: 0.3, type: "sine",
  envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.2 },
};

// ── isValidRecipe ─────────────────────────────────────────────────────────────

test("isValidRecipe: returns true for valid recipe", () => {
  assert.equal(isValidRecipe(VALID_RECIPE), true);
});

test("isValidRecipe: returns false for null", () => {
  assert.equal(isValidRecipe(null), false);
});

test("isValidRecipe: returns false when freq missing", () => {
  const r = { ...VALID_RECIPE, freq: undefined };
  assert.equal(isValidRecipe(r), false);
});

test("isValidRecipe: returns false when freq <= 0", () => {
  assert.equal(isValidRecipe({ ...VALID_RECIPE, freq: 0 }), false);
});

test("isValidRecipe: returns false when duration missing", () => {
  assert.equal(isValidRecipe({ ...VALID_RECIPE, duration: undefined }), false);
});

test("isValidRecipe: returns false when envelope missing", () => {
  assert.equal(isValidRecipe({ ...VALID_RECIPE, envelope: null }), false);
});

test("isValidRecipe: returns false when envelope.attack missing", () => {
  const r = { ...VALID_RECIPE, envelope: { ...VALID_RECIPE.envelope, attack: undefined } };
  assert.equal(isValidRecipe(r), false);
});

// ── synth — no-op when context null ──────────────────────────────────────────

test("synth: no-op when context is null (Node-safe)", () => {
  assert.doesNotThrow(() => synth(VALID_RECIPE, 0.5, null));
});

test("synth: no-op when context is undefined", () => {
  assert.doesNotThrow(() => synth(VALID_RECIPE, 0.5, undefined));
});

test("synth: no-op when recipe is invalid", () => {
  const ctx = { createOscillator: () => { throw new Error("should not call"); } };
  assert.doesNotThrow(() => synth(null, 0.5, ctx));
});

// ── synth — with mock context ─────────────────────────────────────────────────

test("synth: calls createOscillator and createGain when context provided", () => {
  let oscCreated = false;
  let gainCreated = false;
  const mockOsc = {
    type: null,
    frequency: { setValueAtTime: () => {} },
    connect: () => {},
    start: () => {},
    stop: () => {},
  };
  const mockGain = {
    gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
    connect: () => {},
  };
  const mockCtx = {
    currentTime: 0,
    createOscillator: () => { oscCreated = true; return mockOsc; },
    createGain: () => { gainCreated = true; return mockGain; },
    destination: {},
  };
  synth(VALID_RECIPE, 0.5, mockCtx);
  assert.equal(oscCreated, true, "createOscillator should have been called");
  assert.equal(gainCreated, true, "createGain should have been called");
});

test("synth: sets oscillator type from recipe", () => {
  let setType = null;
  const mockOsc = {
    get type() { return setType; },
    set type(v) { setType = v; },
    frequency: { setValueAtTime: () => {} },
    connect: () => {},
    start: () => {},
    stop: () => {},
  };
  const mockGain = {
    gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
    connect: () => {},
  };
  const mockCtx = {
    currentTime: 0,
    createOscillator: () => mockOsc,
    createGain: () => mockGain,
    destination: {},
  };
  synth({ ...VALID_RECIPE, type: "sawtooth" }, 0.5, mockCtx);
  assert.equal(setType, "sawtooth");
});

// ── createSynthPlayer ─────────────────────────────────────────────────────────

test("createSynthPlayer: returns object with play function", () => {
  const player = createSynthPlayer(null);
  assert.ok(typeof player.play === "function");
});

test("createSynthPlayer: play no-ops with null context", () => {
  const player = createSynthPlayer(null);
  assert.doesNotThrow(() => player.play(VALID_RECIPE, 0.5));
});
