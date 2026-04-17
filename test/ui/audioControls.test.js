import { test } from "node:test";
import assert from "node:assert/strict";
import { mountAudioControls } from "../../src/ui/audioControls.js";

// ── Minimal audio stub ────────────────────────────────────────────────────────

function makeAudio(initialVol = 0.8, initialMuted = false) {
  let vol = initialVol;
  let muted = initialMuted;
  return {
    getMasterVolume: () => vol,
    getMuted: () => muted,
    setMasterVolume: (v) => { vol = Math.max(0, Math.min(1, v)); },
    setMuted: (m) => { muted = Boolean(m); },
  };
}

// ── Minimal DOM stub ──────────────────────────────────────────────────────────

class MockElement {
  constructor(tag = "div") {
    this.tag = tag;
    this._innerHTML = "";
    this._children = [];
    this._listeners = {};
    this._attrs = {};
    this._value = "";
    this.textContent = "";
  }

  set innerHTML(html) {
    this._innerHTML = html;
    // Build minimal child structure from the HTML
    this._children = [];
    this._parsedHtml = html;
  }

  get innerHTML() { return this._innerHTML; }

  querySelector(sel) {
    // Return a mock element for recognized selectors
    if (!this._parsedHtml) return null;
    if (!this._parsedHtml.includes(sel.replace(".", "").replace("-btn", "btn").replace(".audio-", ""))) {
      // loose match: check if the class name appears in html
    }
    const el = new MockElement();
    el._selector = sel;
    el._attrs = {};
    el.textContent = "";
    el._value = sel.includes("slider") ? "0.8" : "0";
    el.addEventListener = (ev, fn) => {
      el._listeners[ev] = el._listeners[ev] || [];
      el._listeners[ev].push(fn);
    };
    el.getAttribute = (k) => el._attrs[k];
    el.setAttribute = (k, v) => { el._attrs[k] = v; };
    el._trigger = (ev) => {
      (el._listeners[ev] || []).forEach((fn) => fn());
    };
    this._children.push(el);
    return el;
  }

  addEventListener(ev, fn) {
    this._listeners[ev] = this._listeners[ev] || [];
    this._listeners[ev].push(fn);
  }

  get value() { return this._value; }
  set value(v) { this._value = v; }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("mountAudioControls: no-op when root is null", () => {
  const audio = makeAudio();
  assert.doesNotThrow(() => mountAudioControls(null, audio));
});

test("mountAudioControls: no-op when audio is null", () => {
  const root = new MockElement();
  assert.doesNotThrow(() => mountAudioControls(root, null));
});

test("mountAudioControls: sets innerHTML on root", () => {
  const root = new MockElement();
  const audio = makeAudio();
  mountAudioControls(root, audio);
  assert.ok(root.innerHTML.includes("audio-controls"), "should render audio-controls class");
  assert.ok(root.innerHTML.includes("audio-volume-slider"), "should render volume slider");
  assert.ok(root.innerHTML.includes("audio-mute-btn"), "should render mute button");
});
