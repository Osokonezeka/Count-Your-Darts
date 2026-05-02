import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGame } from "../../context/GameContext";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSpeech } from "../../context/SpeechContext";
import { useTerminology } from "../../context/TerminologyContext";
import { FinishModal } from "../../components/modals/FinishModal";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { useGameModals } from "../../hooks/useGameModals";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { getSharedGameStyles } from "../../components/common/SharedGameStyles";

const TARGETS = [20, 19, 18, 17, 16, 15, 25];
const COLUMN_WIDTH = 105;

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
  speechEvent?: { text: string; id: number } | null;
  turnPointsAdded?: number;
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
        turnPointsAdded: state.turnPointsAdded,
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

      let pointsAdded = 0;

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
            pointsAdded = value * hitsLeft;
            player.score += pointsAdded;
          }
        }
      }

      const newTurnPointsAdded =
        state.throwsThisTurn === 0
          ? pointsAdded
          : (state.turnPointsAdded || 0) + pointsAdded;

      updatedPlayers[currentPlayerIdx] = player;

      const hasClosedAll = TARGETS.every(
        (num) => (player.marks[num] || 0) >= 3,
      );
      const hasHighestScore = updatedPlayers.every(
        (p) => p.score <= player.score,
      );

      const isGameOver =
        hasClosedAll && (cricketMode === "no-score" || hasHighestScore);
      const isTurnOver = state.throwsThisTurn === 2 || isGameOver;

      let newSpeechEvent = null;
      if (isTurnOver && newTurnPointsAdded > 0) {
        newSpeechEvent = {
          text: newTurnPointsAdded.toString(),
          id: Date.now(),
        };
      }

      if (isGameOver) {
        return {
          ...state,
          playerStates: updatedPlayers,
          currentTurnThrows: newTurnThrows,
          matchWinner: player,
          speechEvent: newSpeechEvent,
          turnPointsAdded: newTurnPointsAdded,
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
          speechEvent: newSpeechEvent,
          turnPointsAdded: 0,
        };
      }

      return {
        ...state,
        playerStates: updatedPlayers,
        throwsThisTurn: state.throwsThisTurn + 1,
        currentTurnThrows: newTurnThrows,
        history: [...(state.history || []), snapshot],
        speechEvent: null,
        turnPointsAdded: newTurnPointsAdded,
      };
    }
    case "UNDO": {
      if (!state.history || state.history.length === 0) return state;
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

export default function Cricket() {
  const { players, settings } = useGame();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { bullTerm, missTerm, tripleTerm } = useTerminology();
  const { triggerHaptic } = useHaptics();
  const { speak } = useSpeech();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);

  const { resumeData } = useLocalSearchParams();
  const parsedResume = useMemo(
    () => (resumeData ? JSON.parse(resumeData as string) : null),
    [resumeData],
  );
  const currentMode =
    parsedResume?.settings?.cricketMode || settings?.cricketMode || "standard";
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
    cricketReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: (players || []).map((name) => ({
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
          speechEvent: null,
          turnPointsAdded: 0,
        },
  );

  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [matchTime, setMatchTime] = useState(
    () => parsedResume?.gameState?.savedMatchTime || 0,
  );

  const { GameAlerts, showExitConfirm } = useGameModals(language);

  useEffect(() => {
    if (state.speechEvent) {
      speak(state.speechEvent.text);
    }
  }, [state.speechEvent]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: state.currentIndex * COLUMN_WIDTH - 50,
        animated: true,
      });
    }
  }, [state.currentIndex]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!state.matchWinner) {
      interval = setInterval(() => {
        setMatchTime((prev: number) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.matchWinner]);

  useEffect(() => {
    if (state.matchWinner) {
      triggerHaptic("success");
    }
  }, [state.matchWinner]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current || state.matchWinner) return;

      e.preventDefault();
      const hasStarted = state.playerStates.some((p) => p.darts > 0);
      if (!hasStarted) {
        isExiting.current = true;
        navigation.dispatch(e.data.action);
        return;
      }

      showExitConfirm(() => {
        saveCricketHistory(false).then(() => {
          isExiting.current = true;
          navigation.dispatch(e.data.action);
        });
      });
    });

    return unsubscribe;
  }, [navigation, language, state, matchTime]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const saveCricketHistory = async (navigateAway: boolean = true) => {
    try {
      if (navigateAway) isExiting.current = true;
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const isUnfinished = !state.matchWinner;
      const historyItem = {
        id: matchId,
        date: formattedDate,
        duration: formatTime(matchTime),
        mode: "Cricket",
        settings: { cricketMode: currentMode },
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTime }
          : undefined,
        players: state.playerStates
          .map((p) => {
            const isWinner = state.matchWinner?.name === p.name;
            let closedCount = 0;
            TARGETS.forEach((t) => {
              if (p.marks[t] && p.marks[t] >= 3) closedCount++;
            });
            return {
              name: p.name,
              score: p.score,
              darts: p.darts,
              closedTargets: closedCount,
              rank: isWinner ? 1 : 2,
            };
          })
          .sort((a, b) => a.rank - b.rank),
      };

      const existingStr = await AsyncStorage.getItem("@dart_match_history");
      const existingHistory = existingStr ? JSON.parse(existingStr) : [];

      const existingIndex = existingHistory.findIndex(
        (h: any) => h.id === matchId,
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
    } catch (error) {
      console.error("Error saving cricket history", error);
      if (navigateAway) router.push("/play");
    }
  };

  const handleThrow = (value: number) => {
    if (state.matchWinner) return;
    if ((value === 25 && multiplier === 3) || (value === 0 && multiplier !== 1))
      return;

    triggerHaptic("tap");

    let throwLabel = value === 0 ? "0" : value.toString();
    if (value === 25) throwLabel = multiplier === 2 ? "D25" : "25";
    else if (multiplier === 2) throwLabel = `D${value}`;
    else if (multiplier === 3) throwLabel = `T${value}`;

    dispatch({
      type: "ADD_MARK",
      payload: {
        value,
        multiplier,
        cricketMode: currentMode,
        throwLabel,
      },
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

  const activePlayer = state.playerStates[state.currentIndex];

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
          <Text style={styles.headerTitle}>CRICKET</Text>
          <Text style={styles.headerSub}>
            {currentMode === "standard" ? "WITH SCORE" : "NO SCORE"}
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

      <View style={styles.boardWrapper}>
        <View style={styles.targetsCol}>
          <View style={styles.emptyCorner} />
          {TARGETS.map((t) => (
            <View key={`target-${t}`} style={styles.targetCell}>
              <Text
                style={styles.targetText}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {t === 25 ? bullTerm : t}
              </Text>
            </View>
          ))}
          {currentMode === "standard" && (
            <View style={styles.targetCell}>
              <Text style={styles.targetText}>Σ</Text>
            </View>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.playersScrollContent}
        >
          {state.playerStates.map((p, pIdx) => {
            const isActive = pIdx === state.currentIndex && !state.matchWinner;

            return (
              <View
                key={p.name}
                style={[styles.playerCol, isActive && styles.activePlayerCol]}
              >
                <View style={styles.playerHeaderCell}>
                  <Text
                    style={[
                      styles.playerNameText,
                      isActive && { color: theme.colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                </View>

                {TARGETS.map((t) => {
                  const marksCount = p.marks[t] || 0;
                  const isClosed = marksCount >= 3;

                  return (
                    <View key={`cell-${p.name}-${t}`} style={styles.markCell}>
                      <Text
                        style={[
                          styles.markText,
                          isClosed && styles.markTextClosed,
                        ]}
                      >
                        {getMarkSymbol(marksCount)}
                      </Text>
                    </View>
                  );
                })}

                {currentMode === "standard" && (
                  <View style={styles.scoreCell}>
                    <Text style={styles.scoreText}>{p.score}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.infoArea}>
        {!state.matchWinner && (
          <>
            <View style={styles.infoTop}>
              <Text style={styles.infoTurnTitle}>
                {t(language, "turn") || "TURN"}:
              </Text>
              <Text style={styles.infoActivePlayer}>{activePlayer.name}</Text>
            </View>

            <View style={styles.throwsRow}>
              {[0, 1, 2].map((idx) => {
                const throwVal = state.currentTurnThrows[idx];
                return (
                  <View
                    key={`throw-${idx}`}
                    style={[
                      styles.throwBox,
                      state.throwsThisTurn === idx && styles.throwBoxActive,
                    ]}
                  >
                    <Text style={styles.throwBoxText}>{throwVal || ""}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.keyboard}>
        <View style={styles.keyRow}>
          {[20, 19, 18, 17].map((num) => (
            <TouchableOpacity
              key={`key-${num}`}
              style={styles.keyNum}
              onPress={() => handleThrow(num)}
            >
              <Text style={styles.keyTextNum}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.keyRow}>
          {[16, 15, 25].map((num) => {
            const isBullDisabled = num === 25 && multiplier === 3;
            return (
              <TouchableOpacity
                key={`key-${num}`}
                style={[styles.keyNum, isBullDisabled && styles.disabledKey]}
                onPress={() => {
                  if (!isBullDisabled) handleThrow(num);
                }}
              >
                <Text
                  style={[
                    styles.keyTextNum,
                    isBullDisabled && styles.disabledKeyText,
                  ]}
                >
                  {num === 25 ? bullTerm : num}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={handleMiss}
            style={[styles.keyNum, multiplier !== 1 && styles.disabledKey]}
          >
            <Text
              style={[
                styles.keyTextNum,
                multiplier !== 1 && styles.disabledKeyText,
              ]}
            >
              {missTerm}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.keyRowModifiers}>
          <TouchableOpacity
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
              {t(language, "double") || "Double"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
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
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleUndo}
            style={[styles.keyAction, styles.undoKey]}
          >
            <Ionicons name="arrow-undo" size={28} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <FinishModal
        visible={!!state.matchWinner}
        title={(
          t(language, "playerFinished") || "{{name}} finished the game!"
        ).replace("{{name}}", state.matchWinner?.name || "")}
        theme={theme}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch") || "End"}
            theme={theme}
            onPress={() => saveCricketHistory(true)}
          />
        </View>
      </FinishModal>

      <GameAlerts />
    </SafeAreaView>
  );
}

const getSpecificStyles = (theme: any) =>
  StyleSheet.create({
    boardWrapper: {
      flex: 1,
      flexDirection: "row",
      marginTop: 4,
    },
    targetsCol: {
      width: 56,
      backgroundColor: theme.colors.cardBorder,
      paddingVertical: 22,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      alignItems: "center",
      justifyContent: "space-between",
      elevation: 2,
    },
    emptyCorner: { height: 42 },
    targetCell: {
      width: 46,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    targetText: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMain,
    },

    playersScrollContent: {
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    playerCol: {
      width: COLUMN_WIDTH,
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      marginHorizontal: 4,
      paddingVertical: 10,
      borderWidth: 2,
      borderColor: theme.colors.card,
      elevation: 1,
      justifyContent: "space-between",
    },
    activePlayerCol: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    playerHeaderCell: {
      height: 42,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    playerNameText: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },

    markCell: {
      width: 46,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
    },
    markText: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    markTextClosed: {
      color: theme.colors.success,
    },

    scoreCell: {
      width: COLUMN_WIDTH - 16,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 8,
    },
    scoreText: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
    },

    infoArea: {
      height: 80,
      paddingHorizontal: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    infoTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      gap: 6,
    },
    infoTurnTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    infoActivePlayer: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.primary,
      textTransform: "uppercase",
    },
    keyRow: { flexDirection: "row", gap: 6 },
    keyRowModifiers: { flexDirection: "row", gap: 6, marginTop: 4 },
    keyNum: {
      flex: 1,
      height: 52,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyTextNum: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textMain,
    },
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
  });
