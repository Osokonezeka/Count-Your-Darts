import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useReducer, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGame } from "../../context/GameContext";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSpeech } from "../../context/SpeechContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { IMPOSSIBLE_SCORES, formatTime } from "../../lib/gameUtils";
import { ScoreKeyboard } from "../../components/keyboards/ScoreKeyboard";
import { InputModeSelector } from "../../components/keyboards/InputModeSelector";
import { DartKeyboard } from "../../components/keyboards/DartKeyboard";
import { InteractiveDartboard } from "../../components/keyboards/InteractiveDartboard";
import { FinishModal } from "../../components/modals/FinishModal";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { useGameModals } from "../../hooks/useGameModals";

const MAX_DARTS = 100;

type Throw = {
  value: number;
  multiplier: number;
  darts?: number;
  isScoreInput?: boolean;
  coords?: { x: number; y: number };
};

type PlayerState = {
  name: string;
  score: number;
  dartsCount: number;
  turnThrows: Throw[];
  isFinished: boolean;
  rank?: number;
  s60: number;
  s100: number;
  s140: number;
  s180: number;
};

type GameState = {
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: any[];
  speechEvent?: { text: string; id: number } | null;
};

const formatThrow = (t: Throw) => {
  if (t.value === 0) return "0";
  if (t.value === 25) return t.multiplier === 2 ? "D25" : "25";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};

function scoringReducer(state: GameState, action: any): GameState {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;
      const snapshot = JSON.parse(JSON.stringify({ ...state, history: [] }));

      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };

      const hitPoints = value * multiplier;
      player.score += hitPoints;
      player.dartsCount += 1;
      player.turnThrows = [...player.turnThrows, { value, multiplier, coords }];

      const isTurnOver =
        state.throwsThisTurn === 2 || player.dartsCount === MAX_DARTS;

      let newSpeechEvent = null;

      if (isTurnOver) {
        const turnSum = player.turnThrows.reduce(
          (sum, tr) => sum + tr.value * tr.multiplier,
          0,
        );
        if (turnSum >= 180) player.s180++;
        else if (turnSum >= 140) player.s140++;
        else if (turnSum >= 100) player.s100++;
        else if (turnSum >= 60) player.s60++;

        if (player.dartsCount === MAX_DARTS) {
          player.isFinished = true;
        }

        const newSpeechText = turnSum === 0 ? "noScore" : turnSum.toString();
        newSpeechEvent = { text: newSpeechText, id: Date.now() };
      }

      updatedPlayers[state.currentIndex] = player;

      if (isTurnOver) {
        const allDone = updatedPlayers.every((p) => p.isFinished);
        if (allDone) {
          const finishers = [...updatedPlayers].sort(
            (a, b) => b.score - a.score,
          );
          updatedPlayers.forEach((p) => {
            p.rank = finishers.findIndex((f) => f.name === p.name) + 1;
          });
          return {
            ...state,
            playerStates: updatedPlayers,
            history: [...state.history, snapshot],
            speechEvent: newSpeechEvent,
          };
        }

        let nextIdx = (state.currentIndex + 1) % state.playerStates.length;
        while (updatedPlayers[nextIdx].isFinished) {
          nextIdx = (nextIdx + 1) % state.playerStates.length;
        }
        updatedPlayers[nextIdx].turnThrows = [];

        return {
          ...state,
          playerStates: updatedPlayers,
          currentIndex: nextIdx,
          throwsThisTurn: 0,
          history: [...state.history, snapshot],
          speechEvent: newSpeechEvent,
        };
      }

      return {
        ...state,
        playerStates: updatedPlayers,
        throwsThisTurn: state.throwsThisTurn + 1,
        history: [...state.history, snapshot],
        speechEvent: null,
      };
    }

    case "ADD_TURN_SCORE": {
      const { score } = action.payload;
      const snapshot = JSON.parse(JSON.stringify({ ...state, history: [] }));

      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };

      player.score += score;
      const dartsRemainingInTurn = 3 - state.throwsThisTurn;
      const maxDartsLeft = MAX_DARTS - player.dartsCount;
      const dartsToLog = Math.min(dartsRemainingInTurn, maxDartsLeft);

      player.dartsCount += dartsToLog;
      player.turnThrows = [
        { value: score, multiplier: 1, darts: dartsToLog, isScoreInput: true },
      ];

      if (score >= 180) player.s180++;
      else if (score >= 140) player.s140++;
      else if (score >= 100) player.s100++;
      else if (score >= 60) player.s60++;

      if (player.dartsCount >= MAX_DARTS) {
        player.isFinished = true;
      }

      const newSpeechText = score === 0 ? "noScore" : score.toString();
      const newSpeechEvent = { text: newSpeechText, id: Date.now() };

      updatedPlayers[state.currentIndex] = player;

      const allDone = updatedPlayers.every((p) => p.isFinished);
      if (allDone) {
        const finishers = [...updatedPlayers].sort((a, b) => b.score - a.score);
        updatedPlayers.forEach((p) => {
          p.rank = finishers.findIndex((f) => f.name === p.name) + 1;
        });
        return {
          ...state,
          playerStates: updatedPlayers,
          history: [...state.history, snapshot],
          speechEvent: newSpeechEvent,
        };
      }

      let nextIdx = (state.currentIndex + 1) % state.playerStates.length;
      while (updatedPlayers[nextIdx].isFinished) {
        nextIdx = (nextIdx + 1) % state.playerStates.length;
      }
      updatedPlayers[nextIdx].turnThrows = [];

      return {
        ...state,
        playerStates: updatedPlayers,
        currentIndex: nextIdx,
        throwsThisTurn: 0,
        history: [...state.history, snapshot],
        speechEvent: newSpeechEvent,
      };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      return {
        ...state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
        speechEvent: null,
      };
    }

    default:
      return state;
  }
}

export default function OneHundredDarts() {
  const { players } = useGame();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { speak } = useSpeech();
  const { bullTerm, missTerm, tripleTerm } = useTerminology();
  const router = useRouter();
  const navigation = useNavigation();
  const styles = getStyles(theme);

  const [state, dispatch] = useReducer(scoringReducer, {
    playerStates: players.map((name) => ({
      name,
      score: 0,
      dartsCount: 0,
      turnThrows: [],
      isFinished: false,
      s180: 0,
      s140: 0,
      s100: 0,
      s60: 0,
    })),
    currentIndex: 0,
    throwsThisTurn: 0,
    history: [],
    speechEvent: null,
  });

  const [inputMode, setInputMode] = useState<"dart" | "score" | "board">(
    "dart",
  );
  const [typedScore, setTypedScore] = useState("");
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [matchTime, setMatchTime] = useState(0);
  const {
    GameAlerts,
    showLeaveNoHistoryConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  useEffect(() => {
    if (state.speechEvent) {
      if (state.speechEvent.text === "noScore") {
        speak(t(language, "noScore") || "No score");
      } else {
        speak(state.speechEvent.text);
      }
    }
  }, [state.speechEvent, language]);

  const allDone = state.playerStates.every((p) => p.isFinished);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let interval: any;
    if (!allDone) {
      interval = setInterval(() => setMatchTime((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [allDone]);

  useEffect(() => {
    if (allDone) {
      triggerHaptic("success");
      saveScoringStats();
    }
  }, [allDone]);

  const saveScoringStats = async () => {
    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const historyItem = {
        id: Date.now().toString(),
        date: formattedDate,
        duration: formatTime(matchTime),
        mode: "100 Darts",
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            score: p.score,
            darts: p.dartsCount,
            rank: p.rank,
            avg: ((p.score / p.dartsCount) * 3).toFixed(1),
            allTurns: [
              p.turnThrows.map((t: any) => ({
                v: t.value,
                m: t.multiplier,
                c: t.coords,
              })),
            ],
          }))
          .sort((a, b) => (a.rank || 0) - (b.rank || 0)),
      };

      const existingHistoryStr = await AsyncStorage.getItem(
        "@dart_match_history",
      );
      const existingHistory = existingHistoryStr
        ? JSON.parse(existingHistoryStr)
        : [];
      await AsyncStorage.setItem(
        "@dart_match_history",
        JSON.stringify([historyItem, ...existingHistory]),
      );
    } catch (e) {
      console.error("Save 100 Darts error", e);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (allDone) return;
      e.preventDefault();
      showLeaveNoHistoryConfirm(() => navigation.dispatch(e.data.action));
    });
    return unsubscribe;
  }, [navigation, allDone]);

  const handleThrow = (
    value: number,
    overrideMultiplier?: number,
    coords?: { x: number; y: number },
  ) => {
    if (allDone) return;

    const activeMult = overrideMultiplier || multiplier;
    if ((value === 25 && activeMult === 3) || (value === 0 && activeMult !== 1))
      return;

    triggerHaptic("tap");
    dispatch({
      type: "ADD_THROW",
      payload: { value, multiplier: activeMult, coords },
    });
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
    dispatch({ type: "UNDO" });
  };

  const handleTypeScore = (num: string) => {
    triggerHaptic("tap");
    setTypedScore((prev) => {
      const next = prev === "0" ? num : prev + num;
      if (next.length > 3) return prev;
      if (parseInt(next, 10) > 180) return prev;
      return next;
    });
  };

  const handleClearScore = () => {
    if (typedScore.length > 0) {
      triggerHaptic("heavy");
      setTypedScore((prev) => prev.slice(0, -1));
    } else {
      if (state.history.length === 0) return;
      const prevState = state.history[state.history.length - 1];
      const prevPlayer = prevState.playerStates[prevState.currentIndex];
      showUndoConfirm(prevPlayer.name, handleUndo);
    }
  };

  const handleSubmitScore = () => {
    if (typedScore === "") return;
    const score = parseInt(typedScore, 10);
    if (score > 180 || IMPOSSIBLE_SCORES.includes(score)) {
      triggerHaptic("heavy");
      showInvalidScoreAlert();
      return;
    }
    dispatch({ type: "ADD_TURN_SCORE", payload: { score } });
    setTypedScore("");
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
          <Text style={styles.headerTitle}>
            {t(language, "100Darts")?.toUpperCase() || "100 DARTS"}
          </Text>
          <Text style={styles.headerSub}>
            {t(language, "highScore")?.toUpperCase() || "HIGH SCORE"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.timerBadge}>
            <Ionicons
              name="time-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={styles.timerText}>{formatTime(matchTime)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scoreBoardScroll}
        contentContainerStyle={styles.scoreBoardContent}
      >
        {state.playerStates.map((p, i) => {
          const isActive = i === state.currentIndex && !p.isFinished;
          const turnSum =
            p.turnThrows?.reduce(
              (sum, tr) => sum + tr.value * tr.multiplier,
              0,
            ) || 0;

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
                  {inputMode === "score" ? (
                    <View style={styles.throwsCol}>
                      <View
                        style={[
                          styles.typedScoreDisplayBox,
                          isActive && styles.typedScoreDisplayBoxActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typedScoreDisplayBoxText,
                            isActive && styles.typedScoreDisplayBoxTextActive,
                          ]}
                        >
                          {isActive
                            ? typedScore || "0"
                            : p.turnThrows && p.turnThrows.length > 0
                              ? turnSum
                              : "-"}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.throwsCol}>
                      <View style={styles.throwsRow}>
                        {[0, 1, 2].map((idx) => {
                          const len = p.turnThrows.length;
                          const throwIdx = len - 1 - ((len - 1) % 3) + idx;
                          const t = p.turnThrows[throwIdx];

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
                                style={styles.throwBoxText}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                              >
                                {t ? formatThrow(t) : ""}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <Text style={styles.turnLabel}>
                        {t(language, "thrown")?.toUpperCase() || "THROWN"}:{" "}
                        {p.dartsCount} / {MAX_DARTS}
                      </Text>
                    </View>
                  )}

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>
                        {t(language, "avgShort") || "AVG"}
                      </Text>
                      <Text style={styles.statBold}>
                        {p.dartsCount > 0
                          ? ((p.score / p.dartsCount) * 3).toFixed(1)
                          : "0.0"}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {!allDone && (
        <View style={styles.keyboard}>
          <InputModeSelector
            inputMode={inputMode}
            setInputMode={setInputMode}
            theme={theme}
            language={language}
          />

          {inputMode === "dart" && (
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
          )}

          {inputMode === "score" && (
            <ScoreKeyboard
              onKeyPress={handleTypeScore}
              onDelete={handleClearScore}
              onSubmit={handleSubmitScore}
              theme={theme}
            />
          )}

          {inputMode === "board" && (
            <InteractiveDartboard
              onThrow={handleThrow}
              onUndo={handleUndo}
              theme={theme}
              language={language}
            />
          )}
        </View>
      )}

      <FinishModal
        visible={allDone}
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

      <GameAlerts />
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    customHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerBackBtn: { padding: 8, marginLeft: -8 },
    headerCenter: { alignItems: "center" },
    headerTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    headerSub: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    headerRight: { minWidth: 40, alignItems: "flex-end" },
    timerBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    timerText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.textMain,
      fontVariant: ["tabular-nums"],
    },

    scoreBoardScroll: { flex: 1 },
    scoreBoardContent: { padding: 10, gap: 8, paddingBottom: 20 },
    playerRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.card,
      elevation: 2,
    },
    activePlayerRow: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    finishedPlayerRow: {
      backgroundColor: theme.colors.background,
      opacity: 0.8,
    },

    scoreCol: { flex: 1.2, alignItems: "flex-start" },
    playerScore: {
      fontSize: 36,
      fontWeight: "900",
      color: theme.colors.textMain,
      lineHeight: 40,
    },
    rankText: {
      fontSize: 44,
      fontWeight: "900",
      color: theme.colors.success,
      lineHeight: 44,
    },
    activeText: { color: theme.colors.primary },
    playerName: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "700",
      textTransform: "uppercase",
    },

    throwsCol: { flex: 1.5, alignItems: "center", justifyContent: "center" },
    throwsRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
    throwBox: {
      width: 38,
      height: 38,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 6,
    },
    throwBoxActive: { borderColor: theme.colors.primary, borderWidth: 2 },
    throwBoxText: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.colors.textMain,
    },
    turnLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.primary,
    },

    typedScoreDisplayBox: {
      height: 44,
      minWidth: 100,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderWidth: 2,
      borderColor: theme.colors.cardBorder,
      borderRadius: 8,
      paddingHorizontal: 20,
    },
    typedScoreDisplayBoxActive: {
      borderColor: theme.colors.primary,
    },
    typedScoreDisplayBoxText: {
      fontSize: 26,
      fontWeight: "900",
      color: theme.colors.textMuted,
    },
    typedScoreDisplayBoxTextActive: {
      color: theme.colors.primary,
    },

    statsCol: { flex: 1.3, alignItems: "flex-end", justifyContent: "center" },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    statBold: { fontWeight: "700", color: theme.colors.textMain, fontSize: 13 },
    statLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: "700",
    },

    keyboard: {
      padding: 8,
      gap: 6,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 20,
    },
    segmentContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      marginBottom: 2,
      borderRadius: 10,
      padding: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 8,
    },
    segmentBtnActive: {
      backgroundColor: theme.colors.primaryDark,
      elevation: 2,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.textMuted,
    },
    segmentTextActive: { color: "#fff" },
    keyRow7: { flexDirection: "row", gap: 6 },
    keyRow4: { flexDirection: "row", gap: 6, marginTop: 4 },
    key: {
      flex: 1,
      height: 52,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyText: { fontSize: 18, fontWeight: "700", color: theme.colors.textMain },
    keyAction: {
      flex: 1,
      height: 58,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyTextAction: {
      fontSize: 15,

      fontWeight: "800",
      color: theme.colors.textMain,
    },
    activeModifier: { backgroundColor: theme.colors.primaryDark },
    activeModifierText: { color: "#fff" },
    disabledKey: {
      backgroundColor: theme.colors.cardBorder,
      opacity: 0.5,
      elevation: 0,
    },
    disabledKeyText: { color: theme.colors.textLight },
    undoKey: { backgroundColor: theme.colors.dangerLight },

    modalActionsCol: { width: "100%", gap: 12 },
  });
