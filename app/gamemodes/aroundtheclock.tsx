import React from "react";

import { HitMissTrainer } from "../../components/gamemodes/HitMissTrainer";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { simulateClockBotThrow } from "../../lib/bot";
import { t } from "../../lib/i18n";

const TARGETS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

export default function AroundTheClock() {
  const { language } = useLanguage();
  const { bullTerm } = useTerminology();

  return (
    <HitMissTrainer
      targets={TARGETS}
      getTargetLabel={(target) => (target === 25 ? bullTerm : target.toString())}
      headerTitle={
        t(language, "aroundTheClock")?.toUpperCase()
      }
      headerSub={`1 ➔ 20 ➔ ${bullTerm.toUpperCase()}`}
      historyMode="Around the Clock"
      botAverageMode="Around the Clock"
      calculateBotHit={(target, botAvg) =>
        simulateClockBotThrow(botAvg, target === 25)
      }
    />
  );
}
