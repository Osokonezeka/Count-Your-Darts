import { getCheckoutInfo } from "./checkouts";

export const breakdownScoreToDarts = (
  score: number,
  dartsCount: number,
  isCheckout: boolean = false,
  hasOpened: boolean = true,
  inRule: "straight" | "double" | "master" = "straight",
  outRule: "straight" | "double" | "master" = "double",
  originalScore?: number,
): { value: number; multiplier: number }[] => {
  const aims =
    inRule === "master"
      ? [
          { v: 20, m: 3 },
          { v: 20, m: 2 },
        ]
      : [
          { v: 20, m: 2 },
          { v: 16, m: 2 },
        ];
  const aim = aims[Math.floor(Math.random() * aims.length)];

  if (score === 0) {
    if (!hasOpened && inRule !== "straight") {
      return Array(dartsCount)
        .fill(0)
        .map(() => {
          const roll = Math.random();
          if (roll < 0.5) return { value: aim.v, multiplier: 1 };
          if (roll < 0.8) {
            if (aim.v === 20)
              return { value: Math.random() < 0.5 ? 1 : 5, multiplier: 1 };
            if (aim.v === 16)
              return { value: Math.random() < 0.5 ? 8 : 7, multiplier: 1 };
          }
          return { value: 0, multiplier: 1 };
        });
    }
    return Array(dartsCount).fill({ value: 0, multiplier: 1 });
  }

  if (isCheckout && outRule !== "straight" && score > 0) {
    const checkoutStr = getCheckoutInfo(score);
    if (checkoutStr) {
      const parts = checkoutStr.split(" ");
      const darts = parts.map((p) => {
        if (p === "BULL") return { value: 25, multiplier: 2 };
        if (p === "25") return { value: 25, multiplier: 1 };
        if (p.startsWith("T"))
          return { value: parseInt(p.slice(1)), multiplier: 3 };
        if (p.startsWith("D"))
          return { value: parseInt(p.slice(1)), multiplier: 2 };
        return { value: parseInt(p), multiplier: 1 };
      });

      while (darts.length < dartsCount && darts.length < 3) {
        darts.unshift({ value: 0, multiplier: 1 });
      }
      return darts;
    }
  }

  const isOpening = !hasOpened && inRule !== "straight";
  let prefixMisses: { value: number; multiplier: number }[] = [];
  let activeDartsCount = dartsCount;

  if (isOpening) {
    let openingIdx = 0;
    if (dartsCount === 3) {
      if (score <= 40) openingIdx = Math.random() < 0.6 ? 2 : 1;
      else if (score <= 80) openingIdx = Math.random() < 0.4 ? 1 : 0;
    } else if (dartsCount === 2) {
      if (score <= 40) openingIdx = Math.random() < 0.5 ? 1 : 0;
    }

    prefixMisses = Array(openingIdx)
      .fill(0)
      .map(() => {
        const roll = Math.random();
        if (roll < 0.5) return { value: aim.v, multiplier: 1 };
        if (roll < 0.8) {
          if (aim.v === 20)
            return { value: Math.random() < 0.5 ? 1 : 5, multiplier: 1 };
          if (aim.v === 16)
            return { value: Math.random() < 0.5 ? 8 : 7, multiplier: 1 };
        }
        return { value: 0, multiplier: 1 };
      });

    activeDartsCount = dartsCount - openingIdx;
  }

  if (
    !isCheckout &&
    originalScore !== undefined &&
    originalScore > 0 &&
    outRule !== "straight"
  ) {
    const checkoutStr = getCheckoutInfo(originalScore);
    if (checkoutStr) {
      const parts = checkoutStr.split(" ");
      const lastPart = parts[parts.length - 1];

      if (activeDartsCount >= parts.length) {
        let setupScore = 0;
        let setupDarts: { value: number; multiplier: number }[] = [];
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i];
          if (p === "BULL") {
            setupScore += 50;
            setupDarts.push({ value: 25, multiplier: 2 });
          } else if (p === "25") {
            setupScore += 25;
            setupDarts.push({ value: 25, multiplier: 1 });
          } else if (p.startsWith("T")) {
            const val = parseInt(p.slice(1));
            setupScore += val * 3;
            setupDarts.push({ value: val, multiplier: 3 });
          } else if (p.startsWith("D")) {
            const val = parseInt(p.slice(1));
            setupScore += val * 2;
            setupDarts.push({ value: val, multiplier: 2 });
          } else {
            const val = parseInt(p);
            setupScore += val;
            setupDarts.push({ value: val, multiplier: 1 });
          }
        }

        let missedDart: { value: number; multiplier: number } | null = null;

        if (lastPart.startsWith("D")) {
          const targetDouble = parseInt(lastPart.slice(1));

          if (score === setupScore + targetDouble) {
            missedDart = { value: targetDouble, multiplier: 1 };
          } else if (score === setupScore) {
            missedDart = { value: 0, multiplier: 1 };
          } else {
            const neighbors: Record<number, number[]> = {
              20: [1, 5],
              19: [3, 7],
              18: [1, 4],
              17: [2, 3],
              16: [8, 7],
              15: [10, 2],
              14: [9, 11],
              13: [6, 4],
              12: [9, 5],
              11: [14, 8],
              10: [15, 6],
              9: [12, 14],
              8: [11, 16],
              7: [16, 19],
              6: [10, 13],
              5: [20, 12],
              4: [18, 13],
              3: [19, 17],
              2: [17, 15],
              1: [20, 18],
            };
            const targetNeighbors = neighbors[targetDouble] || [];
            for (const n of targetNeighbors) {
              if (score === setupScore + n) {
                missedDart = { value: n, multiplier: 1 };
                break;
              }
            }
          }
        } else if (lastPart === "BULL") {
          if (score === setupScore + 25) {
            missedDart = { value: 25, multiplier: 1 };
          } else if (score === setupScore) {
            missedDart = { value: 0, multiplier: 1 };
          }
        }

        if (missedDart) {
          const result = [...prefixMisses, ...setupDarts, missedDart];
          while (result.length < dartsCount) {
            result.push({ value: 0, multiplier: 1 });
          }
          return result;
        }
      }
    }
  }

  if (
    activeDartsCount === 3 &&
    !isOpening &&
    (!isCheckout || outRule === "straight")
  ) {
    if (score === 180)
      return [
        { value: 20, multiplier: 3 },
        { value: 20, multiplier: 3 },
        { value: 20, multiplier: 3 },
      ];
    if (score === 140)
      return [
        { value: 20, multiplier: 3 },
        { value: 20, multiplier: 3 },
        { value: 20, multiplier: 1 },
      ];
    if (score === 135)
      return [
        { value: 20, multiplier: 3 },
        { value: 25, multiplier: 1 },
        { value: 25, multiplier: 2 },
      ];
    if (score === 100)
      return [
        { value: 20, multiplier: 3 },
        { value: 20, multiplier: 1 },
        { value: 20, multiplier: 1 },
      ];
    if (score === 85)
      return [
        { value: 20, multiplier: 3 },
        { value: 17, multiplier: 1 },
        { value: 8, multiplier: 1 },
      ];
    if (score === 60)
      return [
        { value: 20, multiplier: 1 },
        { value: 20, multiplier: 1 },
        { value: 20, multiplier: 1 },
      ];
    if (score === 45)
      return [
        { value: 15, multiplier: 1 },
        { value: 15, multiplier: 1 },
        { value: 15, multiplier: 1 },
      ];
    if (score === 41)
      return [
        { value: 20, multiplier: 1 },
        { value: 20, multiplier: 1 },
        { value: 1, multiplier: 1 },
      ];
    if (score === 26)
      return [
        { value: 20, multiplier: 1 },
        { value: 5, multiplier: 1 },
        { value: 1, multiplier: 1 },
      ];
  }

  const ALL_DARTS: { v: number; m: number }[] = [];
  for (let i = 20; i >= 1; i--) {
    ALL_DARTS.push({ v: i, m: 3 }, { v: i, m: 2 }, { v: i, m: 1 });
  }
  ALL_DARTS.push({ v: 25, m: 2 }, { v: 25, m: 1 }, { v: 0, m: 1 });

  ALL_DARTS.sort((a, b) => {
    const valA = a.v * a.m;
    const valB = b.v * b.m;
    if (valA !== valB) return valB - valA;
    return a.m - b.m;
  });

  const findCombo = (
    target: number,
    dartsLeft: number,
    allowMiss: boolean,
  ): { v: number; m: number }[] | null => {
    if (dartsLeft === 0) return target === 0 ? [] : null;

    const isFirstDart = dartsLeft === activeDartsCount;
    const isLastDart = dartsLeft === 1 && target > 0;

    for (const dart of ALL_DARTS) {
      if (!allowMiss && dart.v === 0) continue;

      if (isOpening && isFirstDart) {
        if (inRule === "double" && dart.m !== 2) continue;
        if (inRule === "master" && dart.m !== 2 && dart.m !== 3) continue;
      }

      if (isCheckout && isLastDart && target === dart.v * dart.m) {
        if (outRule === "double" && dart.m !== 2) continue;
        if (outRule === "master" && dart.m !== 2 && dart.m !== 3) continue;
      }

      const dartVal = dart.v * dart.m;
      if (dartVal <= target) {
        if (
          !allowMiss &&
          dartsLeft > 1 &&
          target <= dartsLeft * 20 &&
          dartVal > 20
        )
          continue;

        const remainder = target - dartVal;
        if (remainder > (dartsLeft - 1) * 60) continue;

        const subCombo = findCombo(remainder, dartsLeft - 1, allowMiss);
        if (subCombo) return [dart, ...subCombo];
      }
    }
    return null;
  };

  let combo =
    findCombo(score, activeDartsCount, false) ||
    findCombo(score, activeDartsCount, true);

  if (combo) {
    let resultCombo: { value: number; multiplier: number }[] = [];
    if (isOpening || (isCheckout && outRule !== "straight")) {
      resultCombo = combo.map((d) => ({ value: d.v, multiplier: d.m }));
    } else {
      resultCombo = combo
        .sort(() => Math.random() - 0.5)
        .map((d) => ({ value: d.v, multiplier: d.m }));
    }
    return [...prefixMisses, ...resultCombo];
  }

  const fallback: { value: number; multiplier: number }[] = [];
  let remainingScore = score;
  for (let i = 0; i < activeDartsCount; i++) {
    if (i === activeDartsCount - 1) {
      fallback.push({ value: remainingScore, multiplier: 1 });
    } else {
      const part = Math.floor(remainingScore / (activeDartsCount - i));
      fallback.push({ value: part, multiplier: 1 });
      remainingScore -= part;
    }
  }
  return [...prefixMisses, ...fallback];
};

export const getBotDifficultyFromName = (name: string): number | null => {
  if (
    /(adaptive|adaptacyjny)/i.test(name) &&
    name.toLowerCase().includes("bot")
  ) {
    return 0;
  }
  const match = name.match(/\((.*?)\)/);
  if (match && match[1]) {
    const numberMatch = match[1].match(/\d+/);
    if (numberMatch) {
      const level = parseInt(numberMatch[0], 10);
      return 20 + level * 5;
    }
  }
  return null;
};

export interface BotPlayerState {
  name: string;
  score?: number;
  darts?: number;
  dartsCount?: number;
  totalMatchDarts?: number;
  totalMatchScore?: number;
  marks?: Record<number, number>;
  hits?: number;
}

export interface BotMatchSettings {
  startPoints?: number;
  [key: string]: string | number | boolean | undefined;
}

export const resolveBotAverage = (
  botName: string,
  playerStates: BotPlayerState[],
  mode: "X01" | "100 Darts" | "Cricket" | "Around the Clock" | "Bob's 27",
  settings?: BotMatchSettings,
  historicalBaseline?: number,
): number | null => {
  const baseAvg = getBotDifficultyFromName(botName);
  if (baseAvg === null) return null;
  if (baseAvg !== 0) return baseAvg;

  const humans = playerStates.filter(
    (p) => getBotDifficultyFromName(p.name) === null,
  );
  if (humans.length === 0) return 45;

  let highestPPA = 0;
  let highestMPR = 0;
  let highestAcc = 0;
  let highestScore = -999;

  let maxDarts = 0;
  const anchorWeight = 6;

  if (mode === "X01") {
    const startPoints = settings?.startPoints || 501;
    humans.forEach((h) => {
      const darts = h.totalMatchDarts || h.darts || 0;
      if (darts > maxDarts) maxDarts = darts;
      if (darts > 0) {
        const score =
          h.totalMatchScore !== undefined
            ? h.totalMatchScore
            : startPoints - (h.score || 0);
        const ppa = (score / darts) * 3;
        if (ppa > highestPPA) highestPPA = ppa;
      }
    });

    const anchor = historicalBaseline !== undefined ? historicalBaseline : 45;
    const smoothedPPA =
      (anchor * anchorWeight + highestPPA * maxDarts) /
      (anchorWeight + maxDarts);
    return Math.max(20, Math.min(120, Math.round(smoothedPPA + 2)));
  } else if (mode === "100 Darts") {
    humans.forEach((h) => {
      const darts = h.dartsCount !== undefined ? h.dartsCount : h.darts || 0;
      if (darts > maxDarts) maxDarts = darts;
      if (darts > 0) {
        const ppa = ((h.score || 0) / darts) * 3;
        if (ppa > highestPPA) highestPPA = ppa;
      }
    });

    const anchor = historicalBaseline !== undefined ? historicalBaseline : 45;
    const smoothedPPA =
      (anchor * anchorWeight + highestPPA * maxDarts) /
      (anchorWeight + maxDarts);
    return Math.max(20, Math.min(120, Math.round(smoothedPPA + 2)));
  } else if (mode === "Cricket") {
    humans.forEach((h) => {
      const darts = h.darts || 0;
      if (darts > maxDarts) maxDarts = darts;
      if (darts > 0) {
        const marks = Object.values(h.marks || {}).reduce(
          (a: number, b: number) => a + b,
          0,
        ) as number;
        const mpr = (marks / darts) * 3;
        if (mpr > highestMPR) highestMPR = mpr;
      }
    });

    const anchor = historicalBaseline !== undefined ? historicalBaseline : 1.2;
    const smoothedMPR =
      (anchor * anchorWeight + highestMPR * maxDarts) /
      (anchorWeight + maxDarts);
    const convertedAvg = smoothedMPR * 22 + 18;
    return Math.max(20, Math.min(120, Math.round(convertedAvg)));
  } else if (mode === "Around the Clock") {
    humans.forEach((h) => {
      const darts = h.darts || 0;
      if (darts > maxDarts) maxDarts = darts;
      if (darts > 0) {
        const acc = (h.hits || 0) / darts;
        if (acc > highestAcc) highestAcc = acc;
      }
    });

    const anchor = historicalBaseline !== undefined ? historicalBaseline : 0.25;
    const smoothedAcc =
      (anchor * anchorWeight + highestAcc * maxDarts) /
      (anchorWeight + maxDarts);
    const convertedAvg = (smoothedAcc / 0.9) * 120 + 5;
    return Math.max(20, Math.min(120, Math.round(convertedAvg)));
  } else if (mode === "Bob's 27") {
    humans.forEach((h) => {
      const darts = h.darts || 0;
      if (darts > maxDarts) maxDarts = darts;
      if ((h.score || 0) > highestScore) highestScore = h.score || 0;
    });

    let currentAvg = 40;
    if (highestScore > 27) currentAvg = 45 + highestScore / 10;

    let anchorAvg = 45;
    if (historicalBaseline !== undefined)
      anchorAvg = historicalBaseline > 27 ? 45 + historicalBaseline / 10 : 40;
    const smoothedAvg =
      (anchorAvg * anchorWeight + currentAvg * maxDarts) /
      (anchorWeight + maxDarts);
    return Math.max(20, Math.min(120, Math.round(smoothedAvg)));
  }

  return 45;
};

export const getBotCheckoutChance = (targetAverage: number): number => {
  if (targetAverage >= 120) return 85;

  const level = Math.max(0, Math.min(19, Math.round((targetAverage - 20) / 5)));
  let checkoutChance = 5.5 + level * 3.5;
  if (level === 18) checkoutChance = 70;
  if (level === 19) checkoutChance = 75;

  return checkoutChance;
};

export const simulateBotTurn = (
  targetAverage: number,
  remainingPoints: number,
  hasOpened: boolean = true,
  inRule: "straight" | "double" | "master" = "straight",
  outRule: "straight" | "double" | "master" = "double",
): number => {
  if (!hasOpened && inRule !== "straight") {
    const checkoutChance = getBotCheckoutChance(targetAverage);
    const openChance =
      inRule === "master" ? checkoutChance * 1.5 : checkoutChance;

    if (targetAverage >= 120) {
      if (Math.random() > 0.85) return 0;
    } else {
      if (Math.random() * 100 > openChance) return 0;
    }
  }

  if (targetAverage >= 120) {
    let isSetup = false;
    if (outRule === "straight") {
      isSetup = remainingPoints <= 180;
    } else {
      const bogeyNumbers = [169, 168, 166, 165, 163, 162, 159];
      isSetup =
        remainingPoints <= 170 && !bogeyNumbers.includes(remainingPoints);
    }

    if (isSetup) {
      if (Math.random() < (outRule === "straight" ? 0.95 : 0.85))
        return remainingPoints;
      return 0;
    }

    const bossScores = [100, 135, 140, 140, 171, 180, 180];
    let bossScore = bossScores[Math.floor(Math.random() * bossScores.length)];

    if (bossScore >= remainingPoints - 1) return 0;
    return bossScore;
  }

  if (outRule !== "straight") {
    const bogeyNumbers = [169, 168, 166, 165, 163, 162, 159];
    const isSetup =
      remainingPoints <= 170 && !bogeyNumbers.includes(remainingPoints);

    if (isSetup) {
      let dartsNeeded = 1;
      if (remainingPoints > 50) dartsNeeded = 2;
      if (remainingPoints > 110) dartsNeeded = 3;

      let baseDoubleChance = getBotCheckoutChance(targetAverage) / 100;
      if (outRule === "master") baseDoubleChance *= 1.2;

      let setupDartChance = Math.max(0.05, (targetAverage / 120) * 0.7);
      let actualWinChance = baseDoubleChance;
      if (dartsNeeded === 2) actualWinChance *= setupDartChance;
      if (dartsNeeded === 3)
        actualWinChance *= setupDartChance * setupDartChance;

      if (Math.random() <= actualWinChance) {
        return remainingPoints;
      }

      if (remainingPoints <= 50) {
        let leave = 0;
        const mistakeChance = 1 - targetAverage / 120;
        if (Math.random() < mistakeChance) {
          const badLeaves = [
            3, 5, 7, 9, 10, 11, 13, 14, 15, 18, 21, 22, 26, 30, 34, 38,
          ];
          leave = badLeaves[Math.floor(Math.random() * badLeaves.length)];
        } else {
          const safeLeaves = [2, 4, 8, 16, 20, 24, 32, 36, 40];
          leave = safeLeaves[Math.floor(Math.random() * safeLeaves.length)];
        }
        if (remainingPoints > leave) return remainingPoints - leave;
        return 0;
      }
    }
  }

  let u1 = 0,
    u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const stdDev = 15 + (targetAverage / 120) * 18;

  let score = Math.round(targetAverage + z0 * stdDev);
  score = Math.max(0, Math.min(180, score));

  if (Math.random() < 0.25) {
    const attractors = [26, 41, 45, 60, 81, 85, 100, 121, 125, 135, 140, 180];
    let closest = attractors[0];
    let minDiff = Math.abs(score - closest);
    for (const a of attractors) {
      const diff = Math.abs(score - a);
      if (diff < minDiff) {
        minDiff = diff;
        closest = a;
      }
    }
    if (minDiff <= 8) score = closest;
  }

  const impossibleScores = [163, 166, 169, 172, 173, 175, 176, 178, 179];
  if (impossibleScores.includes(score)) {
    score -= 1;
  }

  if (
    outRule !== "straight" &&
    remainingPoints > 40 &&
    score < remainingPoints
  ) {
    const currentLeave = remainingPoints - score;

    if (currentLeave <= 200) {
      const isSmartSetup = Math.random() < targetAverage / 110;

      if (isSmartSetup) {
        const goodLeaves = [
          16, 24, 32, 36, 40, 50, 56, 60, 64, 72, 80, 84, 96, 100, 121, 132,
          170,
        ];
        let bestScore = score;
        let minDiff = 999;
        for (const gl of goodLeaves) {
          const reqScore = remainingPoints - gl;
          if (
            reqScore > 0 &&
            reqScore <= 180 &&
            !impossibleScores.includes(reqScore)
          ) {
            const diff = Math.abs(reqScore - score);
            if (diff < minDiff) {
              minDiff = diff;
              bestScore = reqScore;
            }
          }
        }
        if (minDiff <= 30) score = bestScore;
      } else {
        const mistakeChance = 1 - targetAverage / 120;
        if (Math.random() < mistakeChance) {
          const badLeaves = [
            169, 168, 166, 165, 163, 162, 159, 39, 38, 37, 35, 34, 33, 31, 30,
            28, 26, 22, 18, 15, 14, 10, 6,
          ];
          let bestScore = score;
          let minDiff = 999;
          for (const bl of badLeaves) {
            const reqScore = remainingPoints - bl;
            if (
              reqScore > 0 &&
              reqScore <= 180 &&
              !impossibleScores.includes(reqScore)
            ) {
              const diff = Math.abs(reqScore - score);
              if (diff < minDiff) {
                minDiff = diff;
                bestScore = reqScore;
              }
            }
          }
          if (minDiff <= 25) score = bestScore;
        }
      }
    }
  }

  if (!hasOpened && inRule !== "straight" && score < 2) score = 2;

  if (outRule !== "straight") {
    if (score >= remainingPoints - 1) return 0;

    if (remainingPoints > 50 && score < remainingPoints) {
      const currentLeave = remainingPoints - score;
      if (currentLeave <= 200) {
        const isSmartSetup = Math.random() < targetAverage / 110;
        if (isSmartSetup) {
          const goodLeaves = [
            16, 24, 32, 36, 40, 50, 56, 60, 64, 72, 80, 84, 96, 100, 121, 132,
            170,
          ];
          let bestScore = score;
          let minDiff = 999;
          for (const gl of goodLeaves) {
            const reqScore = remainingPoints - gl;
            if (
              reqScore > 0 &&
              reqScore <= 180 &&
              !impossibleScores.includes(reqScore)
            ) {
              const diff = Math.abs(reqScore - score);
              if (diff < minDiff) {
                minDiff = diff;
                bestScore = reqScore;
              }
            }
          }
          if (minDiff <= 30) score = bestScore;
        } else {
          const mistakeChance = 1 - targetAverage / 120;
          if (Math.random() < mistakeChance) {
            const badLeaves = [
              169, 168, 166, 165, 163, 162, 159, 39, 38, 37, 35, 34, 33, 31, 30,
              28, 26, 22, 18, 15, 14, 10, 6,
            ];
            let bestScore = score;
            let minDiff = 999;
            for (const bl of badLeaves) {
              const reqScore = remainingPoints - bl;
              if (
                reqScore > 0 &&
                reqScore <= 180 &&
                !impossibleScores.includes(reqScore)
              ) {
                const diff = Math.abs(reqScore - score);
                if (diff < minDiff) {
                  minDiff = diff;
                  bestScore = reqScore;
                }
              }
            }
            if (minDiff <= 25) score = bestScore;
          }
        }
      }
    }
  } else {
    if (score >= remainingPoints) return remainingPoints;
  }

  return score;
};

export const simulateClockBotThrow = (
  targetAverage: number,
  isBull: boolean,
): boolean => {
  if (targetAverage >= 120) {
    return Math.random() < (isBull ? 0.75 : 0.95);
  }

  let baseChance = (targetAverage / 120) * 90;

  if (isBull) baseChance *= 0.55;

  return Math.random() * 100 <= baseChance;
};

export const simulateBobsBotThrow = (
  targetAverage: number,
  isBull: boolean,
): boolean => {
  if (targetAverage >= 120) {
    return Math.random() < (isBull ? 0.35 : 0.6);
  }

  let doubleChance = getBotCheckoutChance(targetAverage) * 0.7;

  if (isBull) doubleChance *= 0.5;

  return Math.random() * 100 <= doubleChance;
};

export const getCricketBotTarget = (
  botAvg: number,
  botMarks: Record<number, number>,
  playerMarks: Record<number, number>,
  botScore: number,
  playerScore: number,
  cricketMode: "standard" | "no-score" = "standard",
): number => {
  const targets = [20, 19, 18, 17, 16, 15, 25];

  if (cricketMode === "standard" && playerScore >= botScore - 25) {
    for (const t of targets) {
      if ((botMarks[t] || 0) >= 3 && (playerMarks[t] || 0) < 3) {
        return t;
      }
    }
  }

  if (botAvg >= 85) {
    for (const t of targets) {
      if ((botMarks[t] || 0) < 3 && (playerMarks[t] || 0) >= 2) {
        return t;
      }
    }
  }

  for (const t of targets) {
    if ((botMarks[t] || 0) < 3) {
      return t;
    }
  }

  if (cricketMode === "standard" && playerScore > botScore) {
    for (const t of targets) {
      if ((botMarks[t] || 0) >= 3 && (playerMarks[t] || 0) < 3) {
        return t;
      }
    }
  }

  return 25;
};

export const simulateCricketBotThrow = (
  targetAverage: number,
  target: number,
): { hit: boolean; multiplier: number; missedValue?: number } => {
  const getMissedValue = (t: number) => {
    const NEIGHBORS: Record<number, number[]> = {
      20: [1, 5],
      19: [3, 7],
      18: [1, 4],
      17: [2, 3],
      16: [8, 7],
      15: [10, 2],
      25: [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      ],
    };
    const neighbors = NEIGHBORS[t] || [0];
    if (targetAverage < 40 && Math.random() < 0.15) return 0;
    return neighbors[Math.floor(Math.random() * neighbors.length)];
  };

  if (targetAverage >= 120) {
    const roll = Math.random();
    if (roll < 0.45) return { hit: true, multiplier: 3 };
    if (roll < 0.7) return { hit: true, multiplier: 2 };
    if (roll < 0.95) return { hit: true, multiplier: 1 };
    return { hit: false, multiplier: 1, missedValue: getMissedValue(target) };
  }

  const hitChance = (targetAverage / 120) * 85;
  const tripleChance = (targetAverage / 120) * 35;
  const doubleChance = (targetAverage / 120) * 15;

  const roll = Math.random() * 100;
  if (roll > hitChance)
    return { hit: false, multiplier: 1, missedValue: getMissedValue(target) };

  const subRoll = Math.random() * 100;
  if (subRoll < tripleChance) return { hit: true, multiplier: 3 };
  if (subRoll < tripleChance + doubleChance)
    return { hit: true, multiplier: 2 };

  return { hit: true, multiplier: 1 };
};

export const calculateX01BotTurnDetails = (
  botAvg: number,
  currentScore: number,
  hasOpened: boolean,
  inRule: "straight" | "double" | "master",
  outRule: "straight" | "double" | "master",
  throwsThisTurn: number = 0,
) => {
  const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];
  const botScore = simulateBotTurn(
    botAvg,
    currentScore,
    hasOpened,
    inRule,
    outRule,
  );
  let dartsAtDouble = 0;
  const newLeft = currentScore - botScore;
  const isCheckoutSetup =
    outRule === "straight"
      ? currentScore <= 180
      : currentScore <= 170 && !BOGEY_NUMBERS.includes(currentScore);
  let isBust = false;
  if (botScore === 0 && isCheckoutSetup && hasOpened) isBust = true;
  let minDarts = 1;
  if (outRule !== "straight") {
    const checkoutStr = getCheckoutInfo(currentScore);
    minDarts = checkoutStr ? checkoutStr.split(" ").length : 1;
  } else {
    if (currentScore > 120) minDarts = 3;
    else if (currentScore > 60) minDarts = 2;
  }
  if (botScore === currentScore)
    dartsAtDouble =
      outRule === "straight"
        ? 0
        : Math.floor(Math.random() * (4 - minDarts)) + minDarts;
  else if (isCheckoutSetup && (newLeft <= 50 || isBust))
    dartsAtDouble = outRule === "straight" ? 0 : 3;
  let dartsToLog = 3 - throwsThisTurn;
  if (botScore === currentScore && dartsAtDouble > 0)
    dartsToLog = dartsAtDouble;
  else if (botScore === currentScore && outRule === "straight")
    dartsToLog = minDarts;
  else if (isBust && isCheckoutSetup) dartsToLog = 3;
  const individualDarts = breakdownScoreToDarts(
    botScore,
    dartsToLog,
    botScore === currentScore,
    hasOpened,
    inRule,
    outRule,
    currentScore,
  );
  return { botScore, dartsAtDouble, isBust, individualDarts, newLeft };
};
