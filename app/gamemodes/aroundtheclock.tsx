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

import CustomAlert, { AlertButton } from "../../components/CustomAlert";
import { useGame } from "../../context/GameContext";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

const TARGETS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

type PlayerState = {
  name: string;
  currentTargetIdx: number;
  darts: number;
  hits: number;
  turnThrows: { target: number; hit: boolean }[];
  isFinished: boolean;
  rank?: number;
};

type GameState = {
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: any[];
  finishedCount: number;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

function clockReducer(state: GameState, action: any): GameState {
  switch (action.type) {
    case "THROW": {
      const { hit } = action.payload;
      const snapshot = JSON.parse(JSON.stringify({ ...state, history: [] }));

      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };
      const currentTarget = TARGETS[player.currentTargetIdx];

      player.darts += 1;
      if (hit) player.hits += 1;

      const newThrow = { target: currentTarget, hit };
      player.turnThrows = [...(player.turnThrows || []), newThrow];

      if (hit) {
        if (player.currentTargetIdx === TARGETS.length - 1) {
          player.isFinished = true;
          player.rank = state.finishedCount + 1;
        } else {
          player.currentTargetIdx += 1;
        }
      }

      updatedPlayers[state.currentIndex] = player;
      const isTurnOver = state.throwsThisTurn === 2 || player.isFinished;

      if (isTurnOver) {
        let nextIdx = (state.currentIndex + 1) % state.playerStates.length;
        const allFinished = updatedPlayers.every((p) => p.isFinished);

        if (allFinished) {
          return {
            ...state,
            playerStates: updatedPlayers,
            finishedCount: state.finishedCount + 1,
            history: [...state.history, snapshot],
          };
        }

        while (updatedPlayers[nextIdx].isFinished) {
          nextIdx = (nextIdx + 1) % state.playerStates.length;
        }
        updatedPlayers[nextIdx] = {
          ...updatedPlayers[nextIdx],
          turnThrows: [],
        };

        return {
          ...state,
          playerStates: updatedPlayers,
          currentIndex: nextIdx,
          throwsThisTurn: 0,
          finishedCount: player.isFinished
            ? state.finishedCount + 1
            : state.finishedCount,
          history: [...state.history, snapshot],
        };
      }

      return {
        ...state,
        playerStates: updatedPlayers,
        throwsThisTurn: state.throwsThisTurn + 1,
        history: [...state.history, snapshot],
      };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      return {
        ...state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
      };
    }

    default:
      return state;
  }
}

export default function AroundTheClock() {
  const { players } = useGame();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { bullTerm, missTerm } = useTerminology();
  const router = useRouter();
  const navigation = useNavigation();
  const styles = getStyles(theme);

  const [state, dispatch] = useReducer(clockReducer, {
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
  });

  const [matchTime, setMatchTime] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

  const allFinished = state.playerStates.every((p) => p.isFinished);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let interval: any;
    if (!allFinished) {
      interval = setInterval(() => setMatchTime((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [allFinished]);

  useEffect(() => {
    if (allFinished) {
      triggerHaptic("success");
      saveTrainingStats();
    }
  }, [allFinished]);

  const saveTrainingStats = async () => {
    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const historyItem = {
        id: Date.now().toString(),
        date: formattedDate,
        duration: formatTime(matchTime),
        mode: "Around the Clock",
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            darts: p.darts,
            rank: p.rank,
            accuracy: ((p.hits / p.darts) * 100).toFixed(1) + "%",
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
      console.error("Save training error", e);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (allFinished) return;
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
  }, [navigation, allFinished]);

  const handleThrow = (hit: boolean) => {
    if (allFinished) return;
    triggerHaptic(hit ? "tap" : "heavy");
    dispatch({ type: "THROW", payload: { hit } });
  };

  const currentPlayer = state.playerStates[state.currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.customHeader}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {t(language, "aroundTheClock")?.toUpperCase() || "AROUND THE CLOCK"}
          </Text>
          <Text style={styles.headerSub}>
            1 ➔ 20 ➔ {bullTerm.toUpperCase()}
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
                    style={[styles.targetValue, isActive && styles.activeText]}
                  >
                    {target === 25 ? bullTerm : target}
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
        <View style={styles.keyboard}>
          <View style={styles.keyboardHeader}>
            <Text style={styles.instructionText}>
              {currentPlayer.name}, {t(language, "hitLower") || "hit"}:{" "}
              <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>
                {TARGETS[currentPlayer.currentTargetIdx] === 25
                  ? bullTerm
                  : TARGETS[currentPlayer.currentTargetIdx]}
              </Text>
            </Text>
          </View>
          <View style={styles.keyRow}>
            <Pressable
              onPress={() => handleThrow(false)}
              style={styles.keyAction}
            >
              <Text style={styles.keyTextAction}>{missTerm}</Text>
            </Pressable>

            <Pressable
              onPress={() => handleThrow(true)}
              style={[styles.keyAction, styles.keyHit]}
            >
              <Text style={[styles.keyTextAction, { color: "#fff" }]}>
                {t(language, "hit")?.toUpperCase() || "HIT"}
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

      <Modal visible={allFinished} transparent animationType="fade">
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
    targetValue: {
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
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    targetLabel: {
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
      padding: 16,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 30,
    },
    keyboardHeader: { marginBottom: 12, alignItems: "center" },
    instructionText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textMain,
    },

    keyRow: { flexDirection: "row", gap: 6 },
    keyAction: {
      flex: 1,
      height: 58,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyHit: { backgroundColor: theme.colors.primary },
    undoKey: { backgroundColor: theme.colors.dangerLight },
    keyTextAction: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.textMain,
    },

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
