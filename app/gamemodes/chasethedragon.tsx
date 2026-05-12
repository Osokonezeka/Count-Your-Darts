import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { produce, current } from "immer";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { BotAwareKeyboard } from "../../components/common/BotAwareKeyboard";
import { getSharedGameStyles } from "../../components/common/SharedGameStyles";
import { TimerBadge } from "../../components/common/TimerBadge";
import { TrainingKeyboard } from "../../components/keyboards/TrainingKeyboard";
import { FinishModal } from "../../components/modals/FinishModal";
import { useGame } from "../../context/GameContext";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { useBotDelay } from "../../hooks/useBotDelay";
import { useBotTurn } from "../../hooks/useBotTurn";
import { useGameModals } from "../../hooks/useGameModals";
import {
  resolveBotAverage,
  simulateClockBotThrow,
  simulateBobsBotThrow,
  simulateCricketBotThrow,
} from "../../lib/bot";
import { formatTime } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

const TARGETS = [
  ...Array.from({ length: 11 }, (_, i) => ({ value: 10 + i, multiplier: 1 })),
  ...Array.from({ length: 11 }, (_, i) => ({ value: 10 + i, multiplier: 3 })),
  ...Array.from({ length: 11 }, (_, i) => ({ value: 10 + i, multiplier: 2 })),
  { value: 25, multiplier: 1 },
  { value: 25, multiplier: 2 },
];

type PlayerState = {
  name: string;
  currentTargetIdx: number;
  darts: number;
  hits: number;
  turnThrows: { hit: boolean }[];
  isFinished: boolean;
  rank?: number;
};

type GameState = {
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: GameState[];
  finishedCount: number;
  isUndoing?: boolean;
};

type Action = { type: "THROW"; payload: { hit: boolean } } | { type: "UNDO" };

const dragonReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "THROW": {
      const { hit } = action.payload;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];

      player.darts += 1;
      if (hit) player.hits += 1;

      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ hit });

      if (hit) {
        if (player.currentTargetIdx === TARGETS.length - 1) {
          player.isFinished = true;
          player.rank = draft.finishedCount + 1;
        } else {
          player.currentTargetIdx += 1;
        }
      }

      const isTurnOver = draft.throwsThisTurn === 2 || player.isFinished;

      if (isTurnOver) {
        if (player.isFinished) draft.finishedCount += 1;

        const allFinished = draft.playerStates.every((p) => p.isFinished);
        if (allFinished) return;

        let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
        while (draft.playerStates[nextIdx].isFinished) {
          nextIdx = (nextIdx + 1) % draft.playerStates.length;
        }

        draft.playerStates[nextIdx].turnThrows = [];
        draft.currentIndex = nextIdx;
        draft.throwsThisTurn = 0;
        return;
      }

      draft.throwsThisTurn += 1;
      return;
    }

    case "UNDO": {
      if (draft.history.length === 0) return;
      const prevState = draft.history[draft.history.length - 1];
      return {
        ...prevState,
        history: draft.history.slice(0, -1),
        isUndoing: true,
      };
    }
  }
});

const getTargetLabel = (
  target: { value: number; multiplier: number },
  bullTerm: string,
  tripleTerm: string,
) => {
  let base = target.value === 25 ? bullTerm : target.value.toString();
  if (target.multiplier === 2) return `D${base}`;
  if (target.multiplier === 3) return `${tripleTerm.charAt(0)}${base}`;
  return base;
};

export default function ChaseTheDragon() {
  const { players } = useGame();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { bullTerm, missTerm, tripleTerm } = useTerminology();
  const router = useRouter();
  const navigation = useNavigation();

  const { resumeData } = useLocalSearchParams();
  const parsedResume = useMemo(
    () => (resumeData ? JSON.parse(resumeData as string) : null),
    [resumeData],
  );
  const [matchId] = useState(() =>
    parsedResume ? parsedResume.id : Date.now().toString(),
  );
  const isExiting = useRef(false);

  const styles = useMemo(
    () => ({
      ...getSharedGameStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );

  const [state, dispatch] = useReducer(
    dragonReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            currentTargetIdx: 0,
            darts: 0,
            hits: 0,
            turnThrows: [],
            isFinished: false,
          })),
          currentIndex: 0,
          throwsThisTurn: 0,
          history: [],
          finishedCount: 0,
        },
  );

  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const { GameAlerts, showExitConfirm } = useGameModals(language);

  const allFinished = state.playerStates.every((p) => p.isFinished);
  const { delay } = useBotDelay(state.isUndoing, 1200);
  const activePlayer = state.playerStates[state.currentIndex];

  const [historicalBaseline, setHistoricalBaseline] = useState<
    number | undefined
  >(undefined);
  const [isBaselineLoaded, setIsBaselineLoaded] = useState(false);

  useEffect(() => {
    const fetchBaseline = async () => {
      if (players) {
        const humanNames = players.filter((p: string) => !isBot(p));
        const baseline = await getPlayersHistoricalBaseline(
          humanNames,
          "Around the Clock",
        );
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [players]);

  const botAvg = resolveBotAverage(
    activePlayer?.name || "",
    state.playerStates,
    "Around the Clock",
    undefined,
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded && !allFinished && !state.isUndoing && !!activePlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      const targetReq = TARGETS[activePlayer.currentTargetIdx];
      let hit = false;

      if (targetReq.value === 25) {
        hit = simulateBobsBotThrow(botAvg!, targetReq.multiplier === 2);
      } else if (targetReq.multiplier === 2) {
        hit = simulateBobsBotThrow(botAvg!, false);
      } else if (targetReq.multiplier === 3) {
        const res = simulateCricketBotThrow(botAvg!, targetReq.value);
        hit = res.hit && res.multiplier === 3;
      } else {
        hit = simulateClockBotThrow(botAvg!, false);
      }
      return hit;
    },
    execute: (hit) => handleThrow(hit),
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (allFinished) {
      triggerHaptic("success");
      saveTrainingStats();
    }
  }, [allFinished]);

  const saveTrainingStats = async (navigateAway: boolean = true) => {
    try {
      if (navigateAway) isExiting.current = true;
      const formattedDate = dayjs().format("DD.MM.YYYY, HH:mm");

      const isUnfinished = !allFinished;
      const historyItem = {
        id: matchId,
        date: formattedDate,
        duration: formatTime(matchTimeRef.current),
        mode: "Chase the Dragon",
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTimeRef.current }
          : undefined,
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            darts: p.darts,
            rank: p.rank,
            accuracy:
              p.darts > 0 ? ((p.hits / p.darts) * 100).toFixed(1) + "%" : "0%",
          }))
          .sort((a, b) => (a.rank || 0) - (b.rank || 0)),
      };

      const existingHistoryStr = await AsyncStorage.getItem(
        "@dart_match_history",
      );
      const existingHistory = existingHistoryStr
        ? JSON.parse(existingHistoryStr)
        : [];

      const existingIndex = existingHistory.findIndex(
        (h: { id: string }) => h.id === matchId,
      );
      if (existingIndex > -1) existingHistory[existingIndex] = historyItem;
      else existingHistory.unshift(historyItem);

      await AsyncStorage.setItem(
        "@dart_match_history",
        JSON.stringify(existingHistory),
      );
      if (navigateAway) router.push("/play");
    } catch (e) {
      console.error("Save training error", e);
      if (navigateAway) router.push("/play");
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current || allFinished) return;
      e.preventDefault();
      const hasStarted = state.playerStates.some((p) => p.darts > 0);
      if (!hasStarted) {
        isExiting.current = true;
        navigation.dispatch(e.data.action);
        return;
      }
      showExitConfirm(() => {
        saveTrainingStats(false).then(() => {
          isExiting.current = true;
          navigation.dispatch(e.data.action);
        });
      });
    });
    return unsubscribe;
  }, [navigation, allFinished, state]);

  const handleThrow = (hit: boolean) => {
    if (allFinished) return;
    triggerHaptic(hit ? "tap" : "heavy");
    dispatch({ type: "THROW", payload: { hit } });
  };

  const currentPlayer = state.playerStates[state.currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.customHeader}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </AnimatedPressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {t(language, "chaseTheDragon")?.toUpperCase() || "CHASE THE DRAGON"}
          </Text>
          <Text style={styles.headerSub}>
            S ➔ {tripleTerm.charAt(0).toUpperCase()} ➔ D ➔{" "}
            {bullTerm.toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TimerBadge
            initialTime={matchTimeRef.current}
            isRunning={!allFinished}
            onTimeUpdate={handleTimeUpdate}
            theme={theme}
            styles={styles}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scoreBoardScroll}
        contentContainerStyle={styles.scoreBoardContent}
      >
        {state.playerStates.map((p, i) => {
          const isActive = i === state.currentIndex && !p.isFinished;
          const target =
            TARGETS[Math.min(p.currentTargetIdx, TARGETS.length - 1)];

          return (
            <View
              key={i}
              style={[
                styles.playerRow,
                isActive && styles.activePlayerRow,
                p.isFinished && styles.finishedPlayerRow,
              ]}
            >
              <View style={styles.scoreCol}>
                {p.isFinished ? (
                  <Text style={styles.rankText}>{p.rank}</Text>
                ) : (
                  <Text
                    style={[styles.targetValue, isActive && styles.activeText]}
                  >
                    {getTargetLabel(target, bullTerm, tripleTerm)}
                  </Text>
                )}
                <Text style={styles.playerName}>{p.name}</Text>
              </View>

              {!p.isFinished && (
                <>
                  <View style={styles.throwsCol}>
                    <View style={styles.throwsRow}>
                      {[0, 1, 2].map((idx) => {
                        const isHit = p.turnThrows?.[idx]?.hit === true;
                        const isMiss = p.turnThrows?.[idx]?.hit === false;

                        return (
                          <View
                            key={idx}
                            style={[
                              styles.throwBox,
                              isActive &&
                                state.throwsThisTurn === idx &&
                                styles.throwBoxActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.throwBoxText,
                                isHit && { color: theme.colors.success },
                                isMiss && { color: theme.colors.danger },
                              ]}
                            >
                              {p.turnThrows?.[idx] ? (isHit ? "✔" : "✘") : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.targetLabel}>
                      {t(language, "target")?.toUpperCase() || "TARGET"}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Ionicons
                        name="locate-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>{p.darts}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>
                        {t(language, "accuracyShort") || "ACC"}:
                      </Text>
                      <Text style={styles.statBold}>
                        {p.darts > 0
                          ? ((p.hits / p.darts) * 100).toFixed(0)
                          : 0}
                        %
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {!allFinished && (
        <BotAwareKeyboard
          playerName={currentPlayer?.name || ""}
          onUndo={() => dispatch({ type: "UNDO" })}
          theme={theme}
          language={language}
          botStyle={[styles.keyboard, { padding: 16 }]}
        >
          <TrainingKeyboard
            playerName={currentPlayer.name}
            instructionText={(t(language, "hitLower") || "hit") + ":"}
            targetValue={getTargetLabel(
              TARGETS[currentPlayer.currentTargetIdx],
              bullTerm,
              tripleTerm,
            )}
            hitLabel={t(language, "hit")?.toUpperCase() || "HIT"}
            missLabel={missTerm}
            onHit={() => handleThrow(true)}
            onMiss={() => handleThrow(false)}
            onUndo={() => dispatch({ type: "UNDO" })}
            theme={theme}
          />
        </BotAwareKeyboard>
      )}

      <FinishModal
        visible={allFinished}
        title={t(language, "trainingFinished") || "Training Finished!"}
        subtitle={
          t(language, "trainingSaved") ||
          "Your results have been saved to history."
        }
        theme={theme}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch") || "End"}
            theme={theme}
            onPress={() => router.push("/play")}
          />
        </View>
      </FinishModal>

      {GameAlerts}
    </SafeAreaView>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    targetValue: {
      fontSize: 36,
      fontWeight: "900",
      color: theme.colors.textMain,
      lineHeight: 40,
    },
    targetLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    keyboard: {
      padding: 16,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 30,
    },
  });
