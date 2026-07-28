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
import { simulateCricketBotThrow } from "../../lib/bot";
import { t } from "../../lib/i18n";

const BASEBALL_ROUNDS: RoundTarget[] = Array.from({ length: 9 }, (_, i) => ({
  name: String(i + 1),
  reqValue: i + 1,
}));

type BaseballExtra = {
  sHits: number;
  dHits: number;
  tHits: number;
  hits: number;
  scorelessInnings: number;
};

export default function Baseball() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const sharedStyles = useMemo(() => getSharedGameStyles(theme), [theme]);

  const createExtraState = useCallback(
    (): BaseballExtra => ({
      sHits: 0,
      dHits: 0,
      tHits: 0,
      hits: 0,
      scorelessInnings: 0,
    }),
    [],
  );

  const onHit = useCallback(
    (
      player: SequencePlayerState<BaseballExtra>,
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

  const calculatePoints = useCallback(
    (
      _value: number,
      multiplier: number,
      _target: RoundTarget,
      isHit: boolean,
    ) => (isHit ? multiplier : 0),
    [],
  );

  const onZeroScoreTurn = useCallback(
    (player: SequencePlayerState<BaseballExtra>) => {
      player.scorelessInnings += 1;
    },
    [],
  );

  const mapHistoryExtra = useCallback(
    (player: SequencePlayerState<BaseballExtra>) => ({
      sHits: player.sHits,
      dHits: player.dHits,
      tHits: player.tHits,
      hits: player.hits,
      scorelessInnings: player.scorelessInnings,
    }),
    [],
  );

  const calculateBotThrow = useCallback((target: RoundTarget, botAvg: number) => {
    const res = simulateCricketBotThrow(botAvg, target.reqValue!);
    return {
      value: res.hit ? target.reqValue! : res.missedValue || 0,
      multiplier: res.multiplier,
    };
  }, []);

  const getTargetPrefix = useCallback(
    (roundIndex: number, totalRounds: number) =>
      `${t(language, "inning").toUpperCase()} ${Math.min(roundIndex + 1, totalRounds)}`,
    [language],
  );

  const renderStatsCol = useCallback(
    (
      player: SequencePlayerState<BaseballExtra>,
      { targetReq }: { isActive: boolean; targetReq: RoundTarget },
    ) => {
      const hasS = player.turnThrows?.some(
        (tr) => tr.value === targetReq.reqValue && tr.multiplier === 1 && tr.isHit,
      );
      const hasD = player.turnThrows?.some(
        (tr) => tr.value === targetReq.reqValue && tr.multiplier === 2 && tr.isHit,
      );
      const hasT = player.turnThrows?.some(
        (tr) => tr.value === targetReq.reqValue && tr.multiplier === 3 && tr.isHit,
      );
      return (
        <View style={sharedStyles.statRow}>
          <Text
            style={[
              sharedStyles.statBold,
              {
                fontSize: 13,
                color: hasS ? theme.colors.success : theme.colors.textMuted,
              },
            ]}
          >
            S
          </Text>
          <Text
            style={[
              sharedStyles.statBold,
              {
                fontSize: 13,
                color: hasD ? theme.colors.success : theme.colors.textMuted,
              },
            ]}
          >
            D
          </Text>
          <Text
            style={[
              sharedStyles.statBold,
              {
                fontSize: 13,
                color: hasT ? theme.colors.success : theme.colors.textMuted,
              },
            ]}
          >
            T
          </Text>
        </View>
      );
    },
    [sharedStyles, theme],
  );

  return (
    <SequenceTargetGame<BaseballExtra>
      rounds={BASEBALL_ROUNDS}
      initialScore={0}
      headerTitle={t(language, "baseball")?.toUpperCase()}
      headerSub={`9 ${t(language, "innings")?.toUpperCase()}`}
      historyMode="Baseball"
      disableHalving
      createExtraState={createExtraState}
      onHit={onHit}
      calculatePoints={calculatePoints}
      onZeroScoreTurn={onZeroScoreTurn}
      mapHistoryExtra={mapHistoryExtra}
      calculateBotThrow={calculateBotThrow}
      getTargetPrefix={getTargetPrefix}
      renderStatsCol={renderStatsCol}
    />
  );
}
