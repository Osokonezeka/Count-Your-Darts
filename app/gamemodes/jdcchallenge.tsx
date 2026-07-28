import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo } from "react";
import { Text, View } from "react-native";

import {
  RoundTarget,
  SequencePlayerState,
  SequenceTargetGame,
} from "../../components/gamemodes/SequenceTargetGame";
import { getSharedGameStyles } from "../../components/common/SharedGameStyles";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { simulateBobsBotThrow, simulateCricketBotThrow } from "../../lib/bot";
import { t } from "../../lib/i18n";

const JDC_ROUNDS: RoundTarget[] = [
  ...[10, 11, 12, 13, 14, 15].flatMap((v) =>
    Array<RoundTarget>(3).fill({ name: String(v), reqValue: v }),
  ),
  ...Array.from({ length: 20 }, (_, i) => {
    const v = i + 1;
    return { name: `D${v}`, reqValue: v, reqMult: 2, points: 50 };
  }),
  { name: "D-BULL", reqValue: 25, reqMult: 2, points: 50 },
  ...[15, 16, 17, 18, 19, 20].flatMap((v) =>
    Array<RoundTarget>(3).fill({ name: String(v), reqValue: v }),
  ),
];

type JDCExtra = {
  phase1: number;
  phase2: number;
  phase3: number;
};

export default function JDCChallenge() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const sharedStyles = useMemo(() => getSharedGameStyles(theme), [theme]);

  const createExtraState = useCallback(
    (): JDCExtra => ({ phase1: 0, phase2: 0, phase3: 0 }),
    [],
  );

  const resolveTarget = useCallback(
    (dartsCount: number) =>
      JDC_ROUNDS[dartsCount] || JDC_ROUNDS[JDC_ROUNDS.length - 1],
    [],
  );

  const calculatePoints = useCallback(
    (value: number, multiplier: number, target: RoundTarget, isHit: boolean) => {
      if (!isHit) return 0;
      return target.reqMult !== undefined
        ? target.points || 0
        : value * multiplier;
    },
    [],
  );

  const onDart = useCallback(
    (
      player: SequencePlayerState<JDCExtra>,
      _value: number,
      _multiplier: number,
      pts: number,
    ) => {
      if (player.dartsCount < 18) player.phase1 += pts;
      else if (player.dartsCount < 39) player.phase2 += pts;
      else player.phase3 += pts;
    },
    [],
  );

  const mapHistoryExtra = useCallback(
    (player: SequencePlayerState<JDCExtra>) => ({
      phase1: player.phase1,
      phase2: player.phase2,
      phase3: player.phase3,
    }),
    [],
  );

  const calculateBotThrow = useCallback((target: RoundTarget, botAvg: number) => {
    const isDoubleReq = target.reqMult === 2;
    const isBull = target.reqValue === 25;

    let val = 0;
    let mult = 1;

    if (isDoubleReq) {
      const hit = simulateBobsBotThrow(botAvg, isBull);
      if (hit) {
        val = target.reqValue!;
        mult = 2;
      }
    } else {
      const res = simulateCricketBotThrow(botAvg, target.reqValue!);
      if (res.hit) {
        val = target.reqValue!;
        mult = res.multiplier;
      } else {
        val = res.missedValue || 0;
      }
    }
    return { value: val, multiplier: mult };
  }, []);

  const renderStatsCol = useCallback(
    (player: SequencePlayerState<JDCExtra>) => (
      <View style={sharedStyles.statRow}>
        <Ionicons
          name="locate-outline"
          size={14}
          color={theme.colors.textMuted}
        />
        <Text style={sharedStyles.statBold}>{player.dartsCount}</Text>
      </View>
    ),
    [sharedStyles, theme],
  );

  return (
    <SequenceTargetGame<JDCExtra>
      rounds={JDC_ROUNDS}
      totalDarts={JDC_ROUNDS.length}
      resolveTarget={resolveTarget}
      initialScore={0}
      headerTitle={t(language, "jdcChallenge")?.toUpperCase()}
      headerSub={`57 ${t(language, "dartsRoutine")?.toUpperCase()}`}
      historyMode="JDC Challenge"
      disableHalving
      createExtraState={createExtraState}
      calculatePoints={calculatePoints}
      onDart={onDart}
      mapHistoryExtra={mapHistoryExtra}
      calculateBotThrow={calculateBotThrow}
      renderStatsCol={renderStatsCol}
    />
  );
}
