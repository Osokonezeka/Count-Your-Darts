import { t } from "./i18n";
import { PlayerMatchStats, Turn, TurnDart } from "./statsUtils";

export type MatchHistory = {
  id: string;
  date: string;
  duration?: string;
  mode: string;
  settings?: Record<string, string | number | boolean | undefined>;
  players: PlayerMatchStats[];
  isUnfinished?: boolean;
  gameState?: Record<string, unknown>;
};

export interface ParsedMatchStat {
  name: string;
  score?: number;
  darts?: number;
  avg?: number | string;
  first9DartsPoints?: number;
  first9DartsCount?: number;
  totalPoints?: number;
  totalDarts?: number;
  checkoutDarts?: number;
  checkoutHits?: number;
  s60?: number;
  s100?: number;
  s140?: number;
  s180?: number;
  closed?: number;
  mpr?: string;
  status?: string;
  hits?: Record<number, { S: number; D: number; T: number }>;
  coords?: { x: number; y: number }[];
  tPlayed?: number;
  t1st?: number;
  t2nd?: number;
  mPlayed?: number;
  mWon?: number;
  isBust?: boolean;
  c2?: number;
  c3?: number;
  c4_6?: number;
  fails?: number;
  targetAvg?: string;
  phase1?: number;
  phase2?: number;
  phase3?: number;
  halves?: number;
  shanghais?: number;
  sHits?: number;
  dHits?: number;
  tHits?: number;
  accuracy?: string;
  reached?: number;
  scorelessInnings?: number;
}

export interface ActiveSection {
  id: string;
  title: string;
}

export const getSingleMatchStats = (
  matchToDisplay: MatchHistory | null,
  language: Parameters<typeof t>[0],
): ParsedMatchStat[] => {
  if (!matchToDisplay) return [];

  if (matchToDisplay.mode === "Cricket") {
    return matchToDisplay.players.map((p) => {
      const closedCount =
        p.totalClosedTargets !== undefined
          ? p.totalClosedTargets
          : p.marks
            ? Object.values(p.marks).filter((m: number) => m >= 3).length
            : p.closedTargets || 0;

      const totalMarks =
        p.totalMatchMarks !== undefined
          ? p.totalMatchMarks
          : p.totalMarks !== undefined
            ? p.totalMarks
            : (Object.values(p.marks || {}).reduce(
                (a: number, b: number) => a + b,
                0,
              ) as number);
      const totalDarts =
        p.totalMatchDarts !== undefined ? p.totalMatchDarts : p.darts || 0;
      const score =
        p.totalMatchScore !== undefined ? p.totalMatchScore : p.score;

      return {
        name: p.name,
        score: score,
        darts: totalDarts,
        closed: closedCount,
        mpr:
          totalDarts > 0 ? ((totalMarks / totalDarts) * 3).toFixed(2) : "0.00",
      };
    });
  }

  if (matchToDisplay.mode === "Catch 40") {
    return matchToDisplay.players.map((p) => {
      const targetsPlayed =
        (p.c2 || 0) + (p.c3 || 0) + (p.c4_6 || 0) + (p.fails || 0);
      const avg =
        targetsPlayed > 0
          ? ((p.dartsCount || p.darts || 0) / targetsPlayed).toFixed(1)
          : "0.0";
      return {
        name: p.name,
        score: p.score || 0,
        darts: p.dartsCount || p.darts || 0,
        c2: p.c2 || 0,
        c3: p.c3 || 0,
        c4_6: p.c4_6 || 0,
        fails: p.fails || 0,
        targetAvg: avg,
      };
    });
  }

  if (matchToDisplay.mode === "JDC Challenge") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      darts: p.dartsCount || p.darts || 0,
      phase1: p.phase1 || 0,
      phase2: p.phase2 || 0,
      phase3: p.phase3 || 0,
    }));
  }

  if (matchToDisplay.mode === "Bermuda Triangle") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      halves: p.halves || 0,
    }));
  }

  if (matchToDisplay.mode === "Halve-It") {
    return matchToDisplay.players.map((p) => {
      const darts = p.dartsCount || p.darts || 0;
      return {
        name: p.name,
        score: p.score || 0,
        halves: p.halves || 0,
        sHits: p.sHits || 0,
        dHits: p.dHits || 0,
        tHits: p.tHits || 0,
        accuracy:
          darts > 0
            ? ((((p.hits as number) || 0) / darts) * 100).toFixed(1) + "%"
            : "0%",
      };
    });
  }

  if (matchToDisplay.mode === "Shanghai") {
    return matchToDisplay.players.map((p) => {
      const darts = p.dartsCount || p.darts || 0;
      const reached = Math.min(20, Math.floor(Math.max(0, darts - 1) / 3) + 1);
      return {
        name: p.name,
        score: p.score || 0,
        shanghais: p.shanghais || 0,
        sHits: p.sHits || 0,
        dHits: p.dHits || 0,
        tHits: p.tHits || 0,
        accuracy:
          darts > 0
            ? ((((p.hits as number) || 0) / darts) * 100).toFixed(1) + "%"
            : "0%",
        reached,
      };
    });
  }

  if (matchToDisplay.mode === "Baseball") {
    return matchToDisplay.players.map((p) => {
      return {
        name: p.name,
        score: p.score || 0,
        sHits: p.sHits || 0,
        dHits: p.dHits || 0,
        tHits: p.tHits || 0,
        scorelessInnings: p.scorelessInnings || 0,
        accuracy:
          p.dartsCount && p.dartsCount > 0
            ? ((((p.hits as number) || 0) / p.dartsCount) * 100).toFixed(1) +
              "%"
            : "0%",
      };
    });
  }

  if (matchToDisplay.mode === "Chase the Dragon") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      darts: p.darts || 0,
      accuracy: p.accuracy || "0%",
    }));
  }

  if (matchToDisplay.mode === "Around the Clock") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      darts: p.darts || 0,
      avg: p.accuracy || "0%",
    }));
  }

  if (matchToDisplay.mode === "Bob's 27") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      darts: p.darts || 0,
      status: p.isBust
        ? t(language, "bust").toUpperCase()
        : t(language, "cleared").toUpperCase(),
      isBust: p.isBust,
    }));
  }

  if (matchToDisplay.mode === "121_checkout") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 120,
      darts: p.totalMatchDarts || p.darts || 0,
      accuracy:
        p.checkoutDarts && p.checkoutDarts > 0
          ? (((p.checkoutHits || 0) / p.checkoutDarts) * 100).toFixed(1) + "%"
          : "0%",
    }));
  }

  if (matchToDisplay.mode === "Killer") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      darts: p.darts || 0,
      status:
        p.status === "winner"
          ? t(language, "winner").toUpperCase()
          : p.status === "eliminated"
            ? t(language, "eliminated").toUpperCase()
            : p.status === "alive"
              ? t(language, "alive").toUpperCase()
              : t(language, "unknown").toUpperCase(),
    }));
  }

  if (matchToDisplay.mode === "Score Clash") {
    return matchToDisplay.players.map((p) => ({
      name: p.name,
      score: p.score || 0,
      totalPoints: p.totalMatchScore || 0,
      darts: p.darts || 0,
      avg:
        p.darts && p.darts > 0
          ? (((p.totalMatchScore || 0) / p.darts) * 3).toFixed(1)
          : "0.0",
    }));
  }

  if (matchToDisplay.mode === "100 Darts") {
    return matchToDisplay.players.map((p) => {
      const hits: Record<number, { S: number; D: number; T: number }> = {};
      [...Array(20)].forEach((_, i) => (hits[i + 1] = { S: 0, D: 0, T: 0 }));
      hits[25] = { S: 0, D: 0, T: 0 };
      hits[0] = { S: 0, D: 0, T: 0 };

      if (p.allTurns) {
        p.allTurns.forEach((turn: Turn) => {
          turn.forEach((dart: TurnDart) => {
            if (
              dart &&
              typeof dart === "object" &&
              dart.v !== undefined &&
              hits[dart.v]
            ) {
              if (dart.m === 1) hits[dart.v].S++;
              if (dart.m === 2) hits[dart.v].D++;
              if (dart.m === 3) hits[dart.v].T++;
            }
          });
        });
      }

      return {
        name: p.name,
        score: p.score || 0,
        darts: p.darts || 0,
        avg: p.avg || "0.0",
        s140: p.s140 || 0,
        s180: p.s180 || 0,
        hits,
      };
    });
  }

  const playerMap: Record<string, ParsedMatchStat> = {};
  const winner = [...matchToDisplay.players].sort(
    (a, b) =>
      (b.sets || 0) - (a.sets || 0) ||
      (b.legs || 0) - (a.legs || 0) ||
      (a.score || 0) - (b.score || 0),
  )[0];

  matchToDisplay.players.forEach((p: PlayerMatchStats) => {
    playerMap[p.name] = {
      name: p.name,
      mPlayed: 1,
      mWon: winner && p.name === winner.name ? 1 : 0,
      totalPoints: 0,
      totalDarts: 0,
      first9DartsPoints: 0,
      first9DartsCount: 0,
      checkoutDarts: p.checkoutDarts || 0,
      checkoutHits: p.checkoutHits || 0,
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
      (_, i) => (playerMap[p.name].hits![i + 1] = { S: 0, D: 0, T: 0 }),
    );
    playerMap[p.name].hits![25] = { S: 0, D: 0, T: 0 };
    playerMap[p.name].hits![0] = { S: 0, D: 0, T: 0 };

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

        playerMap[p.name].totalPoints! += turnSum;
        playerMap[p.name].totalDarts! += turnDarts;
        if (index < 3) {
          playerMap[p.name].first9DartsPoints! += turnSum;
          playerMap[p.name].first9DartsCount! += turnDarts;
        }
        if (turnSum >= 180) playerMap[p.name].s180!++;
        else if (turnSum >= 140) playerMap[p.name].s140!++;
        else if (turnSum >= 100) playerMap[p.name].s100!++;
        else if (turnSum >= 60) playerMap[p.name].s60!++;
        turn.forEach((dart: TurnDart) => {
          const isScoreInput =
            (typeof dart === "object" && dart !== null && dart.i === true) ||
            isBuggyCompressed;
          if (isScoreInput) return;
          if (typeof dart === "object" && dart !== null && dart.c)
            playerMap[p.name].coords!.push(dart.c);

          if (
            typeof dart === "object" &&
            dart !== null &&
            dart.v !== undefined &&
            playerMap[p.name].hits![dart.v]
          ) {
            if (dart.m === 1) playerMap[p.name].hits![dart.v].S++;
            if (dart.m === 2) playerMap[p.name].hits![dart.v].D++;
            if (dart.m === 3) playerMap[p.name].hits![dart.v].T++;
          }
        });
      });
    }
  });
  return Object.values(playerMap);
};

export const getActiveSections = (
  matchToDisplay: MatchHistory | null,
  singleMatchStats: ParsedMatchStat[],
  language: Parameters<typeof t>[0],
): ActiveSection[] => {
  if (!matchToDisplay) return [];

  const hasAnyHits = singleMatchStats.some((s: ParsedMatchStat) => {
    if (!s.hits) return false;
    return Object.values(s.hits).some(
      (h: { S: number; D: number; T: number }) =>
        h.S > 0 || h.D > 0 || h.T > 0,
    );
  });

  if (matchToDisplay.mode === "Cricket") {
    return [
      {
        id: "cricket_summary",
        title: t(language, "cricketSummary"),
      },
    ];
  }

  if (matchToDisplay.mode === "Around the Clock") {
    return [
      {
        id: "aroundtheclock_summary",
        title: t(language, "aroundTheClock"),
      },
    ];
  }

  if (matchToDisplay.mode === "Bob's 27") {
    return [
      { id: "bob27_summary", title: t(language, "bobs27") },
    ];
  }

  if (matchToDisplay.mode === "Catch 40") {
    return [
      { id: "catch40_summary", title: t(language, "catch40") },
      { id: "catch40_details", title: t(language, "scoring") },
    ];
  }

  if (matchToDisplay.mode === "JDC Challenge") {
    return [
      {
        id: "jdc_summary",
        title: t(language, "jdcChallenge"),
      },
      { id: "jdc_details", title: t(language, "scoring") },
    ];
  }

  if (matchToDisplay.mode === "Bermuda Triangle") {
    return [
      {
        id: "bermuda_summary",
        title: t(language, "bermudaTriangle"),
      },
    ];
  }

  if (matchToDisplay.mode === "Halve-It") {
    return [
      { id: "halveit_summary", title: t(language, "halveIt") },
      { id: "halveit_details", title: t(language, "scoring") },
    ];
  }

  if (matchToDisplay.mode === "Shanghai") {
    return [
      {
        id: "shanghai_summary",
        title: t(language, "shanghai"),
      },
      { id: "shanghai_details", title: t(language, "scoring") },
    ];
  }

  if (matchToDisplay.mode === "Baseball") {
    return [
      {
        id: "baseball_summary",
        title: t(language, "baseball"),
      },
      { id: "baseball_details", title: t(language, "scoring") },
    ];
  }

  if (matchToDisplay.mode === "Chase the Dragon") {
    return [
      {
        id: "dragon_summary",
        title: t(language, "chaseTheDragon"),
      },
    ];
  }

  if (matchToDisplay.mode === "121_checkout") {
    return [
      {
        id: "121_checkout_summary",
        title: t(language, "121Checkout"),
      },
    ];
  }

  if (matchToDisplay.mode === "Killer") {
    return [
      {
        id: "killer_summary",
        title: t(language, "killer"),
      },
    ];
  }

  if (matchToDisplay.mode === "Score Clash") {
    return [
      {
        id: "score_clash_summary",
        title: t(language, "scoreClash"),
      },
    ];
  }

  if (matchToDisplay.mode === "100 Darts") {
    const sections = [
      {
        id: "hundreddarts_summary",
        title: t(language, "100Darts"),
      },
    ];
    if (hasAnyHits) {
      sections.push({
        id: "hit_chart",
        title: t(language, "sectorsHeader"),
      });
    }
    const hasAnyCoords = singleMatchStats.some(
      (s: ParsedMatchStat) => s.coords && s.coords.length > 0,
    );
    if (hasAnyCoords) {
      sections.push({
        id: "heatmap",
        title: t(language, "heatmap"),
      });
    }
    return sections;
  }

  const sections = [
    {
      id: "performance",
      title: t(language, "avgHeader"),
    },
    {
      id: "checkouts",
      title: t(language, "gameDartsHeader"),
    },
    {
      id: "scoring",
      title:
        t(language, "scoringHeader"),
    },
  ];

  if (hasAnyHits)
    sections.push({
      id: "hit_chart",
      title: t(language, "sectorsHeader"),
    });

  const hasAnyCoords = singleMatchStats.some(
    (s: ParsedMatchStat) => s.coords && s.coords.length > 0,
  );
  if (hasAnyCoords)
    sections.push({
      id: "heatmap",
      title: t(language, "heatmap"),
    });

  return sections;
};
