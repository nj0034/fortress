import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveIconList } from "../../src/ui/statusIcons.js";

describe("resolveIconList", () => {
  it("maps frozen status to snowflake icon with delayBonus label", () => {
    const result = resolveIconList([{ type: "frozen", delayBonus: 200 }]);
    assert.equal(result.length, 1);
    assert.equal(result[0].glyph, "❄");
    assert.equal(result[0].label, "+200");
    assert.equal(result[0].color, "#8fd7ff");
  });

  it("skips unknown status types", () => {
    const result = resolveIconList([{ type: "unknown_effect", delayBonus: 50 }]);
    assert.equal(result.length, 0);
  });

  it("returns empty array for empty statuses", () => {
    const result = resolveIconList([]);
    assert.deepEqual(result, []);
  });

  it("handles multiple statuses including mixed known/unknown", () => {
    const result = resolveIconList([
      { type: "frozen", delayBonus: 100 },
      { type: "mystery", delayBonus: 50 },
      { type: "frozen", delayBonus: 300 },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].label, "+100");
    assert.equal(result[1].label, "+300");
  });
});
