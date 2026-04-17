# QoL Fixes (Colors · Projectiles · Chat · IME · Tank Foot) Design

**날짜**: 2026-04-17
**배경**: Phase 1/2 후 플레이 테스트에서 발견된 6개 이슈를 한 번에 정리.

---

## 1. 탱크 타입별 고유 색상

**현상**: SVG 렌더러가 `team-primary` 클래스 요소 전부를 팀 팔레트로 덮어써서 FFA에서 모든 탱크가 빨강(=TEAM_COLORS[0])으로 보임.

**수정**:
- FFA(모드 `ffa`): `tank.visual.primaryColor`를 그대로 SVG `team-primary` fill에 주입. 팀 팔레트 무시.
- 팀 모드(team-2v2 / tag-team): `mixColors(tank.visual.primaryColor, team.primary, 0.4)` 블렌드 (탱크 60% + 팀 40%) 사용해 팀 식별 + 탱크 정체성 공존.
- `src/render/tankRender.js`에 `resolveTankFill(match, tank, playerId, joinIndex)` 신규. `renderTankToCanvas` 호출 시 이 결과 사용.

**탱크 고유색 (`src/data/tanks.js` 이미 정의됨)**:
- 아머 `#ffb84f` / 빅포 `#ff6a4b` / 새총 `#9cd8ff` / 디크 `#7ec46b` / 터틀 `#8ed6c2` / 마법사 `#c48cff` / 트리코 `#ffd24b` / A캐논 `#7ddcff` / 라이트닝 `#fff37a` / 아이스 `#b6efff`

## 2. 무기별 포탄 모양

**현상**: `drawProjectile`이 모든 포탄을 단순 원 + 꼬리로 그림.

**수정**: `src/render/projectileRender.js` 신규. `drawProjectile(ctx, projectile)`이 `projectile.weaponId` → 무기 정의의 `fx.shape` 키로 디스패치.

**포탄 모양 카탈로그** (`src/data/weapons.js` 각 무기 `fx.shape` 필드 추가):
- `bullet-round` (단순 원) — armor/bigpo/turtle 기본
- `drill` (원통 + 날) — dike
- `orb` (글로우 구체) — mage
- `crystal` (육각형 결정) — ice
- `zigzag` (번개) — lightning
- `rail` (화살표) — acannon
- `meteor` (돌덩이 + 꼬리 강조) — bigpo_new
- `comet` (원 + 긴 불꽃 꼬리) — slingshot
- `triforce` (3분열 아이콘) — tricot
- `swarm` (여러 점) — mage_new

## 3. 무기 슬롯 → 아이콘 + 툴팁

**현상**: 버튼이 `SS1/SS2/NEW` 텍스트.

**수정**:
- 각 버튼에 24×24 포탄 미니 SVG 렌더 (동일한 `fx.shape` 재사용; 실시간 SVG 생성).
- `title` 속성 대신 커스텀 툴팁(`data-tooltip`) — CSS `::after` hover.
- 툴팁 내용:
  ```
  {name}
  {shotType} | 피해 {damage} | 반경 {radius} | 딜레이 ×{delayMultiplier}
  {설명 1줄}
  ```
- NEW 슬롯의 ❄ 카운터 유지.

## 4. 배틀 채팅 우측 이동

**현상**: `.chat-box-battle` 바닥에 고정.

**수정**:
- `styles.css` `.chat-box-battle`:
  - `position: fixed; right: 12px; bottom: 12px; top: auto; left: auto;`
  - `width: 280px; max-height: 50vh;`
  - `.chat-messages` `max-height: calc(50vh - 60px); overflow-y: auto;`
- 좁은 뷰포트(< 900px)에서는 기존 하단 배치 유지 (반응형 media query).

## 5. 한글 IME 중복 전송

**현상**: 한글 입력 중 Enter → 마지막 글자가 한 번 더 전송.

**원인**: IME composition 완료(마지막 글자 확정) + Enter가 하나의 `keydown` 이벤트로 묶여 처리되면서 composition 종료 후 Enter까지 같이 발동.

**수정**: chat input `keydown` 핸들러 맨 앞에:
```js
if (e.isComposing || e.keyCode === 229) return;
```
- `isComposing`: 모던 브라우저 표준
- `keyCode === 229`: 구형 브라우저/일부 조합 안전망

## 6. 탱크가 땅 위에 뜸

**현상**: 탱크 발 밑이 지형 표면 위에 미세한 갭.

**원인**: `getGroundYForPlayer`가 `terrainY - 17`. 탱크 SVG의 바닥(y=120) 과 중심(y=70 가정) 차이가 실제로는 ~22 인데 17로 하드코딩되어 5px 가량 뜸.

**수정**:
- `src/config.js`에 `TANK_FOOT_OFFSET = 21` 상수 추가 (`TANK_RADIUS`와 일치시켜 탱크 바디 반경만큼 올림).
- `getGroundYForPlayer`에서 `terrainY - 17` → `terrainY - TANK_FOOT_OFFSET`.
- `reflowPlayersOntoTerrain` fallback도 동일 값 사용.

---

## 인수 기준

- [ ] 10종 탱크가 각각 고유색으로 FFA에서 구분됨
- [ ] 무기 10종의 포탄이 모양별로 시각 구분됨
- [ ] 무기 슬롯에 포탄 아이콘 표시 + 호버 툴팁
- [ ] 배틀 채팅이 우측 고정, 반응형 하단 폴백
- [ ] 한글 입력 + Enter 시 마지막 글자 중복 없음
- [ ] 탱크 바디 바닥이 지형 표면에 정확히 닿음

## Out-of-Scope

- 무기 아이콘 커스텀 아트워크 — 간단 벡터 도형으로 충분
- 툴팁 i18n — 한국어 고정
- 채팅 이모지 / 리액션
