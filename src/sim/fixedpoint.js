export const FP_SCALE = 256;

export function toFP(value) {
  return (value * FP_SCALE) | 0;
}

export function fromFP(fp) {
  return fp / FP_SCALE;
}

export function mulFP(a, b) {
  return ((a * b) / FP_SCALE) | 0;
}

const SIN_TABLE = new Int16Array(361);
for (let d = 0; d <= 360; d++) {
  SIN_TABLE[d] = Math.round(Math.sin((d * Math.PI) / 180) * FP_SCALE);
}

function wrapDeg(d) {
  let w = d % 360;
  if (w < 0) w += 360;
  return w;
}

export function sinFP(degrees) {
  return SIN_TABLE[wrapDeg(degrees | 0)];
}

export function cosFP(degrees) {
  return SIN_TABLE[wrapDeg((degrees | 0) + 90)];
}
