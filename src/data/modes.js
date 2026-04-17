/**
 * Game mode table — Plan H §1.
 *
 * Each mode entry defines:
 *   id          — stable string key
 *   name        — display name
 *   description — short UI description
 *   minPlayers  — minimum players required to start
 *   maxPlayers  — maximum supported players
 *   teamCount   — number of teams (0 = free-for-all)
 *   roundCount  — number of rounds (survival = 4, others = 1)
 */

export const MODES = {
  ffa: {
    id: "ffa",
    name: "Free-For-All",
    description: "모든 플레이어가 서로 싸우는 무한 전투",
    minPlayers: 2,
    maxPlayers: 4,
    teamCount: 0,
    roundCount: 1,
  },
  "team-2v2": {
    id: "team-2v2",
    name: "Team 2v2",
    description: "2명씩 두 팀으로 나뉘어 팀전을 펼칩니다",
    minPlayers: 4,
    maxPlayers: 4,
    teamCount: 2,
    roundCount: 1,
  },
  "tag-team": {
    id: "tag-team",
    name: "Tag Team",
    description: "예비 선수가 쓰러진 아군과 교대합니다",
    minPlayers: 4,
    maxPlayers: 4,
    teamCount: 2,
    roundCount: 1,
  },
  survival: {
    id: "survival",
    name: "Survival",
    description: "매 라운드 최저 HP 플레이어가 탈락하는 4라운드 서바이벌",
    minPlayers: 3,
    maxPlayers: 4,
    teamCount: 0,
    roundCount: 4,
  },
};

export const MODE_IDS = Object.keys(MODES);
