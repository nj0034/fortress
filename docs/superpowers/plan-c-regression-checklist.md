# Plan C — Post-Implementation Manual Regression Checklist

## Automated Tests
- `npm test` → 143 pass, 0 fail (as of final commit)
- `node --check app.js` → OK
- `wc -l app.js` → 6019 lines

## Theme Visual Regression (manual)

For each theme: `{coral, mint, amber, mesa, storm, canyonbridge, skyruins, frostmaw}`

- [ ] 4-player match loads, bitmap terrain renders (no blank/black canvas)
- [ ] Fire ≥5 shots, craters appear pixel-correctly (holes in bitmap)
- [ ] Sandfall runs after each crater — no floating islands
- [ ] Tank settles into crater (ground-snap via surfaceYAt)
- [ ] Bridge themes (canyonbridge, skyruins, frostmaw): bridge intact above craters
- [ ] FrostMaw support terrain renders correctly
- [ ] Frame rate ≥55 fps on reference hardware (dirty-rect partial redraw)

## Collision Regression (manual)

- [ ] Tank walks across crater edge — no falling through
- [ ] Projectile hits terrain — crater forms at impact point
- [ ] Projectile passes under bridge without triggering bridge collision
- [ ] Tank on bridge stays on bridge surface

## Network Regression (manual)

- [ ] Host creates room; client joins — terrain bitmap rebuilt from snapshot
- [ ] Both host and client see identical terrain after shot

## Known Manual QA Items Pending

1. Pixel-exact color parity vs. old canvas gradient — acceptable per spec §5 (close but not identical)
2. Mobile memory: 6.9 MB colorBuf + 1.7 MB solid — confirm on low-end mobile
3. Frame time profiling with ≥8 shots in flight simultaneously
