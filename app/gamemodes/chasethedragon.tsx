import React from "react";

import { HitMissTrainer } from "../../components/gamemodes/HitMissTrainer";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import {
  simulateBobsBotThrow,
  simulateClockBotThrow,
  simulateCricketBotThrow,
} from "../../lib/bot";
import { t } from "../../lib/i18n";

type DragonTarget = { value: number; multiplier: number };

const TARGETS: DragonTarget[] = [
  ...Array.from({ length: 11 }, (_, i) => ({ value: 10 + i, multiplier: 1 })),
  ...Array.from({ length: 11 }, (_, i) => ({ value: 10 + i, multiplier: 3 })),
  ...Array.from({ length: 11 }, (_, i) => ({ value: 10 + i, multiplier: 2 })),
  { value: 25, multiplier: 1 },
  { value: 25, multiplier: 2 },
];

export default function ChaseTheDragon() {
  const { language } = useLanguage();
  const { bullTerm, tripleTerm } = useTerminology();

  const getTargetLabel = (target: DragonTarget) => {
    const base = target.value === 25 ? bullTerm : target.value.toString();
    if (target.multiplier === 2) return `D${base}`;
    if (target.multiplier === 3) return `${tripleTerm.charAt(0)}${base}`;
    return base;
  };

  return (
    <HitMissTrainer
      targets={TARGETS}
      getTargetLabel={getTargetLabel}
      headerTitle={
        t(language, "chaseTheDragon")?.toUpperCase()
      }
      headerSub={`S ➔ ${tripleTerm.charAt(0).toUpperCase()} ➔ D ➔ ${bullTerm.toUpperCase()}`}
      historyMode="Chase the Dragon"
      botAverageMode="Around the Clock"
      historicalBaselineMode="Chase the Dragon"
      calculateBotHit={(target, botAvg) => {
        if (target.value === 25) {
          return simulateBobsBotThrow(botAvg, target.multiplier === 2);
        }
        if (target.multiplier === 2) {
          return simulateBobsBotThrow(botAvg, false);
        }
        if (target.multiplier === 3) {
          const res = simulateCricketBotThrow(botAvg, target.value);
          return res.hit && res.multiplier === 3;
        }
        return simulateClockBotThrow(botAvg, false);
      }}
    />
  );
}
