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

const SHANGHAI_ROUNDS: RoundTarget[] = Array.from({ length: 20 }, (_, i) => ({
  name: String(i + 1),
  reqValue: i + 1,
}));

type ShanghaiExtra = {
  sHits: number;
  dHits: number;
  tHits: number;
  hits: number;
  shanghais: number;
};

export default function Shanghai() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const sharedStyles = useMemo(() => getSharedGameStyles(theme), [theme]);

  const createExtraState = useCallback(
    (): ShanghaiExtra => ({
      sHits: 0,
      dHits: 0,
      tHits: 0,
      hits: 0,
      shanghais: 0,
    }),
    [],
  );

  const onHit = useCallback(
    (
      player: SequencePlayerState<ShanghaiExtra>,
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

  const onRoundEnd = useCallback(
    (
      player: SequencePlayerState<ShanghaiExtra>,
      turnThrows: { multiplier: number; isHit: boolean }[],
    ) => {
      const hasS = turnThrows.some((tr) => tr.isHit && tr.multiplier === 1);
      const hasD = turnThrows.some((tr) => tr.isHit && tr.multiplier === 2);
      const hasT = turnThrows.some((tr) => tr.isHit && tr.multiplier === 3);
      if (hasS && hasD && hasT) {
        player.shanghais += 1;
        return { overrideSpeech: "speechShanghai", finishAll: true };
      }
    },
    [],
  );

  const rankComparator = useCallback(
    (
      a: SequencePlayerState<ShanghaiExtra>,
      b: SequencePlayerState<ShanghaiExtra>,
    ) => {
      if (a.shanghais !== b.shanghais) return b.shanghais - a.shanghais;
      return b.score - a.score;
    },
    [],
  );

  const mapHistoryExtra = useCallback(
    (player: SequencePlayerState<ShanghaiExtra>) => ({
      shanghais: player.shanghais,
      sHits: player.sHits,
      dHits: player.dHits,
      tHits: player.tHits,
      hits: player.hits,
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

  const renderStatsCol = useCallback(
    (
      player: SequencePlayerState<ShanghaiExtra>,
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

  const getRowExtraStyle = useCallback(
    (player: SequencePlayerState<ShanghaiExtra>) =>
      player.shanghais > 0
        ? { borderColor: theme.colors.warning, borderWidth: 2 }
        : undefined,
    [theme],
  );

  const renderRank = useCallback(
    (player: SequencePlayerState<ShanghaiExtra>) => (
      <Text
        style={[
          sharedStyles.rankText,
          player.shanghais > 0 && { color: theme.colors.warning },
        ]}
      >
        {player.shanghais > 0 ? "🏆" : player.rank}
      </Text>
    ),
    [sharedStyles, theme],
  );

  const renderRowExtra = useCallback(
    (player: SequencePlayerState<ShanghaiExtra>) =>
      player.isFinished && player.shanghais === 0 ? (
        <View
          style={[
            sharedStyles.statsCol,
            { justifyContent: "center", alignItems: "flex-end", flex: 1 },
          ]}
        >
          <Text style={[sharedStyles.playerScore, { fontSize: 24 }]}>
            {player.score}
          </Text>
        </View>
      ) : null,
    [sharedStyles],
  );

  const getFinishTitle = useCallback(
    (playerStates: SequencePlayerState<ShanghaiExtra>[], defaultTitle: string) =>
      playerStates.some((p) => p.shanghais > 0)
        ? `${t(language, "shanghai").toUpperCase()}! 🏆`
        : defaultTitle,
    [language],
  );

  const getFinishIconBgColor = useCallback(
    (playerStates: SequencePlayerState<ShanghaiExtra>[]) =>
      playerStates.some((p) => p.shanghais > 0) ? theme.colors.warning : undefined,
    [theme],
  );

  return (
    <SequenceTargetGame<ShanghaiExtra>
      rounds={SHANGHAI_ROUNDS}
      initialScore={0}
      headerTitle={t(language, "shanghai")?.toUpperCase()}
      headerSub="1 ➔ 20"
      historyMode="Shanghai"
      disableHalving
      createExtraState={createExtraState}
      onHit={onHit}
      onRoundEnd={onRoundEnd}
      rankComparator={rankComparator}
      mapHistoryExtra={mapHistoryExtra}
      calculateBotThrow={calculateBotThrow}
      renderStatsCol={renderStatsCol}
      getRowExtraStyle={getRowExtraStyle}
      renderRank={renderRank}
      renderRowExtra={renderRowExtra}
      getFinishTitle={getFinishTitle}
      getFinishIconBgColor={getFinishIconBgColor}
    />
  );
}
