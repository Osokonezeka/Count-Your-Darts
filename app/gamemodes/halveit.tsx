import React, { useCallback } from "react";

import {
  RoundTarget,
  SequencePlayerState,
  SequenceTargetGame,
} from "../../components/gamemodes/SequenceTargetGame";
import { useLanguage } from "../../context/LanguageContext";
import { simulateBobsBotThrow, simulateCricketBotThrow } from "../../lib/bot";
import { t } from "../../lib/i18n";

const HALVEIT_ROUNDS: RoundTarget[] = [
  { name: "15", reqValue: 15 },
  { name: "16", reqValue: 16 },
  { name: "DOUBLE", reqMult: 2 },
  { name: "17", reqValue: 17 },
  { name: "18", reqValue: 18 },
  { name: "TREBLE", reqMult: 3 },
  { name: "19", reqValue: 19 },
  { name: "20", reqValue: 20 },
  { name: "BULL", reqValue: 25 },
];

type HalveItExtra = {
  sHits: number;
  dHits: number;
  tHits: number;
  hits: number;
};

export default function HalveIt() {
  const { language } = useLanguage();
  const createExtraState = useCallback(
    (): HalveItExtra => ({ sHits: 0, dHits: 0, tHits: 0, hits: 0 }),
    [],
  );

  const onHit = useCallback(
    (
      player: SequencePlayerState<HalveItExtra>,
      _value: number,
      multiplier: number,
    ) => {
      player.hits += 1;
      if (multiplier === 1) player.sHits += 1;
      else if (multiplier === 2) player.dHits += 1;
      else if (multiplier === 3) player.tHits += 1;
    },
    [],
  );

  const mapHistoryExtra = useCallback(
    (player: SequencePlayerState<HalveItExtra>) => ({
      sHits: player.sHits,
      dHits: player.dHits,
      tHits: player.tHits,
      hits: player.hits,
    }),
    [],
  );

  const calculateBotThrow = useCallback(
    (target: RoundTarget, botAvg: number) => {
      let val = 0;
      let mult = 1;

      if (target.reqValue === 25) {
        const hit = simulateBobsBotThrow(botAvg, false);
        if (hit) {
          val = 25;
          mult = Math.random() < 0.2 ? 2 : 1;
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
    <SequenceTargetGame<HalveItExtra>
      rounds={HALVEIT_ROUNDS}
      initialScore={40}
      headerTitle={t(language, "halveIt")?.toUpperCase()}
      headerSub={t(language, "startingScore")
        ?.replace("{{score}}", "40")
        ?.toUpperCase()}
      historyMode="Halve-It"
      createExtraState={createExtraState}
      onHit={onHit}
      mapHistoryExtra={mapHistoryExtra}
      calculateBotThrow={calculateBotThrow}
    />
  );
}
