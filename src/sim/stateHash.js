import { hashString } from "../util/text.js";

const FNV_PRIME = 16777619;
const FNV_OFFSET = 2166136261;

export function hashUint8Array(bytes) {
  let h = FNV_OFFSET >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function hashPlayerStates(players) {
  const sorted = [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let h = FNV_OFFSET >>> 0;
  for (const p of sorted) {
    h = Math.imul(h ^ hashString(p.id), FNV_PRIME) >>> 0;
    h = Math.imul(h ^ (p.hp | 0), FNV_PRIME) >>> 0;
    h = Math.imul(h ^ (p.accumulatedDelay | 0), FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function combineHashes(...hashes) {
  let h = FNV_OFFSET >>> 0;
  for (const x of hashes) {
    h = Math.imul(h ^ ((x | 0) >>> 0), FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}
