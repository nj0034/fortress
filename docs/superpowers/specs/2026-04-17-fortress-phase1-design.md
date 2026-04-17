# Fortress Relay — Phase 1 설계 문서

**날짜**: 2026-04-17
**대상 코드베이스**: `/Users/nj/NJProjects/fortress` (현 `app.js` 6,036줄, PeerJS 멀티플레이)
**배경**: 현재의 모의 포트리스 게임을 실제 포트리스(CCR Fortress2 Blue) 수준으로 고도화. 로드맵을 Phase 1~4로 쪼개고, 본 문서는 **Phase 1 스펙**만 확정.

---

## 0. 로드맵 개요

| Phase | 테마 |
|---|---|
| **Phase 1** (본 문서) | "진짜 포트리스의 느낌" 기반 — 탱크 10종, 무기 3종, 딜레이 턴, 픽셀 비트맵 지형, SVG 탱크, 결정적 멀티플레이 |
| Phase 2 | 모드 & 아이템 — 인게임 아이템, 태그/팀전, 타격 피드백, 사운드 |
| Phase 3 | 맵 확장 & 심화 — 맵 8+종, 서바이벌/관전, 바람 고도화 |
| Phase 4 (선택) | 메타 — 탱크 해금, 코스튬, 랭킹 |

---

## 1. 아키텍처 개요 & 모듈 분할

현재 `app.js` 단일 파일(6,036줄)을 기능별 모듈로 분리.

```
app.js                      → 부트스트랩만 (100~150줄)
src/
  net/peer.js               PeerJS 래퍼, 커맨드 전송/수신
  net/sync.js               결정적 시뮬 커맨드 큐 & lockstep
  sim/rng.js                시드 기반 결정적 RNG (mulberry32)
  sim/turn.js               딜레이 기반 턴 매니저
  sim/physics.js            포탄·바람·중력 (고정소수점)
  sim/terrain.js            비트맵 지형 + 파괴·샌드폴
  sim/damage.js             피해 계산, 상태이상 (빙결)
  data/tanks.js             탱크 10종 데이터
  data/weapons.js           무기 30종 (10 × 3) 테이블
  data/maps.js              맵 데이터 (Phase 1은 기존 테마 유지)
  render/terrainRender.js   비트맵 지형 렌더
  render/tankRender.js      SVG 탱크 렌더·파츠 합성
  render/effects.js         폭발·궤도·파편 파티클
  ui/hud.js                 파워/퓨얼/바람/턴오더 HUD
  ui/lobby.js               로비 화면
  ui/battle.js              전투 화면 이벤트
src/assets/tanks/           10개 SVG 파일
```

**핵심 원칙**
- `sim/*` 모듈은 DOM·렌더 의존성 0, 순수 함수 결정적
- 네트워크는 "커맨드"만 교환 (발사/이동/패스/채팅)
- 호스트 권위 없음 (결정적 시뮬). 상태 해시로 desync 감지만
- PeerJS 시그널링 및 `PEER_CONFIG` 재사용

---

## 2. 탱크 데이터 모델

### 2.1 공통 스키마
```js
{
  id: "armor",
  name: "아머",
  role: "중장갑 / 정면",
  description: "...",
  stats: {
    maxHealth: 150,
    armor: 0.85,            // 받는 피해 배율 (낮을수록 강함)
    mobility: 0.8,          // 이동 계수
    baseDelay: 720,         // 딜레이 기준값
    precision: 0.9          // 포탄 스프레드 역수
  },
  weapons: {
    ss1: { /* 무기 스키마 */ },
    ss2: { /* 무기 스키마 */ },
    new: { /* 무기 스키마, perMatchLimit: 2 */ }
  },
  visual: {
    svgId: "armor",
    primaryColor: "#ffb84f",
    secondaryColor: "#d9772a",
    trackStyle: "heavy"
  }
}
```
모든 수치는 **정수·고정소수점**으로 저장(결정성).

### 2.2 10종 벤치마크 테이블

| 탱크 | HP | 장갑 | 기동 | 기본딜레이 | 정밀 | 아키타입 |
|---|---|---|---|---|---|---|
| 아머 | 150 | 0.85 | 0.80 | 720 | 0.90 | 중장갑/올라운드 |
| 빅포 | 135 | 0.90 | 0.60 | 870 | 0.85 | 고화력/대포 |
| 새총 | 105 | 1.05 | 1.10 | 660 | 0.95 | 곡사/바람 타는 |
| 디크 | 115 | 1.00 | 1.00 | 760 | 0.90 | 굴착/매몰 |
| 터틀 | 170 | 0.80 | 0.55 | 840 | 0.88 | 방어/지속전 |
| 마법사 | 110 | 1.05 | 0.95 | 720 | 0.92 | 광역/분열 |
| 트리코 | 110 | 1.00 | 1.05 | 700 | 0.93 | 3분열/확산 |
| A캐논 | 95 | 1.15 | 0.95 | 620 | 1.05 | 장거리/직사 |
| 라이트닝 | 115 | 1.02 | 1.00 | 760 | 1.00 | 전격/관통 |
| 아이스 | 120 | 1.00 | 0.95 | 780 | 0.90 | 빙결/디버프 |

기본딜레이가 낮을수록 턴이 자주 돌아옴. 수치는 플레이테스트로 튜닝.

---

## 3. 무기 3종 체계 (SS1 / SS2 / NEW)

### 3.1 공통 무기 스키마
```js
{
  name: "Siege Shot",
  shotType: "single" | "split" | "burrow" | "multi" | "pierce",
  delayMultiplier: 1.0,     // SS1=1.0, SS2=1.3, NEW=1.8 기본값
  perMatchLimit: null,       // SS1/SS2 = null, NEW = 2
  projectile: {
    speedMultiplier: 1.0,
    gravityScale: 1.0,
    windFactor: 1.0,         // 1.0 기본, 0.4 = 바람 적게 탐
    damage: 35,
    radius: 44,              // 폭발 반경(px)
    craterMultiplier: 1.0,   // 비트맵 크레이터 크기 배수
    pierce: 0,               // 관통 탱크 수
    fragments: [],           // split/multi일 때 자식 탄
    status: null             // "frozen" 등
  },
  fx: { trail: "#ff8a00", hitSprite: "boom-large" }
}
```

### 3.2 탱크별 3종 무기 (요약)

| 탱크 | SS1 | SS2 | NEW (경기당 2회) |
|---|---|---|---|
| 아머 | Siege Shot (단발 38) | Heavy Burst (단발 62, 크레이터↑) | Siege Storm: 3발 분열 낙하 |
| 빅포 | Big Cannon (46) | Howitzer (고속 70) | Meteor: 거대탄 1발 (radius 110) |
| 새총 | Lob Pebble (30, 바람↑) | Lob Boulder (55) | Gale Shot: 바람 따라 휘는 3연발 |
| 디크 | Drill Round (수직 터널) | Drill Bunker (터널+말단폭발) | Earth Rupture: 지하 수평 관통 대폭발 |
| 터틀 | Shell Bolt (32, 자가 +8) | Shell Bash (50, 자가 +15) | Guardian's Wall: 앞 지형 솟음 + 자가 +40 |
| 마법사 | Arcane Orb (3분열) | Star Fall (5분열) | Meteor Swarm: 무작위 9곳 낙하 |
| 트리코 | Tri-Split (3갈래) | Tri-Burst (5갈래) | Prism Shower: 지그재그 9갈래 |
| A캐논 | Rail Round (빠름, 바람 0.4) | Rail Spike (관통 1명) | Rail Hyper: 관통 2명 + 대피해 |
| 라이트닝 | Arc Bolt (지형 관통 1셀) | Chain Bolt (근처 1명 확산) | Thunder Strike: 수직 낙뢰 (관통 3셀) |
| 아이스 | Frost Ball (24 + 딜레이 +120) | Frost Shard (3분열 + 딜레이 +200) | Blizzard: 광역 + 전원 딜레이 +400 |

### 3.3 규칙
- 파워 게이지는 3종 공통 (현 차지 UX 재활용).
- NEW 잔여 횟수는 HUD에 ❄️ 아이콘 2개로 표시.
- 전체 수치는 `data/weapons.js`에 집중, 튜닝 용이.

---

## 4. 딜레이 기반 턴 순서

### 4.1 데이터 구조
```js
turnManager = {
  tanks: [{ id, accumulatedDelay }],
  pendingStatuses: {
    [tankId]: [{ source, delayBonus }]
  },
  history: []
}
```

### 4.2 알고리즘
```
function pickNextTurn():
  apply pendingStatuses to accumulatedDelay, clear
  winner = tank with MIN accumulatedDelay (생존 탱크 중)
  tie-break: lower tankId (결정적)
  return winner
```

### 4.3 행동별 딜레이 가산

| 행동 | 공식 |
|---|---|
| SS1 발사 | `baseDelay × 1.0` |
| SS2 발사 | `baseDelay × 1.3` |
| NEW 발사 | `baseDelay × 1.8` |
| 이동 | `baseDelay × 0.002 × fuelUsed` |
| 턴 패스 | `baseDelay × 0.6` |
| 빙결 피격 | 피해자에 즉시 +120~+400 |

### 4.4 정규화
턴 종료 시 모든 탱크에서 `min(accumulatedDelay)`를 일괄 차감 → 오버플로 방지, 가장 빠른 탱크가 항상 0에서 출발.

### 4.5 UI
HUD에 **턴 오더 레일** 추가. 상위 3~4명의 다음 순서를 아이콘 + 예상 딜레이 바로 표시.

---

## 5. 픽셀 비트맵 지형 & 파괴

### 5.1 데이터 구조
```js
terrain = {
  width: 1400, height: 760,
  solid: Uint8Array(1400 * 760),          // 1=흙, 0=공기
  surface: Int16Array(1400),              // 각 x의 최상단 y 캐시
  colorBuf: Uint8ClampedArray(1400*760*4),// RGBA
  seed: "canyonbridge:abc123"
}
```
메모리: solid ~1 MB + colorBuf ~4 MB (허용 범위).

### 5.2 생성
시드 기반 결정적 생성. 각 맵 테마별 프로파일(언덕·다리·사막 등)은 기존 THEMES 로직을 비트맵 초기화로 이식.

### 5.3 파괴 파이프라인
1. **히트 판정**: 포탄 픽셀 궤적 스텝마다 `solid[idx]` 검사
2. **크레이터 마스크 적용**: 무기별 마스크 템플릿 (Uint8Array)
   - 원형: `Siege Shot` (반경 44)
   - 타원: `Rail Hyper`
   - 수직터널: `Drill Round` (폭 12, 깊이 200)
   - 수평대폭발: `Earth Rupture`
3. **샌드폴 패스**:
   - 크레이터 영향 범위 각 열에서 위에서 아래로 공기·흙 재배치
   - 흙 매달림 허용 안 함 (중력 붕괴)
   - 떨어진 흙이 크레이터를 일부 메움 → 전략적 매몰 효과
4. **surface 캐시 재계산** 후 탱크 reflow
5. **렌더**: dirty rect 부분 갱신으로 `putImageData`

### 5.4 탱크 상호작용
- 지형이 파괴되면 탱크 낙하 (현 `PLAYER_FALL_ACCELERATION` 재사용)
- 흙이 위에서 덮이면 매몰 피해 (심도 비례 HP -5 ~ -20)

### 5.5 결정성
- 샌드폴은 정수 루프만 사용
- 포탄 물리는 고정소수점 Int (×256 스케일)
- 부동소수점 사용 금지

### 5.6 성능 가드
- dirty rect 부분 갱신
- 모바일/저사양 옵션(해상도 1400→700)은 Phase 1은 고정값, 이후 노출

---

## 6. 결정적 멀티플레이 동기화

### 6.1 연결 & 시드
- 호스트 방 생성 시 `matchSeed` 발급 (`"m-" + randomHex(12)`)
- 초대 링크로 전파 → 모든 클라가 동일 시드로 초기화

### 6.2 커맨드 타입
```js
{ t: "fire", turn: 12, tankId: "p2", angle: 47, power: 82, weaponSlot: "ss2", seq: 37 }
{ t: "move", turn: 12, tankId: "p2", dx: -12, seq: 36 }
{ t: "pass", turn: 12, tankId: "p2", seq: 38 }
{ t: "chat", ... }
```
모든 커맨드에 `seq`(단조 증가)와 `turn`.

### 6.3 턴 프로토콜
1. `turnManager.pickNextTurn()`을 각 클라가 결정적으로 계산
2. 해당 클라가 입력 → 로컬 즉시 실행 + 브로드캐스트
3. 타 클라는 수신 즉시 동일 시뮬 실행
4. `fire`·`pass` 수신 시 다음 턴으로 이행

### 6.4 검증
- `cmd.tankId === expectedTankId(cmd.turn)` 확인 후 적용
- `seq`가 기대 범위 밖이면 폐기

### 6.5 Desync 감지
매 5턴마다 상태 해시 교환:
```
hash(terrain.solid) ^ hash(tanks[].hp) ^ hash(turnManager.accumulatedDelay)
```
불일치 시 배너 표시 + 호스트 기준 스냅샷 재전송 (비상 폴백).

### 6.6 부동소수점 결정성
- 좌표는 고정소수점 `Int32` (×256)
- 각도는 0~360 정수, 미리 계산한 sin·cos 테이블(361개) 사용
- RNG: `mulberry32(hashString(matchSeed + ":" + purpose))` 용도별 분리

### 6.7 호스트 이탈
Phase 1은 "첫 남은 참가자 자동 호스트 승격" 시도 + 실패 시 로비 복귀 폴백.

---

## 7. 탱크 SVG 비주얼

### 7.1 에셋 구조
```
src/assets/tanks/
  armor.svg  bigpo.svg  slingshot.svg  dike.svg  turtle.svg
  mage.svg   tricot.svg acannon.svg    lightning.svg  ice.svg
```

### 7.2 SVG 규약
- `viewBox="0 0 200 140"`, 지상선 y=120
- 그룹 id 규약:
  - `#track` — 궤도
  - `#chassis` — 차체 (`.team-primary` 클래스)
  - `#turret` — 포탑 (회전 대상, `data-pivot-x/y`)
  - `#barrel` — 포신 (각도 대상)
  - `#accent` — 장식 (`.team-secondary`)
  - `#eye` — 정적 디테일

### 7.3 런타임 렌더
1. 최초 로드: fetch → DOMParser → 템플릿 캐시
2. 인스턴스: clone → 팀컬러 치환 → 오프스크린 Canvas 래스터
3. 매 프레임: 기반 스프라이트 + 포탑/포신 `save/rotate/translate`
4. 피격 반응: 0.12s 붉은 틴트 (`globalCompositeOperation`)
5. 포신 반동: 발사 시 0.18s 뒤로 8px 밀린 후 복귀

### 7.4 팀컬러
- 팀 4팔레트 (레드/블루/그린/옐로)
- 차체 = primaryColor 60% + 팀컬러 40%
- 탱크 정체성 유지 + 팀 식별 가능

### 7.5 통합
로비 미리보기(`hero-vehicle-canvas`, `.tank-tile-canvas`, `.player-pill-canvas`)와 배틀 스프라이트 모두 동일 렌더러로 치환.

### 7.6 네트워크 영향
렌더 전용, 시뮬 영향 없음.

---

## 8. HUD / UX 변경

### 8.1 신규
- **턴 오더 레일** (상단) — 다음 4명 아이콘 + 딜레이 바
- **무기 슬롯 탭** — SS1 / SS2 / NEW ❄❄ (키 `1/2/3` 또는 클릭)
- **NEW 잔여 아이콘** — ❄ 2개
- **상태이상 아이콘** — 머리 위 (빙결 등) + 가산 수치

### 8.2 유지 (변경 없음)
- 파워 차지 로직, 이전 샷 마커
- 바람 게이지 (궤적 프리뷰는 도입 안 함)
- 로비·초대 링크·채팅·PeerJS 시그널링

---

## 9. Phase 1 인수 기준

- [ ] 탱크 10종 로비·배틀에서 선택·표시 가능
- [ ] 각 탱크 SS1/SS2/NEW 발사 (분열/관통/굴착/빙결 포함)
- [ ] NEW 경기당 2회 제한 강제
- [ ] 딜레이 기반 턴 순서: 같은 탱크 연속 턴 가능
- [ ] 픽셀 비트맵 크레이터 + 샌드폴 + 매몰 피해
- [ ] 디크 수직 터널이 지형을 실제 관통
- [ ] 결정적 시뮬: 두 브라우저 동일 matchSeed → 동일 결과
- [ ] 5턴마다 상태 해시 교환 → 일치
- [ ] SVG 10종 탱크 렌더 + 팀컬러 + 포신 반동
- [ ] 현 모바일 레이아웃 회귀 없음

## 10. Phase 1 Out-of-Scope

- 인게임 아이템 (Phase 2)
- 태그전·서바이벌·관전 (Phase 2/3)
- 맵 확장 8+종 (Phase 3)
- 사운드 (Phase 2)
- 성장·해금·랭킹 (Phase 4)
- 크리티컬/관통 타격 피드백 (Phase 2)

---

## 11. 주요 기술 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| 결정성 깨짐 | 부동소수점 금지, 고정소수점 Int + sin/cos 테이블. RNG 재현 유닛 테스트. |
| 비트맵 파괴 성능 | dirty rect 부분 갱신. 하락 시 해상도 옵션 도입. |
| app.js 6,000줄 분할 회귀 | 점진적 모듈 분리, PR마다 플레이테스트 체크리스트. |
| Lockstep 레이턴시 | 커맨드 즉시 브로드캐스트 + 로컬 즉시 실행. 원격은 수신 즉시 재생. |
| PeerJS 호스트 이탈 | 자동 호스트 승격 시도 + 실패 시 로비 복귀. |

---

## 12. 결정 로그

- **[2026-04-17]** 로드맵 4단계로 분할, Phase 1 범위 확정
- **[2026-04-17]** 탱크 아키타입: 실 포트리스 기반 한글 이름 10종
- **[2026-04-17]** 무기 체계: 3종(SS1/SS2/NEW), NEW = 경기당 2회
- **[2026-04-17]** 턴 순서: 완전 딜레이 누적 방식
- **[2026-04-17]** 지형: 픽셀 비트맵 파괴
- **[2026-04-17]** 조준 UX: 미니멀 (궤적 프리뷰 없음)
- **[2026-04-17]** 멀티플레이: 결정적 시뮬 + 커맨드 동기화
- **[2026-04-17]** 탱크 비주얼: 벡터 SVG
