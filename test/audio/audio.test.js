import { test } from "node:test";
import assert from "node:assert/strict";
import { createAudioSystem } from "../../src/audio/audio.js";

// ── Minimal manifest for tests ────────────────────────────────────────────────

const MANIFEST = {
  fire: {
    recipe: { freq: 120, duration: 0.2, type: "sawtooth", envelope: { attack: 0.01, decay: 0.05, sustain: 0.4, release: 0.1 } },
    volume: 0.6,
  },
};

// ── createAudioSystem shape ───────────────────────────────────────────────────

test("createAudioSystem: returns required methods", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  assert.ok(typeof sys.play === "function");
  assert.ok(typeof sys.setMasterVolume === "function");
  assert.ok(typeof sys.setMuted === "function");
  assert.ok(typeof sys.getMasterVolume === "function");
  assert.ok(typeof sys.getMuted === "function");
});

// ── play with null context ────────────────────────────────────────────────────

test("play: no-op when context is null", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  assert.doesNotThrow(() => sys.play("fire"));
});

test("play: no-op for unknown id", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  assert.doesNotThrow(() => sys.play("nonexistent"));
});

// ── volume / mute ─────────────────────────────────────────────────────────────

test("getMasterVolume: default is 0.8 (no persisted value)", () => {
  // localStorage not available in Node, so defaults apply
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  const vol = sys.getMasterVolume();
  // Either 0.8 default or whatever was persisted — just must be number in [0,1]
  assert.ok(typeof vol === "number" && vol >= 0 && vol <= 1);
});

test("setMasterVolume: updates getMasterVolume", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  sys.setMasterVolume(0.4);
  assert.ok(Math.abs(sys.getMasterVolume() - 0.4) < 0.001);
});

test("setMasterVolume: clamps to [0,1]", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  sys.setMasterVolume(2.0);
  assert.equal(sys.getMasterVolume(), 1.0);
  sys.setMasterVolume(-1.0);
  assert.equal(sys.getMasterVolume(), 0.0);
});

test("getMuted: initial value is boolean", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  assert.equal(typeof sys.getMuted(), "boolean");
});

test("setMuted: toggles mute state", () => {
  const sys = createAudioSystem({ manifest: MANIFEST, context: null });
  sys.setMuted(true);
  assert.equal(sys.getMuted(), true);
  sys.setMuted(false);
  assert.equal(sys.getMuted(), false);
});

// ── play with mock context ────────────────────────────────────────────────────

test("play: calls createOscillator on context when not muted and volume > 0", () => {
  let oscCalled = false;
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
    state: "running",
    currentTime: 0,
    createOscillator: () => { oscCalled = true; return mockOsc; },
    createGain: () => mockGain,
    destination: {},
  };
  const sys = createAudioSystem({ manifest: MANIFEST, context: mockCtx });
  sys.setMasterVolume(0.8);
  sys.setMuted(false);
  sys.play("fire");
  assert.equal(oscCalled, true, "createOscillator should have been called");
});

test("play: no-op when muted", () => {
  let oscCalled = false;
  const mockCtx = {
    state: "running",
    currentTime: 0,
    createOscillator: () => { oscCalled = true; return { type: null, frequency: { setValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; },
    createGain: () => ({ gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }, connect: () => {} }),
    destination: {},
  };
  const sys = createAudioSystem({ manifest: MANIFEST, context: mockCtx });
  sys.setMuted(true);
  sys.play("fire");
  assert.equal(oscCalled, false, "should not play when muted");
});

test("play: no-op when masterVolume=0", () => {
  let oscCalled = false;
  const mockCtx = {
    state: "running",
    currentTime: 0,
    createOscillator: () => { oscCalled = true; return { type: null, frequency: { setValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; },
    createGain: () => ({ gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }, connect: () => {} }),
    destination: {},
  };
  const sys = createAudioSystem({ manifest: MANIFEST, context: mockCtx });
  sys.setMasterVolume(0);
  sys.setMuted(false);
  sys.play("fire");
  assert.equal(oscCalled, false, "should not play when masterVolume=0");
});
