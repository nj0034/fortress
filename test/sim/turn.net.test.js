import test from "node:test";
import assert from "node:assert/strict";
import { createTurnManager, pickNextTurn, applyAction, snapshot } from "../../src/sim/turn.js";

test("serialized snapshot on a peer yields same pickNextTurn", () => {
  const tanks = [
    { id: "p1", baseDelay: 720 },
    { id: "p2", baseDelay: 660 },
    { id: "p3", baseDelay: 840 },
  ];
  const host = createTurnManager(tanks);
  applyAction(host, { tankId: "p2", actionType: "ss2" });
  applyAction(host, { tankId: "p1", actionType: "move", fuelUsed: 40 });
  const wire = JSON.parse(JSON.stringify(snapshot(host)));
  // Simulate peer rehydration
  const peer = createTurnManager(tanks);
  peer.tanks = wire.tanks.map((t) => ({ ...t }));
  peer.pendingStatuses = wire.pendingStatuses;
  assert.equal(pickNextTurn(peer), pickNextTurn(host));
});
