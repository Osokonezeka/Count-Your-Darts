import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useReducer, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomAlert, { AlertButton } from "../components/CustomAlert";
import { useGame } from "../context/GameContext";
import { useHaptics } from "../context/HapticsContext";
import { useLanguage } from "../context/LanguageContext";
import { useSpeech } from "../context/SpeechContext";
import { useTerminology } from "../context/TerminologyContext";
import { useTheme } from "../context/ThemeContext";
import { t } from "../lib/i18n";

const MAX_DARTS = 100;

type Throw = { value: number; multiplier: number };

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

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

function scoringReducer(state: GameState, action: any): GameState {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier } = action.payload;
      const snapshot = JSON.parse(JSON.stringify({ ...state, history: [] }));

      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };

      const hitPoints = value * multiplier;
      player.score += hitPoints;
      player.dartsCount += 1;
      player.turnThrows = [...player.turnThrows, { value, multiplier }];

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

  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [matchTime, setMatchTime] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

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
      setAlertConfig({
        title: t(language, "leaveGame") || "Leave game?",
        message: t(language, "leaveGameNoHistory") || "Progress will be lost.",
        buttons: [
          { text: t(language, "cancel") || "Cancel", style: "cancel" },
          {
            text: t(language, "leave") || "Leave",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      });
      setAlertVisible(true);
    });
    return unsubscribe;
  }, [navigation, allDone]);

  const handleThrow = (value: number) => {
    if (allDone) return;
    if ((value === 25 && multiplier === 3) || (value === 0 && multiplier !== 1))
      return;

    triggerHaptic("tap");
    dispatch({ type: "ADD_THROW", payload: { value, multiplier } });
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.customHeader}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>100 DARTS</Text>
          <Text style={styles.headerSub}>HIGH SCORE</Text>
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
                      THROWN: {p.dartsCount} / {MAX_DARTS}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>AVG</Text>
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
          {[
            [1, 2, 3, 4, 5, 6, 7],
            [8, 9, 10, 11, 12, 13, 14],
            [15, 16, 17, 18, 19, 20, 25],
          ].map((row, i) => (
            <View key={i} style={styles.keyRow7}>
              {row.map((k) => {
                const isBullDisabled = k === 25 && multiplier === 3;
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      if (!isBullDisabled) handleThrow(k);
                    }}
                    style={[styles.key, isBullDisabled && styles.disabledKey]}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        isBullDisabled && styles.disabledKeyText,
                      ]}
                    >
                      {k === 25 ? bullTerm : k}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.keyRow4}>
            <Pressable
              onPress={handleMiss}
              style={[styles.keyAction, multiplier !== 1 && styles.disabledKey]}
            >
              <Text
                style={[
                  styles.keyTextAction,
                  multiplier !== 1 && styles.disabledKeyText,
                ]}
              >
                {missTerm}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleMultiplierToggle(2)}
              style={[
                styles.keyAction,
                multiplier === 2 && styles.activeModifier,
              ]}
            >
              <Text
                style={[
                  styles.keyTextAction,
                  multiplier === 2 && styles.activeModifierText,
                ]}
              >
                Double
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleMultiplierToggle(3)}
              style={[
                styles.keyAction,
                multiplier === 3 && styles.activeModifier,
              ]}
            >
              <Text
                style={[
                  styles.keyTextAction,
                  multiplier === 3 && styles.activeModifierText,
                ]}
              >
                {tripleTerm}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => dispatch({ type: "UNDO" })}
              style={[styles.keyAction, styles.undoKey]}
            >
              <Ionicons
                name="arrow-undo"
                size={28}
                color={theme.colors.danger}
              />
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={allDone} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.trophyWrapper}>
              <Text style={{ fontSize: 40 }}>🏆</Text>
            </View>
            <Text style={styles.modalTitle}>
              {t(language, "trainingFinished") || "Training Finished!"}
            </Text>
            <Text style={styles.modalSub}>
              {t(language, "trainingSaved") ||
                "Your results have been saved to history."}
            </Text>
            <View style={styles.modalActionsCol}>
              <Pressable
                style={styles.modalBtnCont}
                onPress={() => router.push("/play")}
              >
                <Text style={styles.modalBtnText}>
                  {t(language, "endMatch") || "End"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onRequestClose={() => setAlertVisible(false)}
      />
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

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      padding: 25,
      borderRadius: 24,
      width: "100%",
      alignItems: "center",
    },
    trophyWrapper: {
      width: 80,
      height: 80,
      backgroundColor: theme.colors.warning,
      opacity: 0.8,
      borderRadius: 40,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 15,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "900",
      textAlign: "center",
      color: theme.colors.textMain,
      marginBottom: 10,
    },
    modalSub: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 25,
    },
    modalActionsCol: { width: "100%", gap: 12 },
    modalBtnCont: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
    },
    modalBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  });
