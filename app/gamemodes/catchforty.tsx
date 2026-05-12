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
import { DartKeyboard } from "../../components/keyboards/DartKeyboard";
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
  simulateBotTurn,
  breakdownScoreToDarts,
} from "../../lib/bot";
import { formatTime } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

const TARGETS = Array.from({ length: 40 }, (_, i) => 61 + i);

type PlayerState = {
  name: string;
  score: number;
  currentTargetIdx: number;
  currentLeft: number;
  dartsUsedOnTarget: number;
  dartsCount: number;
  isFinished: boolean;
  rank?: number;
  c2: number;
  c3: number;
  c4_6: number;
  fails: number;
};

type GameState = {
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: GameState[];
  isUndoing?: boolean;
};

type Action =
  | { type: "ADD_THROW"; payload: { value: number; multiplier: number } }
  | { type: "UNDO" };

const catchFortyReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier } = action.payload;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      const hitPoints = value * multiplier;

      let newLeft = player.currentLeft - hitPoints;

      let isBust =
        newLeft < 0 || newLeft === 1 || (newLeft === 0 && multiplier !== 2);
      let isWin = newLeft === 0 && multiplier === 2;

      player.dartsCount += 1;
      player.dartsUsedOnTarget += 1;
      draft.throwsThisTurn += 1;

      let targetCompleted = false;

      if (isWin) {
        if (player.dartsUsedOnTarget <= 2) {
          player.score += 3;
          player.c2 += 1;
        } else if (player.dartsUsedOnTarget === 3) {
          player.score += 2;
          player.c3 += 1;
        } else {
          player.score += 1;
          player.c4_6 += 1;
        }
        targetCompleted = true;
      } else if (isBust) {
        targetCompleted = true;
        player.fails += 1;
        player.dartsCount += 6 - player.dartsUsedOnTarget;
      } else if (player.dartsUsedOnTarget >= 6) {
        targetCompleted = true;
        player.fails += 1;
      } else {
        player.currentLeft = newLeft;
      }

      if (targetCompleted) {
        if (player.currentTargetIdx === TARGETS.length - 1) {
          player.isFinished = true;
          const finishersCount = draft.playerStates.filter(
            (p) => p.isFinished,
          ).length;
          player.rank = finishersCount;
        } else {
          player.currentTargetIdx += 1;
          player.currentLeft = TARGETS[player.currentTargetIdx];
          player.dartsUsedOnTarget = 0;
        }
      }

      const isTurnOver = draft.throwsThisTurn === 3 || targetCompleted;

      if (isTurnOver) {
        const allFinished = draft.playerStates.every((p) => p.isFinished);
        if (allFinished) return;

        let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
        while (draft.playerStates[nextIdx].isFinished) {
          nextIdx = (nextIdx + 1) % draft.playerStates.length;
        }

        draft.currentIndex = nextIdx;
        draft.throwsThisTurn = 0;
        return;
      }
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

export default function CatchForty() {
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
    catchFortyReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            score: 0,
            currentTargetIdx: 0,
            currentLeft: TARGETS[0],
            dartsUsedOnTarget: 0,
            dartsCount: 0,
            isFinished: false,
            c2: 0,
            c3: 0,
            c4_6: 0,
            fails: 0,
          })),
          currentIndex: 0,
          throwsThisTurn: 0,
          history: [],
        },
  );

  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const { GameAlerts, showExitConfirm } = useGameModals(language);

  const allFinished = state.playerStates.every((p) => p.isFinished);
  const { isFastBot, delay } = useBotDelay(state.isUndoing, 1000);
  const activePlayer = state.playerStates[state.currentIndex];

  const [historicalBaseline, setHistoricalBaseline] = useState<
    number | undefined
  >(undefined);
  const [isBaselineLoaded, setIsBaselineLoaded] = useState(false);

  useEffect(() => {
    const fetchBaseline = async () => {
      if (players) {
        const humanNames = players.filter((p: string) => !isBot(p));
        const baseline = await getPlayersHistoricalBaseline(humanNames, "X01");
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [players]);

  const botAvg = resolveBotAverage(
    activePlayer?.name || "",
    state.playerStates,
    "X01",
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
      const botScore = simulateBotTurn(
        botAvg!,
        activePlayer.currentLeft,
        true,
        "straight",
        "double",
      );
      const individualDarts = breakdownScoreToDarts(
        botScore,
        3 - state.throwsThisTurn,
        botScore === activePlayer.currentLeft,
        true,
        "straight",
        "double",
        activePlayer.currentLeft,
      );
      return individualDarts[0];
    },
    execute: (dart) => {
      handleThrow(dart.value, dart.multiplier);
    },
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
        mode: "Catch 40",
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTimeRef.current }
          : undefined,
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            score: p.score,
            darts: p.dartsCount,
            rank: p.rank,
            c2: p.c2,
            c3: p.c3,
            c4_6: p.c4_6,
            fails: p.fails,
          }))
          .sort((a, b) => (b.score || 0) - (a.score || 0)),
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
      if (existingIndex > -1) {
        existingHistory[existingIndex] = historyItem;
      } else {
        existingHistory.unshift(historyItem);
      }

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
      const hasStarted = state.playerStates.some((p) => p.dartsCount > 0);
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

  const handleThrow = (value: number, overrideMultiplier?: number) => {
    if (allFinished) return;
    const activeMult = overrideMultiplier || multiplier;
    if ((value === 25 && activeMult === 3) || (value === 0 && activeMult !== 1))
      return;

    triggerHaptic("tap");
    dispatch({ type: "ADD_THROW", payload: { value, multiplier: activeMult } });
    setMultiplier(1);
  };

  const handleMiss = () => {
    if (multiplier === 1) {
      triggerHaptic("heavy");
      handleThrow(0);
    }
  };

  const handleMultiplierToggle = (newMult: 2 | 3) => {
    triggerHaptic("heavy");
    setMultiplier((prev) => (prev === newMult ? 1 : newMult));
  };

  const handleUndo = () => {
    triggerHaptic("heavy");
    setMultiplier(1);
    dispatch({ type: "UNDO" });
  };

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
          <Text style={styles.headerTitle}>CATCH 40</Text>
          <Text style={styles.headerSub}>61 ➔ 100</Text>
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
          const target = TARGETS[p.currentTargetIdx];

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
                    style={[styles.playerScore, isActive && styles.activeText]}
                  >
                    {p.score}
                  </Text>
                )}
                <Text style={styles.playerName}>{p.name}</Text>
              </View>

              {!p.isFinished && (
                <>
                  <View style={specificStyles.statsFlex}>
                    <View style={specificStyles.statCell}>
                      <Text style={specificStyles.statLabel}>
                        {t(language, "target")?.toUpperCase() || "TARGET"}
                      </Text>
                      <Text style={specificStyles.statValueMain}>{target}</Text>
                    </View>
                    <View style={specificStyles.statCell}>
                      <Text style={specificStyles.statLabel}>
                        {t(language, "toGo")?.toUpperCase() || "LEFT"}
                      </Text>
                      <Text style={specificStyles.statValueMain}>
                        {p.currentLeft}
                      </Text>
                    </View>
                    <View style={specificStyles.statCell}>
                      <Text style={specificStyles.statLabel}>
                        {t(language, "darts")?.toUpperCase() || "DARTS"}
                      </Text>
                      <Text
                        style={[
                          specificStyles.statValueMain,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {p.dartsUsedOnTarget} / 6
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
          playerName={activePlayer?.name || ""}
          onUndo={handleUndo}
          theme={theme}
          language={language}
          style={styles.keyboard}
        >
          <DartKeyboard
            onThrow={handleThrow}
            onMiss={handleMiss}
            onMultiplierToggle={handleMultiplierToggle}
            onUndo={handleUndo}
            multiplier={multiplier}
            theme={theme}
            bullTerm={bullTerm}
            missTerm={missTerm}
            tripleTerm={tripleTerm}
            language={language}
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

const specificStyles = StyleSheet.create({
  statsFlex: {
    flex: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 12,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#888",
    marginBottom: 4,
  },
  statValueMain: {
    fontSize: 22,
    fontWeight: "900",
  },
});

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    keyboard: {
      padding: 16,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 30,
    },
  });
