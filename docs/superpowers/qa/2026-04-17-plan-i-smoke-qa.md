# Plan I — Smoke QA Checklist

> Manual verification checklist for Plan I (Hit Feedback & Sound).

## Audio

- [ ] **Fire** — firing any weapon plays the fire sound
- [ ] **Hit** — landing a hit on an enemy plays the hit sound
- [ ] **Hit-Critical** — landing a critical hit plays the hit-critical sound (louder/higher)
- [ ] **Explode** — explosion plays the explode sound on every detonation
- [ ] **Freeze** — ice weapon hitting a tank plays the freeze sound
- [ ] **Pickup/Item** — using an item plays appropriate sound (teleport/shield/double-shot/repair/gravity or generic pickup)
- [ ] **Turn-start** — each new turn plays the turn-start sound
- [ ] **Victory** — local winner hears the victory sound on game end
- [ ] **Defeat** — local loser hears the defeat sound on game end
- [ ] **Ping** — right-clicking the map plays the ping sound

## Audio Settings

- [ ] **Volume slider** — present in both lobby header and battle HUD
- [ ] **Volume attenuation** — dragging slider down reduces audible volume
- [ ] **Mute toggle** — clicking mute button silences all sounds
- [ ] **Persistence** — volume and mute state survive page reload (localStorage)
- [ ] **Autoplay** — audio boots silently on first user gesture; no browser error

## Visual Feedback

- [ ] **Float text spawns** — every non-miss hit spawns a floating label above the target
- [ ] **Critical label** — critical hits show "CRITICAL! <damage>" in red with size 22
- [ ] **Aerial label** — aerial hits show "AERIAL! <damage>" in orange
- [ ] **Pierce label** — pierce non-final hits show "PIERCE <damage>" in blue
- [ ] **Normal label** — regular hits show "HIT <damage>" in white
- [ ] **Float rise + fade** — labels rise upward and fade out over ~36 frames
- [ ] **Screen shake** — critical hit triggers a 6-frame screen shake

## Determinism

- [ ] **Same seed → same HP** — two runs with identical seed produce identical health outcomes
- [ ] **Shake is render-only** — shake pattern may differ between peers; does not affect state hash
- [ ] **State hash stable** — `game.floatTexts`, `game.shake`, `game.hitEvents` are NOT included in stateHash (verified in src/sim/stateHash.js)

## Regression

- [ ] **339 base tests pass** — all pre-Plan-I tests still pass
- [ ] **New tests pass** — 411+ total tests pass with 0 failures
- [ ] **Team-kill prevention** — friendly-fire still produces 0 damage (reason: teamkill-prevented)
- [ ] **Frozen status delay** — ice weapons still apply turn delay on enemy hit
