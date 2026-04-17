export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(value) {
  return (value * Math.PI) / 180;
}

export function wrapAngleRadians(value) {
  let angle = value;
  while (angle <= -Math.PI) {
    angle += Math.PI * 2;
  }
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  return angle;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
