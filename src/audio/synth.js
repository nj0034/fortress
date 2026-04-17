/**
 * Procedural synth — Plan I §7.
 * AudioContext oscillator + ADSR gain envelope.
 * Node-safe: all AudioContext operations guard on context !== null.
 */

/**
 * Validate a recipe object shape.
 * @param {*} recipe
 * @returns {boolean}
 */
export function isValidRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return false;
  const { freq, duration, type, envelope } = recipe;
  if (typeof freq !== "number" || freq <= 0) return false;
  if (typeof duration !== "number" || duration <= 0) return false;
  if (typeof type !== "string") return false;
  if (!envelope || typeof envelope !== "object") return false;
  const { attack, decay, sustain, release } = envelope;
  if (typeof attack !== "number") return false;
  if (typeof decay !== "number") return false;
  if (typeof sustain !== "number") return false;
  if (typeof release !== "number") return false;
  return true;
}

/**
 * Play a single sound recipe via the given AudioContext.
 * No-op when context is null (Node/test safe).
 *
 * @param {{ freq, duration, type, envelope: { attack, decay, sustain, release } }} recipe
 * @param {number} volume  0..1 effective volume
 * @param {AudioContext|null} context
 */
export function synth(recipe, volume, context) {
  if (!context || !isValidRecipe(recipe)) return;

  const { freq, duration, type, envelope } = recipe;
  const { attack, decay, sustain, release } = envelope;

  try {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // ADSR envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
    gain.gain.setValueAtTime(volume * sustain, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  } catch (_) {
    // Silently swallow AudioContext errors (e.g. context suspended)
  }
}

/**
 * Create a synth player bound to a context.
 * Returns a play(recipe, volume) function.
 *
 * @param {AudioContext|null} context
 * @returns {{ play: (recipe: object, volume: number) => void }}
 */
export function createSynthPlayer(context) {
  return {
    play(recipe, volume) {
      synth(recipe, volume, context);
    },
  };
}
