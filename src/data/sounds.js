/**
 * Sound manifest — Plan I §6.
 * Each entry: { recipe: { freq, duration, type, envelope }, volume }
 *
 * recipe fields:
 *   freq      number   base frequency in Hz
 *   duration  number   seconds
 *   type      string   OscillatorType: "sine"|"square"|"sawtooth"|"triangle"
 *   envelope  { attack, decay, sustain, release }  all in seconds
 */

export const SOUND_MANIFEST = {
  fire: {
    recipe: { freq: 120, duration: 0.25, type: "sawtooth", envelope: { attack: 0.01, decay: 0.08, sustain: 0.4, release: 0.15 } },
    volume: 0.6,
  },
  hit: {
    recipe: { freq: 220, duration: 0.18, type: "square", envelope: { attack: 0.005, decay: 0.06, sustain: 0.3, release: 0.12 } },
    volume: 0.5,
  },
  "hit-critical": {
    recipe: { freq: 440, duration: 0.3, type: "square", envelope: { attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.2 } },
    volume: 0.75,
  },
  explode: {
    recipe: { freq: 60, duration: 0.5, type: "sawtooth", envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.3 } },
    volume: 0.8,
  },
  freeze: {
    recipe: { freq: 880, duration: 0.35, type: "sine", envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.2 } },
    volume: 0.55,
  },
  pickup: {
    recipe: { freq: 660, duration: 0.2, type: "sine", envelope: { attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.12 } },
    volume: 0.5,
  },
  teleport: {
    recipe: { freq: 500, duration: 0.4, type: "sine", envelope: { attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.25 } },
    volume: 0.55,
  },
  shield: {
    recipe: { freq: 330, duration: 0.25, type: "triangle", envelope: { attack: 0.01, decay: 0.07, sustain: 0.5, release: 0.15 } },
    volume: 0.5,
  },
  "double-shot": {
    recipe: { freq: 550, duration: 0.2, type: "square", envelope: { attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.12 } },
    volume: 0.5,
  },
  repair: {
    recipe: { freq: 440, duration: 0.3, type: "sine", envelope: { attack: 0.02, decay: 0.08, sustain: 0.6, release: 0.18 } },
    volume: 0.5,
  },
  gravity: {
    recipe: { freq: 200, duration: 0.35, type: "sawtooth", envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.2 } },
    volume: 0.5,
  },
  ping: {
    recipe: { freq: 1000, duration: 0.15, type: "sine", envelope: { attack: 0.005, decay: 0.04, sustain: 0.3, release: 0.1 } },
    volume: 0.4,
  },
  "turn-start": {
    recipe: { freq: 370, duration: 0.2, type: "triangle", envelope: { attack: 0.01, decay: 0.06, sustain: 0.5, release: 0.12 } },
    volume: 0.45,
  },
  "ui-click": {
    recipe: { freq: 800, duration: 0.08, type: "sine", envelope: { attack: 0.002, decay: 0.03, sustain: 0.2, release: 0.05 } },
    volume: 0.35,
  },
  victory: {
    recipe: { freq: 523, duration: 0.6, type: "sine", envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.35 } },
    volume: 0.7,
  },
  defeat: {
    recipe: { freq: 196, duration: 0.7, type: "sawtooth", envelope: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.4 } },
    volume: 0.65,
  },
};

export const REQUIRED_SOUND_IDS = [
  "fire", "hit", "hit-critical", "explode", "freeze", "pickup", "teleport",
  "shield", "double-shot", "repair", "gravity", "ping", "turn-start",
  "ui-click", "victory", "defeat",
];
