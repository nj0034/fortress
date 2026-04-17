/**
 * Screen shake — Plan I §5.
 * Pure functions; draw loop applies offset then ticks.
 */

/**
 * Advance screen shake by one frame.
 * Returns null when shake is done.
 *
 * @param {{ frames: number, amplitude: number }|null} shake
 * @returns {{ frames: number, amplitude: number }|null}
 */
export function tickShake(shake) {
  if (!shake || shake.frames <= 0) return null;
  const frames = shake.frames - 1;
  if (frames <= 0) return null;
  return { frames, amplitude: shake.amplitude };
}

/**
 * Translate ctx by a pseudo-random shake offset within amplitude bounds.
 * Uses a simple seeded-style hash from `frames` so shake is deterministic
 * within a frame but varies each frame — no Math.random dependency for tests.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ frames: number, amplitude: number }|null} shake
 */
export function applyShakeOffset(ctx, shake) {
  if (!shake || shake.frames <= 0) return;
  const { amplitude, frames } = shake;
  // Simple frame-based oscillation — no Math.random
  const dx = amplitude * Math.sin(frames * 2.3);
  const dy = amplitude * Math.cos(frames * 1.7);
  ctx.translate(dx, dy);
}
