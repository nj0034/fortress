# Fortress Relay — Phase 2 설계 문서

**날짜**: 2026-04-17
**대상**: Phase 1 완료 후, 실 포트리스 수준 "모드 · 아이템 · 피드백" 확장.
**스펙 기반**: `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` 로드맵 §0.

---

## 0. Phase 2 범위

Phase 1이 1인칭 전투의 기반을 깔았다면, Phase 2는 **다인 협력/경쟁·아이템 시스템·타격 피드백**으로 게임성을 살찌운다.

| 서브시스템 | 요약 |
|---|---|
| **§1 인게임 아이템** | 텔레포트 / 더블샷 / 이온실드 / 수리킷 / 중력반전 등 5종, 배틀 중 무작위 드롭 + 획득 + 사용 |
| **§2 모드 확장** | 팀전(2v2) · 태그전(4인 1팀 교대 발사) · 서바이벌 단일모드 (free-for-all 기존 유지) |
| **§3 팀 UX** | 팀 컬러(4팔레트, Plan E에 이미 존재) 로비·배틀 반영, 팀킬 금지, 맵 핑 1~2종 |
| **§4 타격 피드백** | 크리티컬 / 관통 / 빗나감 / 헤드샷 판정, 배너·파티클·사운드 |
| **§5 사운드** | 발사·피격·폭발·아이템·턴 시작·승패 효과음 경량 라이브러리 구축 |

## 1. 인게임 아이템 시스템

### 1.1 스펙
- 매 턴 시작 시 15% 확률로 **드롭 캡슐** 맵 위에 스폰 (결정적 RNG: `createPurposeRng(matchSeed, "item:" + turnIndex)`)
- 포탄이 드롭 캡슐에 맞거나 탱크가 캡슐 위에서 턴을 마치면 획득
- 각 탱크는 **최대 3개** 아이템 슬롯 보유
- 키 `Q/W/E`로 슬롯1/2/3 사용 (turn 내 어느 시점이든)

### 1.2 아이템 5종

| id | 이름 | 효과 |
|---|---|---|
| `teleport` | 텔레포트 | 지정 좌표로 즉시 이동 (클릭 캔버스). 바다 상 착지 불가. |
| `double_shot` | 더블샷 | 이번 턴 발사 직후 추가 1발 자동 발사 (동일 무기, 살짝 무작위 스프레드). 딜레이 1.2× |
| `ion_shield` | 이온실드 | 다음 1회 피격 피해 50% 감소. 머리 위 반투명 돔 렌더. |
| `repair_kit` | 수리킷 | HP +40 즉시 회복 (최대체력 초과 불가). |
| `gravity_reverse` | 중력반전 | 이번 턴 포탄 중력 −0.6× 적용 (위로 솟음). |

### 1.3 데이터/모듈
- `src/data/items.js`: 5종 정의 (`id, name, description, slot="instant"|"turn"|"persistent", applyEffect(state, owner, target?)`)
- `src/sim/items.js`: 드롭 스폰·획득·사용 로직 (결정적, 네트워크 커맨드 `{ t: "use-item", turn, tankId, itemId, target? }`)
- 인벤토리 상태: `player.inventory = [itemId, ...]` (최대 3)
- 드롭 인스턴스: `game.pendingDrops = [{ id, x, y, itemId }]`

### 1.4 UI
- **인벤토리 스트립**: 전투 화면 좌하단, 3칸 (Q/W/E 레이블). 비어있으면 빈칸.
- **캡슐 렌더**: 맵 위 발광 사각 + 아이콘 글리프. `src/render/itemsRender.js`.
- **이펙트**: 사용 시 번쩍 + 상태 배너 ("텔레포트!").

## 2. 모드 확장

### 2.1 매치 구성
- 로비에서 **모드 선택** (드롭다운): `free-for-all`(기본) / `team-2v2` / `tag-team` / `survival`.
- 팀 모드 선택 시 자동 팀 분배: 입장 순서대로 1·3 = 레드팀, 2·4 = 블루팀.
- 태그 모드: 4인 → 2팀 2명씩. 팀 내 현재 전투자만 턴을 받음, 사망 시 같은 팀 대기자로 자동 교체.
- 서바이벌: FFA와 동일하지만 HP 저장(라운드 4회), 매 라운드 후 최하위 탈락.

### 2.2 구현
- `src/sim/match.js`: `createMatch({ mode, players, matchSeed })` → `{ mode, teams, elimination, survivalRound, ... }`
- `turnManager.pickNextTurn`은 생존자 중에서 고르되, **팀 모드에서는 같은 팀 연속 턴 방지** (accumulated delay가 같으면 상대 팀 우선).
- 태그 전환: 현재 전투자 사망 시 `substituteIntoActiveRoster` 호출 — 같은 팀 대기자 중 최저 baseDelay가 자동 교체.
- 팀킬 방지: 데미지 처리 시 `isTeamMate(attacker, victim)` 체크. 같은 팀이면 피해 = 0 + "팀킬 방지" 배너.

### 2.3 UI
- 로비에 **모드 선택 드롭다운** + 모드별 미니 설명.
- 배틀 상단에 모드 뱃지(`TAG`, `TEAM 2v2` 등).
- 팀 모드 시 플레이어 카드 테두리 팀컬러.
- 태그 모드: 대기자는 하단에 흐린 아이콘으로 표시.

## 3. 팀 UX

### 3.1 팀 컬러
- Plan E `TEAM_COLORS` 팔레트 재활용 (Red/Blue/Green/Yellow).
- 팀 매치는 2팀만 쓰이므로 Red/Blue 고정.
- 탱크 차체에 60% primaryColor + 40% 팀 tint (Plan E의 `mixColors`).

### 3.2 팀킬 방지
- 피해 계산: `if (isTeamMate) damage = 0` 후 "아군 보호" 토스트.
- 상태이상(빙결/중력반전)도 아군엔 적용 안 함.

### 3.3 맵 핑 (최소)
- 우클릭 캔버스 → 핑 전송 (`{ t: "ping", turn, tankId, x, y, kind }`)
- 종류 2가지: `attention`(노랑 느낌표) / `target`(빨강 조준).
- 핑은 4초 표시 후 사라짐.

## 4. 타격 피드백

### 4.1 판정 타입

| 타입 | 조건 | 표기 |
|---|---|---|
| `normal` | 기본 맞음 | "HIT" 노랑 |
| `critical` | 피격자 포탑 ±10px 안 | "CRITICAL!" 빨강, 데미지 1.5× |
| `pierce` | pierce 샷 관통 | "PIERCE" 보라 |
| `miss` | 탱크 범위 밖, 지형만 | 표기 없음 |
| `aerial` | 공중 명중(낙하 전) | "AERIAL!" 주황, 1.25× |

### 4.2 구현
- `src/sim/damage.js`에 `classifyHit(projectile, victim, impactPoint)` 추가.
- 결과는 이벤트 스트림으로 렌더에 전달, 팝업/파티클/사운드 트리거.

### 4.3 UI
- 피격 지점 위로 **피해 숫자** 플로팅 텍스트 (0.6s 상승 + 페이드).
- 판정 타입별 색·크기·아웃라인.
- 크리티컬 시 화면 짧은 셰이크(60ms, 진폭 3px).

## 5. 사운드

### 5.1 라이브러리
- `src/audio/audio.js`: `loadSounds(manifest)`, `play(id, { volume? })`, `setMasterVolume()`
- HTMLAudioElement 풀 (각 id당 3개 순환)로 동시 재생 가능.
- 사운드 매니페스트: `src/data/sounds.js` — 경로·볼륨·카테고리.

### 5.2 사운드 자산
- 대체가 가능하도록 경로 기반. 초기엔 오픈 라이선스 또는 AI 생성 샘플 (mp3/ogg).
- 폴더: `src/assets/audio/` (fire, hit, crit, explode, freeze, pickup, ui-click, victory, defeat)
- 각 파일 ≤ 40KB 권장.

### 5.3 설정
- 로비·배틀 HUD에 🔊 토글 + 볼륨 슬라이더 (0~100%).
- LocalStorage에 볼륨·음소거 저장.

## 6. 결정성 & 멀티플레이

- 아이템 드롭 좌표·종류: `createPurposeRng(matchSeed, "item:" + turnIndex)` 사용.
- 아이템 사용: 네트워크 커맨드 `{ t: "use-item", ... }` — 모든 클라이언트가 동일하게 시뮬.
- 사운드·UI 피드백은 로컬 전용 (네트워크 미포함).
- 팀 정보는 `match.teams[playerId] = "red"|"blue"` 형태로 초기 매치 생성 시 고정, 이후 변경 없음.

## 7. Phase 2 인수 기준

- [ ] 5종 아이템 드롭·획득·사용 동작, 각 효과 정상 발동
- [ ] 팀 2v2 모드에서 팀원 피해 0 / 상태이상 적용 안 됨
- [ ] 태그 모드 사망 시 대기자 자동 교체
- [ ] 서바이벌 4라운드, 최하위 탈락 로직
- [ ] 맵 핑 우클릭으로 표시, 4초 후 사라짐, 네트워크 전파
- [ ] 크리티컬/관통/공중 판정별 피해 배수 적용 + 플로팅 텍스트 + 셰이크
- [ ] 발사/피격/폭발/승패 사운드 재생 + 볼륨 조절 + 음소거 유지
- [ ] 모든 기존 Phase 1 회귀 없음 (217+ 테스트 그대로 통과)

## 8. Phase 2 Out-of-Scope

- 랭킹 / 전적 저장 / 해금 (Phase 4)
- 맵 확장 8+종 (Phase 3)
- 추가 탱크 (Phase 4 이후)
- 관전 모드 (Phase 3)
- 보이스 채팅
