import React, { useCallback } from "react";

import {
  RoundTarget,
  SequenceTargetGame,
} from "../../components/gamemodes/SequenceTargetGame";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { simulateBobsBotThrow, simulateCricketBotThrow } from "../../lib/bot";
import { t } from "../../lib/i18n";

const BERMUDA_ROUNDS: RoundTarget[] = [
  { name: "12", reqValue: 12 },
  { name: "13", reqValue: 13 },
  { name: "14", reqValue: 14 },
  { name: "DOUBLE", reqMult: 2 },
  { name: "15", reqValue: 15 },
  { name: "16", reqValue: 16 },
  { name: "17", reqValue: 17 },
  { name: "TREBLE", reqMult: 3 },
  { name: "18", reqValue: 18 },
  { name: "19", reqValue: 19 },
  { name: "20", reqValue: 20 },
  { name: "BULL", reqValue: 25 },
  { name: "D-BULL", reqValue: 25, reqMult: 2 },
];

export default function BermudaTriangle() {
  const { language } = useLanguage();
  const { bullTerm } = useTerminology();
  const calculateBotThrow = useCallback(
    (target: RoundTarget, botAvg: number) => {
      let val = 0;
      let mult = 1;

      if (target.reqValue === 25) {
        const hit = simulateBobsBotThrow(botAvg, target.reqMult === 2);
        if (hit) {
          val = 25;
          mult = target.reqMult || 1;
        }
      } else if (
        target.reqMult !== undefined &&
        target.reqValue === undefined
      ) {
        const aimValue = [20, 19, 18, 16][Math.floor(Math.random() * 4)];
        if (target.reqMult === 2) {
          const hit = simulateBobsBotThrow(botAvg, false);
          if (hit) {
            val = aimValue;
            mult = 2;
          }
        } else {
          const res = simulateCricketBotThrow(botAvg, aimValue);
          if (res.hit && res.multiplier === 3) {
            val = aimValue;
            mult = 3;
          } else {
            val = res.missedValue || 0;
            mult = 1;
          }
        }
      } else if (target.reqValue !== undefined) {
        const res = simulateCricketBotThrow(botAvg, target.reqValue);
        if (res.hit) {
          val = target.reqValue;
          mult = res.multiplier;
        } else {
          val = res.missedValue || 0;
        }
      }
      return { value: val, multiplier: mult };
    },
    [],
  );

  return (
    <SequenceTargetGame
      rounds={BERMUDA_ROUNDS}
      initialScore={0}
      headerTitle={t(language, "bermudaTriangle")?.toUpperCase()}
      headerSub={`12 ➔ D${bullTerm.toUpperCase()}`}
      historyMode="Bermuda Triangle"
      calculateBotThrow={calculateBotThrow}
    />
  );
}
