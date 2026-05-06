import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import cloneDeep from "lodash/cloneDeep";
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
import { useSpeech } from "../../context/SpeechContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { useBotDelay } from "../../hooks/useBotDelay";
import { useBotTurn } from "../../hooks/useBotTurn";
import { useGameModals } from "../../hooks/useGameModals";
import { resolveBotAverage, simulateBobsBotThrow } from "../../lib/bot";
import { formatTime } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

const TARGETS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

type PlayerState = {
  name: string;
  score: number;
  highScore: number;
  currentTargetIdx: number;
  darts: number;
  turnThrows: boolean[];
  isFinished: boolean;
  isBust: boolean;
  rank?: number;
};

type GameState = {
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: GameState[];
  finishedCount: number;
  speechEvent?: { text: string; id: number } | null;
  isUndoing?: boolean;
};

type Action = { type: "THROW"; payload: { hit: boolean } } | { type: "UNDO" };

const handleTurnOver = (
  state: GameState,
  updatedPlayers: PlayerState[],
  snapshot: GameState,
  speechEvent: any = null,
): GameState => {
  const allDone = updatedPlayers.every((p) => p.isBust || p.isFinished);
  if (allDone) {
    const finishers = updatedPlayers
      .map((p, idx) => ({ ...p, originalIdx: idx }))
      .sort((a, b) => b.score - a.score || a.darts - b.darts);

    finishers.forEach((f, rankIdx) => {
      updatedPlayers[f.originalIdx].rank = rankIdx + 1;
    });
    return {
      ...state,
      playerStates: updatedPlayers,
      history: [...state.history, snapshot],
      speechEvent,
      isUndoing: false,
    };
  }

  let nextIdx = (state.currentIndex + 1) % state.playerStates.length;
  while (updatedPlayers[nextIdx].isBust || updatedPlayers[nextIdx].isFinished) {
    nextIdx = (nextIdx + 1) % state.playerStates.length;
  }

  updatedPlayers[nextIdx].turnThrows = [];

  return {
    ...state,
    playerStates: updatedPlayers,
    currentIndex: nextIdx,
    throwsThisTurn: 0,
    history: [...state.history, snapshot],
    speechEvent,
    isUndoing: false,
  };
};

function bobsReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "THROW": {
      const { hit } = action.payload;
      const snapshot = cloneDeep({ ...state, history: [] });
      snapshot.isUndoing = false;

      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };
      const currentTargetValue = TARGETS[player.currentTargetIdx];

      player.darts += 1;
      player.turnThrows = [...player.turnThrows, hit];

      const isTurnOver = state.throwsThisTurn === 2;

      if (isTurnOver) {
        const hitsCount = player.turnThrows.filter((h) => h).length;
        let turnPoints = 0;

        if (hitsCount > 0) {
          turnPoints = currentTargetValue * 2 * hitsCount;
          player.score += turnPoints;
        } else {
          player.score -= currentTargetValue * 2;
        }

        if (player.score > player.highScore) {
          player.highScore = player.score;
        }

        let newSpeechText: string | null = null;

        if (player.score <= 0) {
          player.isBust = true;
          player.score = 0;
          newSpeechText = "0";
        } else if (hitsCount === 0) {
          newSpeechText = "-" + (currentTargetValue * 2).toString();
        } else {
          newSpeechText = turnPoints.toString();
        }

        const newSpeechEvent = newSpeechText
          ? { text: newSpeechText, id: Date.now() }
          : null;

        if (!player.isBust && player.currentTargetIdx === TARGETS.length - 1) {
          player.isFinished = true;
        } else if (!player.isBust) {
          player.currentTargetIdx += 1;
        }

        updatedPlayers[state.currentIndex] = player;
        return handleTurnOver(state, updatedPlayers, snapshot, newSpeechEvent);
      }

      updatedPlayers[state.currentIndex] = player;
      return {
        ...state,
        playerStates: updatedPlayers,
        throwsThisTurn: state.throwsThisTurn + 1,
        history: [...state.history, snapshot],
        speechEvent: null,
        isUndoing: false,
      };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      return {
        ...state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
        speechEvent: null,
        isUndoing: true,
      };
    }

    default:
      return state;
  }
}

export default function BobsTwentySeven() {
  const { players } = useGame();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { speak } = useSpeech();
  const { bullTerm, missTerm } = useTerminology();
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
    bobsReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            score: 27,
            highScore: 27,
            currentTargetIdx: 0,
            darts: 0,
            turnThrows: [],
            isFinished: false,
            isBust: false,
          })),
          currentIndex: 0,
          throwsThisTurn: 0,
          history: [],
          finishedCount: 0,
          speechEvent: null,
        },
  );

  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const { GameAlerts, showExitConfirm } = useGameModals(language);

  const allDone = state.playerStates.every((p) => p.isBust || p.isFinished);
  const isGameOver = allDone && state.playerStates.every((p) => p.isBust);
  const { isFastBot, delay } = useBotDelay(state.isUndoing, 1200);
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
          "Bob's 27",
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
    "Bob's 27",
    undefined,
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded && !allDone && !state.isUndoing && !!activePlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      const isBull = TARGETS[activePlayer.currentTargetIdx] === 25;
      return simulateBobsBotThrow(botAvg!, isBull);
    },
    execute: (hit) => handleThrow(hit),
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (allDone) {
      triggerHaptic(isGameOver ? "heavy" : "success");
      saveBobsStats();
    }
  }, [allDone, isGameOver]);

  useEffect(() => {
    if (state.speechEvent) {
      speak(state.speechEvent.text);
    }
  }, [state.speechEvent]);

  const saveBobsStats = async (navigateAway: boolean = true) => {
    try {
      if (navigateAway) isExiting.current = true;
      const formattedDate = dayjs().format("DD.MM.YYYY, HH:mm");

      const isUnfinished = !allDone;
      const historyItem = {
        id: matchId,
        date: formattedDate,
        duration: formatTime(matchTimeRef.current),
        mode: "Bob's 27",
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTimeRef.current }
          : undefined,
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            score: p.score,
            highScore: p.highScore,
            darts: p.darts,
            rank: p.rank,
            status: p.isBust ? "BUST" : "CLEARED",
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
      console.error("Save Bob's 27 error", e);
      if (navigateAway) router.push("/play");
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current || allDone) return;
      e.preventDefault();
      const hasStarted = state.playerStates.some((p) => p.darts > 0);
      if (!hasStarted) {
        isExiting.current = true;
        navigation.dispatch(e.data.action);
        return;
      }
      showExitConfirm(() => {
        saveBobsStats(false).then(() => {
          isExiting.current = true;
          navigation.dispatch(e.data.action);
        });
      });
    });
    return unsubscribe;
  }, [navigation, allDone, state]);

  const handleThrow = (hit: boolean) => {
    if (allDone) return;
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
          <Text style={styles.headerTitle}>BOB'S 27</Text>
          <Text style={styles.headerSub}>D1 ➔ D20 ➔ D-BULL</Text>
        </View>
        <View style={styles.headerRight}>
          <TimerBadge
            initialTime={matchTimeRef.current}
            isRunning={!allDone}
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
          const isActive =
            i === state.currentIndex && !p.isBust && !p.isFinished;
          const target = TARGETS[p.currentTargetIdx];

          return (
            <View
              key={i}
              style={[
                styles.playerRow,
                isActive && styles.activePlayerRow,
                (p.isBust || p.isFinished) && styles.finishedPlayerRow,
              ]}
            >
              <View style={styles.scoreCol}>
                {p.rank && !p.isBust ? (
                  <Text style={styles.rankText}>{p.rank}</Text>
                ) : (
                  <Text
                    style={[
                      styles.playerScore,
                      isActive && styles.activeText,
                      p.isBust && { color: theme.colors.danger },
                    ]}
                  >
                    {p.score}
                  </Text>
                )}
                <Text style={styles.playerName}>{p.name}</Text>
              </View>

              {!p.isBust && !p.isFinished && (
                <>
                  <View style={styles.throwsCol}>
                    <View style={styles.throwsRow}>
                      {[0, 1, 2].map((idx) => (
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
                              p.turnThrows[idx] === true && {
                                color: theme.colors.success,
                              },
                              p.turnThrows[idx] === false && {
                                color: theme.colors.danger,
                              },
                            ]}
                          >
                            {p.turnThrows[idx] === true
                              ? "✔"
                              : p.turnThrows[idx] === false
                                ? "✘"
                                : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.targetLabel}>
                      TARGET: D{target === 25 ? bullTerm : target}
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
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>ACTIVE</Text>
                    </View>
                  </View>
                </>
              )}

              {(p.isBust || p.isFinished) && (
                <View style={styles.statusColEnd}>
                  <Ionicons
                    name={p.isBust ? "close-circle" : "checkmark-circle"}
                    size={24}
                    color={
                      p.isBust ? theme.colors.danger : theme.colors.success
                    }
                  />
                  <Text
                    style={[
                      styles.statusTextEnd,
                      {
                        color: p.isBust
                          ? theme.colors.danger
                          : theme.colors.success,
                      },
                    ]}
                  >
                    {p.isBust ? "BUST" : "CLEARED"}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {!allDone && (
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
            targetValue={
              "D" +
              (TARGETS[currentPlayer.currentTargetIdx] === 25
                ? bullTerm
                : TARGETS[currentPlayer.currentTargetIdx])
            }
            hitLabel="HIT DOUBLE"
            missLabel={missTerm}
            onHit={() => handleThrow(true)}
            onMiss={() => handleThrow(false)}
            onUndo={() => dispatch({ type: "UNDO" })}
            theme={theme}
          />
        </BotAwareKeyboard>
      )}

      <FinishModal
        visible={allDone}
        title={
          isGameOver
            ? t(language, "gameOver") || "Game Over!"
            : t(language, "trainingFinished") || "Training Finished!"
        }
        subtitle={
          isGameOver
            ? t(language, "allBust") || "All players are bust. Try again!"
            : t(language, "trainingSaved") ||
              "Your results have been saved to history."
        }
        icon={isGameOver ? "💀" : "🏆"}
        iconBgColor={isGameOver ? theme.colors.danger : theme.colors.warning}
        theme={theme}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch") || "End"}
            theme={theme}
            color={isGameOver ? theme.colors.danger : undefined}
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
    targetLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.textMuted,
    },
    statusBadge: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 9,
      fontWeight: "800",
      color: theme.colors.textLight,
    },

    statusColEnd: {
      flex: 2.8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },
    statusTextEnd: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    keyboard: {
      padding: 16,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 30,
    },
  });
