import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Dart {
  v?: number;
  m?: number;
  d?: number;
  i?: boolean;
  c?: { x: number; y: number };
}

export type TurnDart = number | Dart;
export type Turn = TurnDart[];

export interface PlayerMatchStats {
  id: string;
  name: string;
  score?: number;
  darts?: number;
  dartsCount?: number;
  sets?: number;
  legs?: number;
  checkoutDarts?: number;
  checkoutHits?: number;
  allTurns?: Turn[];
  totalMatchDarts?: number;
  totalMatchScore?: number;
  totalMarks?: number;
  totalMatchMarks?: number;
  marks?: Record<string, number>;
  hits?: Record<number, { S: number; D: number; T: number }> | number;
  accuracy?: string;
  status?: string;
  isBust?: boolean;
  isTeam?: boolean;
  members?: string[];
  avg?: string | number;
  s140?: number;
  s180?: number;
  totalClosedTargets?: number;
  closedTargets?: number;
  rank?: number;
}

export interface LegLog {
  winnerId?: string;
  starterId?: string;
  p1Throws?: string[];
  p2Throws?: string[];
}

export interface MatchScore {
  p1Sets?: number;
  p2Sets?: number;
  p1Legs?: number;
  p2Legs?: number;
}

export interface MatchStatItem {
  label: string;
  p1: string | number;
  p2?: string | number;
}

export interface TournamentSettings {
  format?: string;
  targetSets?: number;
  teamSize?: string;
  startPoints?: number;
  points?: number;
  customSemis?: boolean;
  customFinals?: boolean;
  cricketMode?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Match {
  id: string;
  mode?: string;
  date?: string;
  duration?: string;
  settings?: TournamentSettings;
  players?: PlayerMatchStats[];
  player1?: PlayerMatchStats;
  player2?: PlayerMatchStats;
  winner?: PlayerMatchStats;
  isBye?: boolean;
  isThirdPlace?: boolean;
  round?: number;
  phase?: string;
  bracket?: string;
  groupId?: string;
  matchIndex?: number;
  nextMatchId?: string | null;
  nextMatchSlot?: "p1" | "p2" | null;
  loserDropMatchId?: string | null;
  loserDropSlot?: "p1" | "p2" | null;
  stats?: MatchStatItem[];
  logs?: LegLog[];
  score?: MatchScore;
}

export interface Tournament {
  id: string;
  finishedAt?: string;
  settings?: TournamentSettings;
  players?: PlayerMatchStats[];
  bracket?: Match[];
}

export interface AggregatedStats {
  name: string;
  mPlayed: number;
  mWon: number;
  lWon: number;
  totalPoints: number;
  totalDarts: number;
  first9Points: number;
  first9Count: number;
  s60: number;
  s100: number;
  s140: number;
  s180: number;
  checkoutHits: number;
  checkoutDarts: number;
  tPlayed: number;
  t1st: number;
  t2nd: number;
  hits: Record<number, { S: number; D: number; T: number }>;
  coords: { x: number; y: number }[];
  winPct?: number;
  calculatedAvg?: number;
  calculatedFirst9?: number;
  calculatedCheckoutPct?: number;
}

export const isBot = (name: string): boolean =>
  (/\(.*?\b\d+\b.*?\)/.test(name) || /(adaptive|adaptacyjny)/i.test(name)) &&
  name.toLowerCase().includes("bot");

export const parseDateString = (dateStr: string): Date => {
  try {
    const [datePart, timePart] = dateStr.split(", ");
    const [day, month, year] = datePart.split(".");
    const [hour, minute] = timePart.split(":");
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
  } catch (e) {
    return new Date(0);
  }
};

export const generateMatchStats = (
  match: Match,
  history: LegLog[],
  p1Att: number,
  p2Att: number,
): MatchStatItem[] => {
  const calc = (playerId: string | undefined, isP1: boolean, att: number) => {
    let totalScore = 0,
      totalTurns = 0,
      f9S = 0,
      f9T = 0,
      c60 = 0,
      c80 = 0,
      c100 = 0,
      c120 = 0,
      c140 = 0,
      c170 = 0,
      c180 = 0,
      hF = 0,
      f100 = 0,
      bL = 9999,
      wL = 0,
      lW = 0;

    history.forEach((leg) => {
      const thr = isP1 ? leg.p1Throws || [] : leg.p2Throws || [];
      if (leg.winnerId === playerId) lW++;
      thr.forEach((t: string, idx: number) => {
        const val = t === "BUST" ? 0 : parseInt(t);
        totalScore += val;
        totalTurns++;
        if (idx < 3) {
          f9S += val;
          f9T++;
        }
        if (val >= 60 && val < 80) c60++;
        else if (val >= 80 && val < 100) c80++;
        else if (val >= 100 && val < 120) c100++;
        else if (val >= 120 && val < 140) c120++;
        else if (val >= 140 && val < 170) c140++;
        else if (val >= 170 && val < 180) c170++;
        else if (val === 180) c180++;
      });
      if (thr.length > 0) {
        const darts = thr.length * 3;
        if (darts < bL) bL = darts;
        if (darts > wL) wL = darts;
      }
      if (leg.winnerId === playerId && thr.length > 0) {
        const last = parseInt(thr[thr.length - 1]);
        if (last > hF) hF = last;
        if (last >= 100) f100++;
      }
    });

    const coPct = att > 0 ? ((lW / att) * 100).toFixed(1) : "0.0";
    const totalDarts = totalTurns * 3;

    return {
      lW,
      avg: totalTurns > 0 ? (totalScore / totalTurns).toFixed(2) : "0.00",
      f9: f9T > 0 ? (f9S / f9T).toFixed(2) : "0.00",
      c60,
      c80,
      c100,
      c120,
      c140,
      c170,
      c180,
      hF,
      f100,
      bL: bL === 9999 ? "-" : bL,
      wL: wL === 0 ? "-" : wL,
      checkout: `${coPct}% (${lW}/${att})`,
      totalDarts,
    };
  };

  const s1 = calc(
    match.player1?.id || (match.players && match.players[0]?.id) || "",
    true,
    p1Att,
  );
  const s2 = match.player2
    ? calc(match.player2.id, false, p2Att)
    : match.players && match.players.length > 1
      ? calc(match.players[1].id, false, p2Att)
      : null;

  const rawStats: MatchStatItem[] = [
    { label: "Legs", p1: s1.lW, p2: s2?.lW || 0 },
    { label: "Darts Thrown", p1: s1.totalDarts, p2: s2?.totalDarts || 0 },
    { label: "3 Darts", p1: s1.avg, p2: s2?.avg || "0.00" },
    { label: "First 9", p1: s1.f9, p2: s2?.f9 || "0.00" },
    { label: "60+", p1: s1.c60, p2: s2?.c60 || 0 },
    { label: "80+", p1: s1.c80, p2: s2?.c80 || 0 },
    { label: "100+", p1: s1.c100, p2: s2?.c100 || 0 },
    { label: "120+", p1: s1.c120, p2: s2?.c120 || 0 },
    { label: "140+", p1: s1.c140, p2: s2?.c140 || 0 },
    { label: "170+", p1: s1.c170, p2: s2?.c170 || 0 },
    { label: "180's", p1: s1.c180, p2: s2?.c180 || 0 },
    { label: "High Finish", p1: s1.hF, p2: s2?.hF || 0 },
    { label: "100+ Finishes", p1: s1.f100, p2: s2?.f100 || 0 },
    { label: "Best Leg", p1: s1.bL, p2: s2?.bL || "-" },
    { label: "Worst Leg", p1: s1.wL, p2: s2?.wL || "-" },
    {
      label: "Checkout %",
      p1: s1.checkout,
      p2: s2?.checkout || "0.0% (0/0)",
    },
  ];

  return rawStats.filter((s) => {
    if (["Legs", "3 Darts", "Checkout %"].includes(s.label)) return true;
    const isZero = (val: string | number | undefined) =>
      val === 0 ||
      val === "0" ||
      val === "0.00" ||
      val === "-" ||
      val === "0.0% (0/0)";
    return !(isZero(s.p1) && isZero(s.p2));
  });
};

const formatPlayerMap = (
  playerMap: Record<string, AggregatedStats>,
  appliedNames: string[],
): AggregatedStats[] => {
  return Object.values(playerMap)
    .filter((s) => appliedNames.includes(s.name) && !isBot(s.name))
    .map((s) => ({
      ...s,
      winPct: s.mPlayed > 0 ? (s.mWon / s.mPlayed) * 100 : 0,
      calculatedAvg: s.totalDarts > 0 ? (s.totalPoints / s.totalDarts) * 3 : 0,
      calculatedFirst9:
        s.first9Count > 0 ? (s.first9Points / s.first9Count) * 3 : 0,
      calculatedCheckoutPct:
        s.checkoutDarts > 0 ? (s.checkoutHits / s.checkoutDarts) * 100 : 0,
    }));
};

const processX01MatchesIncremental = (
  matches: Match[],
  existingMap: Record<string, AggregatedStats> = {},
): Record<string, AggregatedStats> => {
  const playerMap: Record<string, AggregatedStats> = JSON.parse(
    JSON.stringify(existingMap),
  );
  matches.forEach((match) => {
    if (match.mode !== "X01") return;
    if (!match.players) return;

    const winner = [...match.players].sort(
      (a, b) =>
        (b.sets || 0) - (a.sets || 0) ||
        (b.legs || 0) - (a.legs || 0) ||
        (a.score || 0) - (b.score || 0),
    )[0];
    match.players.forEach((p) => {
      if (!playerMap[p.name]) {
        playerMap[p.name] = {
          name: p.name,
          mPlayed: 0,
          mWon: 0,
          lWon: 0,
          totalPoints: 0,
          totalDarts: 0,
          first9Points: 0,
          first9Count: 0,
          checkoutDarts: 0,
          checkoutHits: 0,
          s180: 0,
          s140: 0,
          s100: 0,
          s60: 0,
          tPlayed: 0,
          t1st: 0,
          t2nd: 0,
          hits: {},
          coords: [],
        };
        [...Array(20)].forEach(
          (_, i) => (playerMap[p.name].hits[i + 1] = { S: 0, D: 0, T: 0 }),
        );
        playerMap[p.name].hits[25] = { S: 0, D: 0, T: 0 };
        playerMap[p.name].hits[0] = { S: 0, D: 0, T: 0 };
      }
      const s = playerMap[p.name];
      s.mPlayed += 1;
      if (winner && p.name === winner.name) s.mWon += 1;
      s.checkoutDarts += p.checkoutDarts || 0;
      s.checkoutHits += p.checkoutHits || 0;
      if (p.allTurns) {
        const turns = p.allTurns;
        const sumOfLengths = turns.reduce(
          (acc: number, t: Turn) => acc + t.length,
          0,
        );
        const isBuggyCompressed =
          p.totalMatchDarts &&
          p.totalMatchDarts > sumOfLengths &&
          !turns.some((t: Turn) =>
            t.some(
              (d: TurnDart) =>
                typeof d === "object" && d !== null && d.d !== undefined,
            ),
          );

        turns.forEach((turn: Turn, index: number) => {
          const turnSum = turn.reduce(
            (a: number, b: TurnDart) =>
              a + (typeof b === "number" ? b : (b.v || 0) * (b.m || 1)),
            0,
          );

          let turnDarts = turn.reduce(
            (a: number, b: TurnDart) =>
              a +
              (typeof b === "number"
                ? 1
                : typeof b === "object" && b !== null && b.d !== undefined
                  ? b.d
                  : 1),
            0,
          );
          if (isBuggyCompressed && p.totalMatchDarts !== undefined) {
            turnDarts =
              index === turns.length - 1 ? p.totalMatchDarts - index * 3 : 3;
          }

          s.totalPoints += turnSum;
          s.totalDarts += turnDarts;
          if (index < 3) {
            s.first9Points += turnSum;
            s.first9Count += turnDarts;
          }
          if (turnSum >= 180) s.s180++;
          else if (turnSum >= 140) s.s140++;
          else if (turnSum >= 100) s.s100++;
          else if (turnSum >= 60) s.s60++;
          turn.forEach((dart: TurnDart) => {
            const isScoreInput =
              (typeof dart === "object" && dart !== null && dart.i === true) ||
              isBuggyCompressed;
            if (isScoreInput) return;
            if (typeof dart === "object" && dart !== null && dart.c)
              s.coords.push(dart.c);

            if (
              typeof dart === "object" &&
              dart !== null &&
              dart.v !== undefined
            ) {
              const target = dart.v;
              const mult = dart.m;
              if (s.hits && typeof s.hits === "object" && s.hits[target]) {
                if (mult === 1) s.hits[target].S++;
                if (mult === 2) s.hits[target].D++;
                if (mult === 3) s.hits[target].T++;
              }
            }
          });
        });
      }
    });
  });
  return playerMap;
};

export const getOverallStatisticsAsync = async (
  history: Match[],
  appliedNames: string[],
  timeFilter: string,
): Promise<AggregatedStats[]> => {
  if (timeFilter !== "all")
    return calculateOverallStatistics(history, appliedNames, timeFilter);

  try {
    const CACHE_KEY = "@dart_overall_agg";
    const aggStr = await AsyncStorage.getItem(CACHE_KEY);
    let aggregate: {
      processedIds: string[];
      playerMap: Record<string, AggregatedStats>;
    } = aggStr ? JSON.parse(aggStr) : { processedIds: [], playerMap: {} };

    const x01History = history.filter((h) => h.mode === "X01");
    const historyIds = new Set(x01History.map((h) => h.id));
    const cachedIds = new Set(aggregate.processedIds);

    let hasDeletions = false;
    for (const id of aggregate.processedIds) {
      if (!historyIds.has(id)) {
        hasDeletions = true;
        break;
      }
    }

    if (hasDeletions) {
      const newMap = processX01MatchesIncremental(x01History, {});
      aggregate = {
        processedIds: x01History.map((h) => h.id),
        playerMap: newMap,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(aggregate));
    } else {
      const newMatches = x01History.filter((h) => !cachedIds.has(h.id));
      if (newMatches.length > 0) {
        aggregate.playerMap = processX01MatchesIncremental(
          newMatches,
          aggregate.playerMap,
        );
        aggregate.processedIds = x01History.map((h) => h.id);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(aggregate));
      }
    }
    return formatPlayerMap(aggregate.playerMap, appliedNames);
  } catch (e) {
    console.error("Aggregate overall error:", e);
    return calculateOverallStatistics(history, appliedNames, timeFilter);
  }
};

export const calculateOverallStatistics = (
  history: Match[],
  appliedNames: string[],
  timeFilter: string,
): AggregatedStats[] => {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filteredHistory = history.filter((match) => {
    if (match.mode !== "X01") return false;
    if (timeFilter === "all" || !match.date) return true;
    const matchDate = parseDateString(match.date);
    if (timeFilter === "today") return matchDate >= startOfToday;
    if (timeFilter === "7d") return matchDate >= sevenDaysAgo;
    if (timeFilter === "30d") return matchDate >= thirtyDaysAgo;
    return true;
  });

  const playerMap = processX01MatchesIncremental(filteredHistory, {});
  return formatPlayerMap(playerMap, appliedNames);
};

const formatTournamentPlayerMap = (
  playerMap: Record<string, AggregatedStats>,
  appliedNames: string[],
): AggregatedStats[] => {
  return Object.values(playerMap)
    .filter((s) => appliedNames.includes(s.name) && !isBot(s.name))
    .map((s) => ({
      ...s,
      winPct: s.mPlayed > 0 ? (s.mWon / s.mPlayed) * 100 : 0,
      calculatedAvg: s.totalDarts > 0 ? (s.totalPoints / s.totalDarts) * 3 : 0,
      calculatedFirst9:
        s.first9Count > 0 ? (s.first9Points / s.first9Count) * 3 : 0,
      calculatedCheckoutPct:
        s.checkoutDarts > 0 ? (s.checkoutHits / s.checkoutDarts) * 100 : 0,
    }));
};

const processTournamentMatchesIncremental = (
  tourneys: Tournament[],
  existingMap: Record<string, AggregatedStats> = {},
): Record<string, AggregatedStats> => {
  const playerMap: Record<string, AggregatedStats> = JSON.parse(
    JSON.stringify(existingMap),
  );
  tourneys.forEach((tourney) => {
    let firstPlace: string | null = null;
    let secondPlace: string | null = null;

    if (tourney.settings?.format === "round_robin") {
      const rrStats: Record<
        string,
        { won: number; legsFor: number; legsAgainst: number }
      > = {};
      tourney.players?.forEach((p) => {
        rrStats[p.name] = { won: 0, legsFor: 0, legsAgainst: 0 };
      });
      tourney.bracket?.forEach((m) => {
        if (m.isBye || !m.winner || !m.player1 || !m.player2) return;
        if (m.winner.id === m.player1.id) {
          if (rrStats[m.player1.name]) rrStats[m.player1.name].won++;
        } else {
          if (rrStats[m.player2.name]) rrStats[m.player2.name].won++;
        }
        if (m.score) {
          if ((tourney.settings?.targetSets || 1) > 1) {
            if (rrStats[m.player1.name]) {
              rrStats[m.player1.name].legsFor += m.score.p1Sets || 0;
              rrStats[m.player1.name].legsAgainst += m.score.p2Sets || 0;
            }
            if (rrStats[m.player2.name]) {
              rrStats[m.player2.name].legsFor += m.score.p2Sets || 0;
              rrStats[m.player2.name].legsAgainst += m.score.p1Sets || 0;
            }
          } else {
            if (rrStats[m.player1.name]) {
              rrStats[m.player1.name].legsFor += m.score.p1Legs || 0;
              rrStats[m.player1.name].legsAgainst += m.score.p2Legs || 0;
            }
            if (rrStats[m.player2.name]) {
              rrStats[m.player2.name].legsFor += m.score.p2Legs || 0;
              rrStats[m.player2.name].legsAgainst += m.score.p1Legs || 0;
            }
          }
        }
      });
      const sorted = Object.keys(rrStats).sort((a, b) => {
        if (rrStats[b].won !== rrStats[a].won)
          return rrStats[b].won - rrStats[a].won;
        const diffA = rrStats[a].legsFor - rrStats[a].legsAgainst;
        const diffB = rrStats[b].legsFor - rrStats[b].legsAgainst;
        return diffB - diffA;
      });
      if (sorted.length > 0) firstPlace = sorted[0];
      if (sorted.length > 1) secondPlace = sorted[1];
    } else {
      const koMatches = tourney.bracket?.filter(
        (b) => b.phase === "knockout" || !b.phase,
      );
      if (koMatches && koMatches.length > 0) {
        const totalR = Math.max(...koMatches.map((b) => b.round || 0));
        const finalMatch = koMatches.find(
          (m) => m.round === totalR && !m.isThirdPlace,
        );
        if (finalMatch && finalMatch.winner) {
          firstPlace = finalMatch.winner.name;
          secondPlace =
            (finalMatch.winner.id === finalMatch.player1?.id
              ? finalMatch.player2?.name
              : finalMatch.player1?.name) || null;
        }
      }
    }

    const initPlayer = (name: string) => {
      if (!playerMap[name]) {
        playerMap[name] = {
          name,
          mPlayed: 0,
          mWon: 0,
          lWon: 0,
          totalPoints: 0,
          totalDarts: 0,
          first9Points: 0,
          first9Count: 0,
          s60: 0,
          s100: 0,
          s140: 0,
          s180: 0,
          checkoutHits: 0,
          checkoutDarts: 0,
          tPlayed: 0,
          t1st: 0,
          t2nd: 0,
          hits: {},
          coords: [],
        };
      }
    };

    const participants = tourney.players?.map((p) => p.name) || [];
    participants.forEach((pName: string) => {
      initPlayer(pName);
      playerMap[pName].tPlayed++;
    });

    if (firstPlace) {
      initPlayer(firstPlace);
      playerMap[firstPlace].t1st++;
    }
    if (secondPlace) {
      initPlayer(secondPlace);
      playerMap[secondPlace].t2nd++;
    }

    tourney.bracket?.forEach((match) => {
      if (match.isBye || !match.player1 || !match.winner) return;

      const p1Name = match.player1.name;
      const p2Name = match.player2?.name;

      initPlayer(p1Name);
      playerMap[p1Name].mPlayed++;
      if (match.winner?.id === match.player1.id) playerMap[p1Name].mWon++;

      if (p2Name) {
        initPlayer(p2Name);
        playerMap[p2Name].mPlayed++;
        if (match.winner?.id === match.player2?.id) playerMap[p2Name].mWon++;
      }

      const coStat = match.stats?.find((s) => s.label === "Checkout %");
      if (coStat) {
        const p1Match = String(coStat.p1).match(/\((\d+)\/(\d+)\)/);
        if (p1Match) {
          playerMap[p1Name].checkoutHits += parseInt(p1Match[1], 10);
          playerMap[p1Name].checkoutDarts += parseInt(p1Match[2], 10);
        }
        if (p2Name && coStat.p2) {
          const p2Match = String(coStat.p2).match(/\((\d+)\/(\d+)\)/);
          if (p2Match) {
            playerMap[p2Name].checkoutHits += parseInt(p2Match[1], 10);
            playerMap[p2Name].checkoutDarts += parseInt(p2Match[2], 10);
          }
        }
      }

      if (match.logs) {
        match.logs.forEach((leg) => {
          if (leg.winnerId === match.player1?.id) playerMap[p1Name].lWon++;
          else if (p2Name && leg.winnerId === match.player2?.id)
            playerMap[p2Name].lWon++;

          const processThrows = (throws: string[], name: string) => {
            throws.forEach((tStr, idx) => {
              const val = tStr === "BUST" ? 0 : parseInt(tStr);
              playerMap[name].totalPoints += val;
              playerMap[name].totalDarts += 3;
              if (idx < 3) {
                playerMap[name].first9Points += val;
                playerMap[name].first9Count += 3;
              }
              if (val >= 180) playerMap[name].s180++;
              else if (val >= 140) playerMap[name].s140++;
              else if (val >= 100) playerMap[name].s100++;
              else if (val >= 60) playerMap[name].s60++;
            });
          };

          processThrows(leg.p1Throws || [], p1Name);
          if (p2Name) processThrows(leg.p2Throws || [], p2Name);
        });
      }
    });
  });
  return playerMap;
};

export const getTournamentStatisticsAsync = async (
  history: Tournament[],
  appliedNames: string[],
  timeFilter: string,
  entityType: string,
): Promise<AggregatedStats[]> => {
  if (timeFilter !== "all")
    return calculateTournamentStatistics(
      history,
      appliedNames,
      timeFilter,
      entityType,
    );

  try {
    const CACHE_KEY = `@dart_tourney_agg_${entityType}`;
    const aggStr = await AsyncStorage.getItem(CACHE_KEY);
    let aggregate: {
      processedIds: string[];
      playerMap: Record<string, AggregatedStats>;
    } = aggStr ? JSON.parse(aggStr) : { processedIds: [], playerMap: {} };

    const relevantHistory = history.filter((t) =>
      entityType === "team"
        ? t.settings?.teamSize === "team"
        : t.settings?.teamSize !== "team",
    );
    const historyIds = new Set(relevantHistory.map((h) => h.id));
    const cachedIds = new Set(aggregate.processedIds);

    let hasDeletions = false;
    for (const id of aggregate.processedIds) {
      if (!historyIds.has(id)) {
        hasDeletions = true;
        break;
      }
    }

    if (hasDeletions) {
      const newMap = processTournamentMatchesIncremental(relevantHistory, {});
      aggregate = {
        processedIds: relevantHistory.map((h) => h.id),
        playerMap: newMap,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(aggregate));
    } else {
      const newMatches = relevantHistory.filter((h) => !cachedIds.has(h.id));
      if (newMatches.length > 0) {
        aggregate.playerMap = processTournamentMatchesIncremental(
          newMatches,
          aggregate.playerMap,
        );
        aggregate.processedIds = relevantHistory.map((h) => h.id);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(aggregate));
      }
    }
    return formatTournamentPlayerMap(aggregate.playerMap, appliedNames);
  } catch (e) {
    console.error("Aggregate tourney error:", e);
    return calculateTournamentStatistics(
      history,
      appliedNames,
      timeFilter,
      entityType,
    );
  }
};

export const calculateTournamentStatistics = (
  history: Tournament[],
  appliedNames: string[],
  timeFilter: string,
  entityType: string,
): AggregatedStats[] => {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filteredHistory = history.filter((tourney) => {
    if (entityType === "team" && tourney.settings?.teamSize !== "team")
      return false;
    if (entityType === "single" && tourney.settings?.teamSize === "team")
      return false;
    if (timeFilter === "all" || !tourney.finishedAt) return true;
    const matchDate = new Date(tourney.finishedAt);
    if (timeFilter === "today") return matchDate >= startOfToday;
    if (timeFilter === "7d") return matchDate >= sevenDaysAgo;
    if (timeFilter === "30d") return matchDate >= thirtyDaysAgo;
    return true;
  });

  const playerMap = processTournamentMatchesIncremental(filteredHistory, {});
  return formatTournamentPlayerMap(playerMap, appliedNames);
};

export const calculateTrendData = (
  history: Match[],
  appliedNames: string[],
) => {
  const chronologicalHistory = [...history]
    .filter((m) => m.mode === "X01")
    .sort(
      (a, b) =>
        parseDateString(a.date || "").getTime() -
        parseDateString(b.date || "").getTime(),
    );

  const dataByPlayer: Record<
    string,
    { labels: string[]; datasets: { data: number[] }[] }
  > = {};
  appliedNames.forEach((playerName) => {
    if (isBot(playerName)) return;

    const dataPoints: number[] = [];
    const labels: string[] = [];
    const playerMatches = chronologicalHistory.filter((match) =>
      match.players?.some((p) => p.name === playerName),
    );
    const last10 = playerMatches.slice(-10);

    last10.forEach((match) => {
      const p = match.players?.find((player) => player.name === playerName);
      if (p && p.allTurns) {
        const turns = p.allTurns;
        let pts = 0;
        let darts = 0;
        const sumOfLengths = turns.reduce(
          (acc: number, t: Turn) => acc + t.length,
          0,
        );
        const isBuggyCompressed =
          p.totalMatchDarts &&
          p.totalMatchDarts > sumOfLengths &&
          !turns.some((t: Turn) =>
            t.some(
              (d: TurnDart) =>
                typeof d === "object" && d !== null && d.d !== undefined,
            ),
          );
        turns.forEach((turn: Turn) => {
          pts += turn.reduce(
            (a: number, b: TurnDart) =>
              a + (typeof b === "number" ? b : (b.v || 0) * (b.m || 1)),
            0,
          );
          darts += isBuggyCompressed
            ? 3
            : turn.reduce(
                (a: number, b: TurnDart) =>
                  a +
                  (typeof b === "number"
                    ? 1
                    : typeof b === "object" && b !== null && b.d !== undefined
                      ? b.d
                      : 1),
                0,
              );
        });
        if (darts > 0) {
          dataPoints.push(Number(((pts / darts) * 3).toFixed(1)));
          labels.push(
            (match.date || "").split(".")[0] +
              "." +
              (match.date || "").split(".")[1],
          );
        }
      }
    });
    if (dataPoints.length >= 2)
      dataByPlayer[playerName] = { labels, datasets: [{ data: dataPoints }] };
  });
  return dataByPlayer;
};

export const calculateTournamentTrendData = (
  history: Tournament[],
  appliedNames: string[],
  entityType: string,
) => {
  const chronologicalHistory = [...history]
    .filter((t) =>
      entityType === "team"
        ? t.settings?.teamSize === "team"
        : t.settings?.teamSize !== "team",
    )
    .sort(
      (a, b) =>
        new Date(a.finishedAt || "").getTime() -
        new Date(b.finishedAt || "").getTime(),
    );

  const dataByPlayer: Record<
    string,
    { labels: string[]; datasets: { data: number[] }[] }
  > = {};
  appliedNames.forEach((playerName) => {
    if (isBot(playerName)) return;

    const dataPoints: number[] = [];
    const labels: string[] = [];
    const playerTourneys = chronologicalHistory.filter((t) =>
      t.players?.some((p) => p.name === playerName),
    );
    const last10 = playerTourneys.slice(-10);

    last10.forEach((tourney) => {
      let tPoints = 0;
      let tTurns = 0;
      tourney.bracket?.forEach((match) => {
        if (match.isBye || !match.winner || !match.logs) return;
        const isP1 = match.player1?.name === playerName;
        const isP2 = match.player2?.name === playerName;
        if (!isP1 && !isP2) return;
        match.logs.forEach((leg: LegLog) => {
          const throws = isP1 ? leg.p1Throws : leg.p2Throws;
          if (throws)
            throws.forEach((tStr) => {
              tPoints += tStr === "BUST" ? 0 : parseInt(tStr);
              tTurns++;
            });
        });
      });
      if (tTurns > 0) {
        dataPoints.push(Number((tPoints / tTurns).toFixed(1)));
        const d = new Date(tourney.finishedAt || "");
        labels.push(`${d.getDate()}.${d.getMonth() + 1}`);
      }
    });
    if (dataPoints.length >= 2)
      dataByPlayer[playerName] = { labels, datasets: [{ data: dataPoints }] };
  });
  return dataByPlayer;
};

export const getPlayersHistoricalBaseline = async (
  players: string[],
  mode: string,
): Promise<number | undefined> => {
  try {
    const historyStr = await AsyncStorage.getItem("@dart_match_history");
    if (!historyStr) return undefined;
    const history: Match[] = JSON.parse(historyStr);

    let highestAvg = 0;
    const modeHistory = history.filter((h) => h.mode === mode);
    if (modeHistory.length === 0) return undefined;

    players.forEach((playerName) => {
      let totalPts = 0;
      let totalDarts = 0;
      let totalMarks = 0;
      let totalHits = 0;

      modeHistory.forEach((match) => {
        const p = match.players?.find((x) => x.name === playerName);
        if (!p) return;

        if (mode === "X01") {
          if (p.allTurns) {
            const turns = p.allTurns;
            const sumOfLengths = turns.reduce(
              (acc: number, t: Turn) => acc + t.length,
              0,
            );
            const isBuggyCompressed =
              p.totalMatchDarts &&
              p.totalMatchDarts > sumOfLengths &&
              !turns.some((t: Turn) =>
                t.some(
                  (d: TurnDart) =>
                    typeof d === "object" && d !== null && d.d !== undefined,
                ),
              );
            turns.forEach((turn: Turn, index: number) => {
              totalPts += turn.reduce(
                (a: number, b: TurnDart) =>
                  a + (typeof b === "number" ? b : (b.v || 0) * (b.m || 1)),
                0,
              );
              let turnDarts = turn.reduce(
                (a: number, b: TurnDart) =>
                  a +
                  (typeof b === "number"
                    ? 1
                    : typeof b === "object" && b !== null && b.d !== undefined
                      ? b.d
                      : 1),
                0,
              );
              if (isBuggyCompressed && p.totalMatchDarts !== undefined)
                turnDarts =
                  index === turns.length - 1
                    ? p.totalMatchDarts - index * 3
                    : 3;
              totalDarts += turnDarts;
            });
          } else if (p.totalMatchDarts) {
            const startPts = match.settings?.startPoints || 501;
            const scored =
              p.totalMatchScore !== undefined
                ? p.totalMatchScore
                : Math.max(0, startPts - (p.score || 0));
            totalPts += scored;
            totalDarts += p.totalMatchDarts;
          }
        } else if (mode === "100 Darts") {
          totalPts += p.score || 0;
          totalDarts += p.darts || p.dartsCount || 0;
        } else if (mode === "Bob's 27") {
          totalPts += p.score || 0;
          totalDarts += 1;
        } else if (mode === "Cricket") {
          totalMarks +=
            p.totalMatchMarks !== undefined
              ? p.totalMatchMarks
              : p.totalMarks ||
                (p.marks
                  ? Object.values(p.marks).reduce(
                      (a: number, b: number) => a + b,
                      0,
                    )
                  : 0);
          totalDarts +=
            p.totalMatchDarts !== undefined ? p.totalMatchDarts : p.darts || 0;
        } else if (mode === "Around the Clock") {
          totalHits +=
            p.hits !== undefined && typeof p.hits === "number"
              ? p.hits
              : p.accuracy
                ? (parseFloat(p.accuracy) / 100) * (p.darts || 0)
                : 0;
          totalDarts += p.darts || 0;
        }
      });

      let playerAvg = 0;
      if (mode === "X01" || mode === "100 Darts") {
        if (totalDarts > 0) playerAvg = (totalPts / totalDarts) * 3;
      } else if (mode === "Bob's 27") {
        if (totalDarts > 0) playerAvg = totalPts / totalDarts;
      } else if (mode === "Cricket") {
        if (totalDarts > 0) playerAvg = (totalMarks / totalDarts) * 3;
      } else if (mode === "Around the Clock") {
        if (totalDarts > 0) playerAvg = totalHits / totalDarts;
      }

      if (playerAvg > highestAvg) highestAvg = playerAvg;
    });

    return highestAvg > 0 ? highestAvg : undefined;
  } catch (e) {
    return undefined;
  }
};
