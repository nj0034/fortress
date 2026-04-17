import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUND_MANIFEST, REQUIRED_SOUND_IDS } from "../../src/data/sounds.js";

test("SOUND_MANIFEST: all required ids are present", () => {
  for (const id of REQUIRED_SOUND_IDS) {
    assert.ok(id in SOUND_MANIFEST, `Missing sound id: ${id}`);
  }
});

test("SOUND_MANIFEST: each entry has recipe + volume", () => {
  for (const [id, entry] of Object.entries(SOUND_MANIFEST)) {
    assert.ok(entry.recipe, `${id}: missing recipe`);
    assert.ok(typeof entry.volume === "number", `${id}: volume not a number`);
    assert.ok(entry.volume >= 0 && entry.volume <= 1, `${id}: volume out of [0,1]`);
  }
});

test("SOUND_MANIFEST: each recipe has freq, duration, type, envelope", () => {
  for (const [id, entry] of Object.entries(SOUND_MANIFEST)) {
    const r = entry.recipe;
    assert.ok(typeof r.freq === "number" && r.freq > 0, `${id}: invalid freq`);
    assert.ok(typeof r.duration === "number" && r.duration > 0, `${id}: invalid duration`);
    assert.ok(typeof r.type === "string", `${id}: type not string`);
    assert.ok(r.envelope && typeof r.envelope === "object", `${id}: missing envelope`);
    const { attack, decay, sustain, release } = r.envelope;
    assert.ok(typeof attack === "number", `${id}: invalid attack`);
    assert.ok(typeof decay === "number", `${id}: invalid decay`);
    assert.ok(typeof sustain === "number", `${id}: invalid sustain`);
    assert.ok(typeof release === "number", `${id}: invalid release`);
  }
});

test("REQUIRED_SOUND_IDS: covers fire, hit, hit-critical, explode, freeze, pickup, teleport, shield, double-shot, repair, gravity, ping, turn-start, ui-click, victory, defeat", () => {
  const expected = ["fire", "hit", "hit-critical", "explode", "freeze", "pickup", "teleport", "shield", "double-shot", "repair", "gravity", "ping", "turn-start", "ui-click", "victory", "defeat"];
  for (const id of expected) {
    assert.ok(REQUIRED_SOUND_IDS.includes(id), `Missing from REQUIRED_SOUND_IDS: ${id}`);
  }
});
