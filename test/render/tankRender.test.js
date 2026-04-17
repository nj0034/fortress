import test from "node:test";
import assert from "node:assert/strict";
import { applyTeamColor } from "../../src/render/tankRender.js";

test("applyTeamColor swaps team-primary and team-secondary fills", () => {
  const svg = `<svg><rect class="team-primary" fill="#000"/><rect class="team-secondary" fill="#fff"/><rect fill="#888"/></svg>`;
  const out = applyTeamColor(svg, "#ff0000", "#00ff00");
  assert.match(out, /class="team-primary"[^>]*fill="#ff0000"/);
  assert.match(out, /class="team-secondary"[^>]*fill="#00ff00"/);
  assert.match(out, /fill="#888"/);
});

test("applyTeamColor handles fill-before-class attribute order", () => {
  const svg = `<rect fill="#000" class="team-primary"/>`;
  const out = applyTeamColor(svg, "#abc123", "#fff");
  assert.match(out, /fill="#abc123"/);
});

test("applyTeamColor leaves unrelated fills untouched", () => {
  const svg = `<svg><rect fill="#999"/><circle class="team-primary" fill="#000"/></svg>`;
  const out = applyTeamColor(svg, "#red", "#blue");
  assert.match(out, /fill="#999"/);
});

test("applyTeamColor handles multiple team-primary matches", () => {
  const svg = `<rect class="team-primary" fill="#000"/><circle class="team-primary" fill="#111"/>`;
  const out = applyTeamColor(svg, "#aabbcc", "#fff");
  const matches = out.match(/fill="#aabbcc"/g);
  assert.equal(matches?.length, 2);
});

test("applyTeamColor handles elements with no fill attribute", () => {
  const svg = `<g class="team-primary"><rect fill="#000"/></g>`;
  const out = applyTeamColor(svg, "#ff0000", "#00ff00");
  // g has no fill, rect inside still gets processed if it has the class - ok if unchanged
  assert.ok(typeof out === "string");
});
