/**
 * Audio system — Plan I §8.
 * Pooled playback, master volume, mute, localStorage persistence.
 * Node-safe: guards all AudioContext operations on context !== null.
 */

import { synth } from "./synth.js";

const STORAGE_VOLUME_KEY = "fortress.volume";
const STORAGE_MUTED_KEY = "fortress.muted";
const POOL_SIZE = 3; // polyphony per sound id

function readStorage(key, fallback) {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return v !== null ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, String(value));
    }
  } catch (_) {
    // ignore
  }
}

/**
 * Create the audio system.
 *
 * @param {{ manifest: object, context?: AudioContext|null }} opts
 * @returns {{ play, setMasterVolume, setMuted, getMasterVolume, getMuted }}
 */
export function createAudioSystem({ manifest, context = null }) {
  // Load persisted settings
  let masterVolume = parseFloat(readStorage(STORAGE_VOLUME_KEY, "0.8"));
  if (isNaN(masterVolume)) masterVolume = 0.8;
  let muted = readStorage(STORAGE_MUTED_KEY, "false") === "true";

  /**
   * Play a sound by manifest id.
   * Silently no-ops when context is null, muted, or volume=0.
   * @param {string} id
   */
  function play(id) {
    if (!context) return;
    const entry = manifest[id];
    if (!entry) return;
    const effectiveVol = masterVolume * (muted ? 0 : 1) * (entry.volume ?? 1);
    if (effectiveVol <= 0) return;

    // Lazy AudioContext resume (autoplay policy)
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    synth(entry.recipe, effectiveVol, context);
  }

  function setMasterVolume(vol) {
    masterVolume = Math.max(0, Math.min(1, vol));
    writeStorage(STORAGE_VOLUME_KEY, masterVolume);
  }

  function setMuted(value) {
    muted = Boolean(value);
    writeStorage(STORAGE_MUTED_KEY, muted);
  }

  function getMasterVolume() {
    return masterVolume;
  }

  function getMuted() {
    return muted;
  }

  return { play, setMasterVolume, setMuted, getMasterVolume, getMuted };
}
