import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTurnOrderView } from "../../src/ui/turnOrder.js";

function makeManager(tankDefs) {
  return {
    tanks: tankDefs.map((t) => ({
      id: t.id,
      name: t.name ?? t.id,
      tankTypeId: t.tankTypeId ?? "armor",
      baseDelay: t.baseDelay ?? 100,
      accumulatedDelay: t.accumulatedDelay ?? 0,
      alive: t.alive ?? true,
    })),
    pendingStatuses: {},
    history: [],
  };
}

describe("buildTurnOrderView", () => {
  it("returns up to n entries sorted ascending by accumulatedDelay", () => {
    const mgr = makeManager([
      { id: "a", accumulatedDelay: 300 },
      { id: "b", accumulatedDelay: 100 },
      { id: "c", accumulatedDelay: 200 },
      { id: "d", accumulatedDelay: 400 },
    ]);
    const view = buildTurnOrderView(mgr, 3);
    assert.equal(view.length, 3);
    assert.equal(view[0].tankId, "b");
    assert.equal(view[1].tankId, "c");
    assert.equal(view[2].tankId, "a");
  });

  it("first entry has isActive: true, rest false", () => {
    const mgr = makeManager([
      { id: "x", accumulatedDelay: 10 },
      { id: "y", accumulatedDelay: 20 },
    ]);
    const view = buildTurnOrderView(mgr, 4);
    assert.equal(view[0].isActive, true);
    assert.equal(view[1].isActive, false);
  });

  it("delayBarPct normalized 0-100 relative to max in window", () => {
    const mgr = makeManager([
      { id: "a", accumulatedDelay: 0 },
      { id: "b", accumulatedDelay: 200 },
    ]);
    const view = buildTurnOrderView(mgr, 4);
    assert.equal(view[0].delayBarPct, 0);
    assert.equal(view[1].delayBarPct, 100);
  });

  it("handles n=0 gracefully", () => {
    const mgr = makeManager([{ id: "a" }]);
    const view = buildTurnOrderView(mgr, 0);
    assert.equal(view.length, 0);
  });

  it("handles single tank manager", () => {
    const mgr = makeManager([{ id: "solo", accumulatedDelay: 50 }]);
    const view = buildTurnOrderView(mgr, 4);
    assert.equal(view.length, 1);
    assert.equal(view[0].isActive, true);
    assert.equal(view[0].delayBarPct, 0);
  });

  it("excludes dead tanks", () => {
    const mgr = makeManager([
      { id: "alive", accumulatedDelay: 10, alive: true },
      { id: "dead", accumulatedDelay: 5, alive: false },
    ]);
    const view = buildTurnOrderView(mgr, 4);
    assert.equal(view.length, 1);
    assert.equal(view[0].tankId, "alive");
  });

  it("includes tankTypeId and name in each entry", () => {
    const mgr = makeManager([
      { id: "t1", name: "Tank A", tankTypeId: "turtle", accumulatedDelay: 0 },
    ]);
    const view = buildTurnOrderView(mgr, 4);
    assert.equal(view[0].name, "Tank A");
    assert.equal(view[0].tankTypeId, "turtle");
  });
});
