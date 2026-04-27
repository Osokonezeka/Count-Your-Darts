import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRouter } from "expo-router";
import React, {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
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
import { useTerminology } from "../context/TerminologyContext";
import { useTheme } from "../context/ThemeContext";
import { t } from "../lib/i18n";

const TARGETS = [20, 19, 18, 17, 16, 15, 25];
const COLUMN_WIDTH = 100;

type PlayerCricketState = {
  name: string;
  marks: Record<number, number>;
  score: number;
  darts: number;
};

type CricketGameState = {
  playerStates: PlayerCricketState[];
  currentIndex: number;
  throwsThisTurn: number;
  currentTurnThrows: string[];
  history: any[];
  matchWinner: PlayerCricketState | null;
};

const getMarkSymbol = (count: number) => {
  if (count <= 0) return "";
  if (count === 1) return "/";
  if (count === 2) return "X";
  return "⦻";
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

function cricketReducer(
  state: CricketGameState,
  action: any,
): CricketGameState {
  switch (action.type) {
    case "ADD_MARK": {
      const { value, multiplier, cricketMode, throwLabel } = action.payload;

      const snapshot = {
        playerStates: state.playerStates.map((p) => ({
          ...p,
          marks: { ...p.marks },
        })),
        currentIndex: state.currentIndex,
        throwsThisTurn: state.throwsThisTurn,
        currentTurnThrows: [...(state.currentTurnThrows || [])],
        matchWinner: state.matchWinner,
      };

      const updatedPlayers = [...state.playerStates];
      const currentPlayerIdx = state.currentIndex;

      const player = {
        ...updatedPlayers[currentPlayerIdx],
        marks: { ...updatedPlayers[currentPlayerIdx].marks },
      };

      player.darts += 1;

      const currentThrows = state.currentTurnThrows || [];
      const newTurnThrows = [...currentThrows, throwLabel];

      if (TARGETS.includes(value)) {
        let hitsLeft = multiplier;
        const currentMarks = player.marks[value] || 0;

        if (currentMarks < 3) {
          const toAdd = Math.min(3 - currentMarks, hitsLeft);
          player.marks[value] = currentMarks + toAdd;
          hitsLeft -= toAdd;
        }

        if (hitsLeft > 0 && cricketMode === "standard") {
          const anyoneElseOpen = updatedPlayers.some(
            (p, idx) => idx !== currentPlayerIdx && (p.marks[value] || 0) < 3,
          );

          if (anyoneElseOpen) {
            player.score += value * hitsLeft;
          }
        }
      }

      updatedPlayers[currentPlayerIdx] = player;

      const hasClosedAll = TARGETS.every(
        (num) => (player.marks[num] || 0) >= 3,
      );
      const hasHighestScore = updatedPlayers.every(
        (p) => p.score <= player.score,
      );

      if (hasClosedAll && (cricketMode === "no-score" || hasHighestScore)) {
        return {
          ...state,
          playerStates: updatedPlayers,
          currentTurnThrows: newTurnThrows,
          matchWinner: player,
        };
      }

      if (state.throwsThisTurn === 2) {
        return {
          ...state,
          playerStates: updatedPlayers,
          currentIndex: (state.currentIndex + 1) % state.playerStates.length,
          throwsThisTurn: 0,
          currentTurnThrows: [],
          history: [...(state.history || []), snapshot],
        };
      }

      return {
        ...state,
        playerStates: updatedPlayers,
        throwsThisTurn: state.throwsThisTurn + 1,
        currentTurnThrows: newTurnThrows,
        history: [...(state.history || []), snapshot],
      };
    }

    case "UNDO": {
      if (!state.history || state.history.length === 0) return state;
      const lastState = state.history[state.history.length - 1];
      return {
        ...state,
        ...lastState,
        currentTurnThrows: lastState.currentTurnThrows || [],
        history: state.history.slice(0, -1),
      };
    }

    default:
      return state;
  }
}

export default function CricketScreen() {
  const { players, settings } = useGame();
  const { language } = useLanguage();
  const { bullTerm, missTerm, tripleTerm } = useTerminology();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  const isExiting = useRef(false);

  const styles = getStyles(theme);

  const [state, dispatch] = useReducer(cricketReducer, {
    playerStates: players.map((name) => ({
      name,
      marks: {},
      score: 0,
      darts: 0,
    })),
    currentIndex: 0,
    throwsThisTurn: 0,
    currentTurnThrows: [],
    history: [],
    matchWinner: null,
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
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: state.currentIndex * COLUMN_WIDTH,
        animated: true,
      });
    }
  }, [state.currentIndex]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let interval: any;
    if (!state.matchWinner) {
      interval = setInterval(() => setMatchTime((p) => p + 1), 1000);
    } else {
      triggerHaptic("success");
      const saveMatchHistory = async () => {
        try {
          const newMatch = {
            id: Date.now().toString(),
            date:
              new Date().toLocaleDateString() +
              " " +
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            duration: formatTime(matchTime),
            mode: "Cricket",
            settings: {
              cricketMode: settings.cricketMode,
              legs: settings.legs,
              sets: settings.sets,
            },
            players: state.playerStates.map((p) => ({
              name: p.name,
              score: p.score,
              marks: p.marks,
              darts: p.darts,
              legs: p.name === state.matchWinner?.name ? 1 : 0,
              sets: 0,
            })),
          };

          const existing = await AsyncStorage.getItem("@dart_match_history");
          const parsed = existing ? JSON.parse(existing) : [];
          await AsyncStorage.setItem(
            "@dart_match_history",
            JSON.stringify([newMatch, ...parsed]),
          );
        } catch (e) {
          console.error("Błąd zapisu historii Cricketa", e);
        }
      };

      saveMatchHistory();
    }
    return () => clearInterval(interval);
  }, [state.matchWinner]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current || state.matchWinner) return;
      e.preventDefault();

      setAlertConfig({
        title:
          t(language, "leaveGame") ||
          "Are you sure you want to leave the game?",
        message:
          t(language, "leaveGameNoHistory") ||
          "Match wouldn't be saved in history",
        buttons: [
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: t(language, "leave") || "Leave",
            style: "destructive",
            onPress: () => {
              isExiting.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ],
      });
      setAlertVisible(true);
    });

    return unsubscribe;
  }, [navigation, state.matchWinner, language]);

  const handleThrow = (val: number) => {
    if (state.matchWinner) return;
    if (val === 25 && multiplier === 3) return;
    if (val === 0 && multiplier !== 1) return;

    if (val === 0) {
      triggerHaptic("heavy");
    } else {
      triggerHaptic("tap");
    }

    let throwLabel = "";
    if (val === 0) {
      throwLabel = missTerm;
    } else if (val === 25) {
      throwLabel = multiplier === 1 ? bullTerm : `D${bullTerm}`;
    } else {
      const prefix =
        multiplier === 3
          ? tripleTerm.charAt(0).toUpperCase()
          : multiplier === 2
            ? "D"
            : "";
      throwLabel = `${prefix}${val}`;
    }

    dispatch({
      type: "ADD_MARK",
      payload: {
        value: val,
        multiplier,
        cricketMode: settings.cricketMode,
        throwLabel,
      },
    });
    setMultiplier(1);
  };

  const handleModifierToggle = (newMult: 2 | 3) => {
    triggerHaptic("heavy");
    setMultiplier((prev) => (prev === newMult ? 1 : newMult));
  };

  const handleUndo = () => {
    triggerHaptic("heavy");
    dispatch({ type: "UNDO" });
  };

  const currentThrows = state.currentTurnThrows || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>CRICKET</Text>
          <Text style={styles.headerSub}>
            {settings.cricketMode === "standard" ? "STANDARD" : "NO SCORE"}
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

      <View style={styles.mainArea}>
        <View style={styles.targetsColumn}>
          <View style={[styles.cell, styles.headerCell]}>
            <Text style={styles.headerLabel}>
              {t(language, "target") || "Target"}
            </Text>
          </View>
          {TARGETS.map((num) => (
            <View key={num} style={styles.cell}>
              <Text style={styles.targetText}>
                {num === 25 ? bullTerm : num}
              </Text>
            </View>
          ))}
          {settings.cricketMode === "standard" && (
            <View style={[styles.cell, styles.scoreLabelCell]}>
              <Text style={styles.scoreLabelText}>
                {t(language, "points") || "Points"}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flexDirection: "row", height: "100%" }}>
            {state.playerStates.map((p, pIdx) => {
              const isActive = state.currentIndex === pIdx;
              return (
                <View
                  key={pIdx}
                  style={[styles.playerColumn, isActive && styles.activeColumn]}
                >
                  <View
                    style={[
                      styles.cell,
                      styles.headerCell,
                      isActive && styles.activeHeaderCell,
                    ]}
                  >
                    <Text
                      style={[
                        styles.playerName,
                        isActive && styles.activePlayerName,
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </View>
                  {TARGETS.map((num) => (
                    <View key={num} style={styles.cell}>
                      <Text
                        style={[
                          styles.markSymbol,
                          (p.marks[num] || 0) >= 3 && styles.markClosed,
                        ]}
                      >
                        {getMarkSymbol(p.marks[num] || 0)}
                      </Text>
                    </View>
                  ))}
                  {settings.cricketMode === "standard" && (
                    <View style={[styles.cell, styles.scoreCell]}>
                      <Text style={styles.playerScoreText}>{p.score}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.keyboard}>
        <View style={styles.activePlayerRow}>
          <Text style={styles.turnText}>
            {t(language, "turn") || "Turn"}:{" "}
            <Text style={{ color: theme.colors.primary }}>
              {state.playerStates[state.currentIndex].name}
            </Text>
          </Text>

          <View style={styles.dartsRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.throwBox,
                  state.throwsThisTurn === i && styles.throwBoxActive,
                ]}
              >
                <Text
                  style={styles.throwBoxText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {currentThrows[i] || ""}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.keyRow}>
          {[20, 19, 18, 17].map((n) => (
            <Pressable
              key={n}
              onPress={() => handleThrow(n)}
              style={styles.key}
            >
              <Text style={styles.keyText}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.keyRow}>
          {[16, 15, 25, 0].map((n) => {
            const isDisabled =
              (n === 25 && multiplier === 3) || (n === 0 && multiplier !== 1);

            return (
              <Pressable
                key={n}
                onPress={() => {
                  if (!isDisabled) handleThrow(n);
                }}
                style={[styles.key, isDisabled && styles.disabledKey]}
              >
                <Text
                  style={[styles.keyText, isDisabled && styles.disabledKeyText]}
                >
                  {n === 25 ? bullTerm : n === 0 ? missTerm : n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.keyRow}>
          <Pressable
            onPress={() => handleModifierToggle(2)}
            style={[styles.modKey, multiplier === 2 && styles.modActive]}
          >
            <Text
              style={[styles.modText, multiplier === 2 && styles.modTextActive]}
            >
              Double
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleModifierToggle(3)}
            style={[styles.modKey, multiplier === 3 && styles.modActive]}
          >
            <Text
              style={[styles.modText, multiplier === 3 && styles.modTextActive]}
            >
              {tripleTerm}
            </Text>
          </Pressable>
          <Pressable onPress={handleUndo} style={styles.undoKey}>
            <Ionicons name="arrow-undo" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      <Modal visible={!!state.matchWinner} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 50 }}>🏆</Text>
            <Text style={styles.modalTitle}>
              {state.matchWinner?.name} {t(language, "wins") || "WINS!"}
            </Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                isExiting.current = true;
                router.back();
              }}
            >
              <Text style={styles.modalBtnText}>
                {t(language, "endMatch") || "End"}
              </Text>
            </Pressable>
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerBackBtn: { padding: 4, marginLeft: -4 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    headerSub: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
      letterSpacing: 1,
    },
    headerRight: { minWidth: 40, alignItems: "flex-end" },
    timerBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      gap: 4,
    },
    timerText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.textMain,
      fontVariant: ["tabular-nums"],
    },
    mainArea: { flex: 1, flexDirection: "row" },

    targetsColumn: {
      width: 70,
      backgroundColor: theme.colors.card,
      borderRightWidth: 2,
      borderRightColor: theme.colors.cardBorder,
      zIndex: 10,
    },
    targetText: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    playerColumn: {
      width: COLUMN_WIDTH,
      borderRightWidth: 1,
      borderRightColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.background,
    },
    activeColumn: { backgroundColor: theme.colors.primaryLight },
    playerName: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.textMuted,
      paddingHorizontal: 5,
      textAlign: "center",
    },
    activePlayerName: { color: theme.colors.primary },

    cell: {
      flex: 1,
      minHeight: 40,
      justifyContent: "center",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerCell: {
      flex: 0,
      height: 50,
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.cardBorder,
    },
    activeHeaderCell: { borderBottomColor: theme.colors.primary },
    headerLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.textLight,
      textTransform: "uppercase",
    },

    markSymbol: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.colors.success,
    },
    markClosed: { color: theme.colors.danger },

    scoreLabelCell: {
      backgroundColor: theme.colors.cardBorder,
      borderBottomWidth: 0,
    },
    scoreLabelText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
    },
    scoreCell: { backgroundColor: theme.colors.card, borderBottomWidth: 0 },
    playerScoreText: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: "900",
    },

    keyboard: {
      padding: 10,
      backgroundColor: theme.colors.cardBorder,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
      paddingBottom: 20,
    },
    activePlayerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      paddingHorizontal: 8,
    },
    turnText: { fontWeight: "800", color: theme.colors.textMain, fontSize: 16 },
    dartsRow: { flexDirection: "row", gap: 6 },

    throwBox: {
      width: 45,
      height: 32,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.colors.cardBorder,
    },
    throwBoxActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    throwBoxText: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.textMain,
    },

    keyRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
    key: {
      flex: 1,
      height: 65,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      elevation: 2,
    },
    keyText: { fontSize: 18, fontWeight: "800", color: theme.colors.textMain },

    disabledKey: {
      backgroundColor: theme.colors.cardBorder,
      elevation: 0,
      opacity: 0.5,
    },
    disabledKeyText: { color: theme.colors.textLight },

    modKey: {
      flex: 1.5,
      height: 65,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      elevation: 2,
    },
    modActive: {
      backgroundColor: theme.colors.primaryDark,
    },
    modText: { fontSize: 14, fontWeight: "800", color: theme.colors.textMain },
    modTextActive: { color: "#fff" },
    undoKey: {
      flex: 1,
      height: 65,
      backgroundColor: theme.colors.danger,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      elevation: 2,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      padding: 40,
      borderRadius: 30,
      alignItems: "center",
      width: "80%",
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      marginVertical: 20,
      textAlign: "center",
      color: theme.colors.textMain,
    },
    modalBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 40,
      paddingVertical: 15,
      borderRadius: 15,
    },
    modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  });
