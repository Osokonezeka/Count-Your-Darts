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

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CustomAlert, { AlertButton } from "../components/CustomAlert";
import { useGame } from "../context/GameContext";
import { useHaptics } from "../context/HapticsContext";
import { useLanguage } from "../context/LanguageContext";
import { useTerminology } from "../context/TerminologyContext";
import { useTheme } from "../context/ThemeContext";
import { getCheckoutInfo } from "../lib/checkouts";
import { t } from "../lib/i18n";

type Throw = { value: number; multiplier: number };

type GameSettings = {
  inRule: "straight" | "double" | "master";
  outRule: "straight" | "double" | "master";
  startPoints: number;
  legs: number;
  sets: number;
};

type PlayerState = {
  name: string;
  score: number;
  roundStartScore: number;
  hasOpened: boolean;
  roundStartHasOpened: boolean;
  darts: number;
  turnThrows: Throw[];
  legs: number;
  sets: number;
  isFinished: boolean;
  rank?: number;
  totalMatchDarts: number;
  checkoutDarts: number;
  checkoutHits: number;
};

type GameState = {
  settings: GameSettings;
  playerStates: PlayerState[];
  currentIndex: number;
  startingPlayerIndex: number;
  throwsThisTurn: number;
  history: any[];
  legWinner: PlayerState | null;
  setWinner: PlayerState | null;
  matchWinner: PlayerState | null;
  finishedPlayersCount: number;
};

const initialState = (players: string[], settings: GameSettings): GameState => {
  const isStraightIn = settings.inRule === "straight";
  return {
    settings,
    playerStates: players.map((p) => ({
      name: p,
      score: settings.startPoints,
      roundStartScore: settings.startPoints,
      hasOpened: isStraightIn,
      roundStartHasOpened: isStraightIn,
      darts: 0,
      turnThrows: [],
      legs: 0,
      sets: 0,
      isFinished: false,
      totalMatchDarts: 0,
      checkoutDarts: 0,
      checkoutHits: 0,
    })),
    currentIndex: 0,
    startingPlayerIndex: 0,
    throwsThisTurn: 0,
    history: [],
    legWinner: null,
    setWinner: null,
    matchWinner: null,
    finishedPlayersCount: 0,
  };
};

function gameReducer(state: GameState, action: any): GameState {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier } = action.payload;
      const {
        inRule,
        outRule,
        legs: targetLegs,
        sets: targetSets,
      } = state.settings;

      const { history, ...stateWithoutHistory } = state;
      const snapshot = JSON.parse(JSON.stringify(stateWithoutHistory));

      const updatedPlayers = [...state.playerStates];
      const playerIndex = state.currentIndex;
      const player = { ...updatedPlayers[playerIndex] };

      player.totalMatchDarts = (player.totalMatchDarts || 0) + 1;

      const isGameDart =
        player.score === 50 || (player.score <= 40 && player.score % 2 === 0);
      if (isGameDart) {
        player.checkoutDarts = (player.checkoutDarts || 0) + 1;
      }

      if (state.throwsThisTurn === 0) {
        player.roundStartScore = player.score;
        player.roundStartHasOpened = player.hasOpened;
      }

      let hitPoints = value * multiplier;
      let validIn = player.hasOpened;

      if (!validIn) {
        if (inRule === "double" && multiplier === 2) validIn = true;
        if (inRule === "master" && (multiplier === 2 || multiplier === 3))
          validIn = true;
      }

      if (!validIn) hitPoints = 0;
      else player.hasOpened = true;

      player.darts += 1;
      const newScore = player.score - hitPoints;
      player.turnThrows = [...(player.turnThrows || []), { value, multiplier }];

      let isWin = false;
      let isBust = newScore < 0;

      if (newScore === 0) {
        let validOut = true;
        if (outRule === "double" && multiplier !== 2) validOut = false;
        if (outRule === "master" && multiplier !== 2 && multiplier !== 3)
          validOut = false;
        if (validOut) isWin = true;
        else isBust = true;
      } else if (newScore === 1) {
        if (outRule === "double" || outRule === "master") isBust = true;
      }

      player.score = isWin ? 0 : isBust ? player.roundStartScore : newScore;
      if (isBust) player.hasOpened = player.roundStartHasOpened;
      updatedPlayers[playerIndex] = player;

      if (isWin) {
        if (isGameDart) player.checkoutHits = (player.checkoutHits || 0) + 1;

        const isMatchWin =
          player.sets + (player.legs + 1 === targetLegs ? 1 : 0) === targetSets;
        const isSetWin = player.legs + 1 === targetLegs;

        if (isMatchWin) {
          player.legs += 1;
          player.sets += 1;
          return {
            ...state,
            playerStates: updatedPlayers,
            matchWinner: player,
            history: [...state.history, snapshot],
          };
        } else if (isSetWin) {
          player.legs += 1;
          player.sets += 1;
          return {
            ...state,
            playerStates: updatedPlayers,
            setWinner: player,
            history: [...state.history, snapshot],
          };
        } else {
          player.legs += 1;
          return {
            ...state,
            playerStates: updatedPlayers,
            legWinner: player,
            history: [...state.history, snapshot],
          };
        }
      }

      if (isBust || state.throwsThisTurn === 2) {
        let nextIdx = (state.currentIndex + 1) % state.playerStates.length;
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

    case "START_NEXT_LEG": {
      const { history, ...stateWithoutHistory } = state;
      const snapshot = JSON.parse(JSON.stringify(stateWithoutHistory));

      const isNewSet = state.setWinner !== null;
      const nextStarter =
        (state.startingPlayerIndex + 1) % state.playerStates.length;
      const isStraightIn = state.settings.inRule === "straight";

      return {
        ...state,
        playerStates: state.playerStates.map((p) => ({
          ...p,
          score: state.settings.startPoints,
          roundStartScore: state.settings.startPoints,
          hasOpened: isStraightIn,
          roundStartHasOpened: isStraightIn,
          darts: 0,
          turnThrows: [],
          legs: isNewSet ? 0 : p.legs,
        })),
        currentIndex: nextStarter,
        startingPlayerIndex: nextStarter,
        throwsThisTurn: 0,
        history: [...history, snapshot],
        legWinner: null,
        setWinner: null,
        matchWinner: null,
      };
    }

    case "CONTINUE_AFTER_WIN": {
      const updatedPlayers = [...state.playerStates];
      const winnerIndex = updatedPlayers.findIndex(
        (p) => p.name === state.matchWinner?.name,
      );
      if (winnerIndex === -1) return state;

      const winner = { ...updatedPlayers[winnerIndex] };
      const newFinishedCount = state.finishedPlayersCount + 1;

      winner.isFinished = true;
      winner.rank = newFinishedCount;
      updatedPlayers[winnerIndex] = winner;

      let activeLeft = updatedPlayers.filter((p) => !p.isFinished).length;
      if (activeLeft === 0)
        return {
          ...state,
          playerStates: updatedPlayers,
          finishedPlayersCount: newFinishedCount,
          matchWinner: null,
        };

      let nextIdx = (state.currentIndex + 1) % state.playerStates.length;
      while (updatedPlayers[nextIdx].isFinished) {
        nextIdx = (nextIdx + 1) % state.playerStates.length;
      }
      updatedPlayers[nextIdx] = { ...updatedPlayers[nextIdx], turnThrows: [] };

      return {
        ...state,
        playerStates: updatedPlayers,
        currentIndex: nextIdx,
        throwsThisTurn: 0,
        finishedPlayersCount: newFinishedCount,
        matchWinner: null,
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

const formatThrow = (t: Throw) => {
  if (t.value === 0) return "0";
  if (t.value === 25) return t.multiplier === 2 ? "D25" : "25";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};

const getDictionaryFormat = (t: Throw) => {
  if (t.value === 25 && t.multiplier === 2) return "BULL";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};

const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function Game() {
  const { players, settings } = useGame();
  const { language } = useLanguage();
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const router = useRouter();
  const navigation = useNavigation();

  const isExiting = useRef(false);
  const styles = getStyles(theme);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current) {
        return;
      }

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
  }, [navigation, language]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [state, dispatch] = useReducer(
    gameReducer,
    initialState(players, {
      inRule: settings.inRule || "straight",
      outRule: settings.outRule || "double",
      startPoints: settings.startPoints || 501,
      legs: settings.legs || 1,
      sets: settings.sets || 1,
    }),
  );

  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState(3);
  const [matchTime, setMatchTime] = useState(0);

  const currentPlayer = state.playerStates[state.currentIndex];
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!state.matchWinner) {
      interval = setInterval(() => {
        setMatchTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.matchWinner]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: state.currentIndex * 85,
        animated: true,
      });
    }
  }, [state.currentIndex]);

  useEffect(() => {
    if (state.legWinner || state.setWinner) {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            dispatch({ type: "START_NEXT_LEG" });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [state.legWinner, state.setWinner]);

  useEffect(() => {
    if (state.matchWinner || state.setWinner || state.legWinner) {
      triggerHaptic("success");
    }
  }, [state.matchWinner, state.setWinner, state.legWinner]);

  const saveMatchToHistory = async () => {
    try {
      isExiting.current = true;

      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const mappedPlayers = state.playerStates.map((p, idx) => {
        const rawTurns = state.history.map(
          (h) => h.playerStates[idx].turnThrows,
        );
        rawTurns.push(state.playerStates[idx].turnThrows);

        const validTurns = rawTurns
          .filter((turn, i, arr) => {
            const nextTurn = arr[i + 1];
            return (
              turn &&
              turn.length > 0 &&
              (!nextTurn || nextTurn.length < turn.length)
            );
          })
          .map((turn) =>
            turn.map((t: any) => ({ v: t.value, m: t.multiplier })),
          );

        return {
          name: p.name,
          score: p.score,
          legs: p.legs,
          sets: p.sets,
          rank: p.rank,
          totalMatchDarts: p.totalMatchDarts || 0,
          checkoutDarts: p.checkoutDarts || 0,
          checkoutHits: p.checkoutHits || 0,
          allTurns: validTurns,
        };
      });

      mappedPlayers.sort((a, b) => {
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.rank) return -1;
        if (b.rank) return 1;
        return b.sets - a.sets || b.legs - a.legs || a.score - b.score;
      });

      const historyItem = {
        id: Date.now().toString(),
        date: formattedDate,
        duration: formatTime(matchTime),
        mode: "X01",
        settings: state.settings,
        players: mappedPlayers,
      };

      const existingHistoryStr = await AsyncStorage.getItem(
        "@dart_match_history",
      );
      const existingHistory = existingHistoryStr
        ? JSON.parse(existingHistoryStr)
        : [];

      const newHistory = [historyItem, ...existingHistory];
      await AsyncStorage.setItem(
        "@dart_match_history",
        JSON.stringify(newHistory),
      );
      router.push("/play");
    } catch (error) {
      console.error("Error saving history", error);
      router.push("/play");
    }
  };

  const handleThrow = (value: number) => {
    if (state.legWinner || state.setWinner || state.matchWinner) return;

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

  const handleUndo = () => {
    triggerHaptic("heavy");
    dispatch({ type: "UNDO" });
  };

  const isSingleLegMatch =
    state.settings.legs === 1 && state.settings.sets === 1;
  const activePlayersCount = state.playerStates.filter(
    (p) => !p.isFinished,
  ).length;

  let checkoutSuggestion: string | null = null;
  if (
    currentPlayer &&
    !state.legWinner &&
    !state.setWinner &&
    !state.matchWinner &&
    !currentPlayer.isFinished
  ) {
    const dartsRemaining = 3 - state.throwsThisTurn;
    if (state.throwsThisTurn === 0) {
      checkoutSuggestion = getCheckoutInfo(currentPlayer.score);
    } else {
      const originalCheckoutStr = getCheckoutInfo(
        currentPlayer.roundStartScore,
      );
      let followedPlan = false;
      if (originalCheckoutStr) {
        const plan = originalCheckoutStr.split(" ");
        followedPlan = true;
        for (let i = 0; i < (currentPlayer.turnThrows?.length || 0); i++) {
          if (getDictionaryFormat(currentPlayer.turnThrows[i]) !== plan[i]) {
            followedPlan = false;
            break;
          }
        }
        if (followedPlan)
          checkoutSuggestion = plan
            .slice(currentPlayer.turnThrows.length)
            .join(" ");
      }
      if (!followedPlan) {
        const newCheckoutStr = getCheckoutInfo(currentPlayer.score);
        if (
          newCheckoutStr &&
          newCheckoutStr.split(" ").length <= dartsRemaining
        )
          checkoutSuggestion = newCheckoutStr;
      }
    }
  }

  const isModalVisible =
    !!state.matchWinner || !!state.setWinner || !!state.legWinner;
  const winnerName =
    state.matchWinner?.name ||
    state.setWinner?.name ||
    state.legWinner?.name ||
    "";

  let modalTitle = "";
  let modalSub = "";
  let timerText = "";
  let showContinueButton = false;

  if (state.matchWinner) {
    if (isSingleLegMatch && activePlayersCount > 1) {
      modalTitle = (
        t(language, "playerFinished") || "{{name}} finished the game!"
      ).replace("{{name}}", winnerName);
      modalSub = t(language, "continueOrEnd") || "Do you want to continue?";
      showContinueButton = true;
    } else {
      modalTitle = isSingleLegMatch
        ? (
            t(language, "playerFinished") || "{{name}} finished the game!"
          ).replace("{{name}}", winnerName)
        : (t(language, "matchWinner") || "{{name}} has won the match!").replace(
            "{{name}}",
            winnerName,
          );
    }
  } else if (state.setWinner) {
    modalTitle = (t(language, "setWon") || "{{name}} won {{x}} set!")
      .replace("{{name}}", winnerName)
      .replace("{{x}}", state.setWinner.sets.toString());
    timerText = t(language, "autoNextSet") || "Next set in: ";
  } else if (state.legWinner) {
    modalTitle = (t(language, "legWon") || "{{name}} won {{x}} leg!")
      .replace("{{name}}", winnerName)
      .replace("{{x}}", state.legWinner.legs.toString());
    timerText = t(language, "autoNextLeg") || "Next leg in: ";
  }

  const inOutText = `${state.settings.inRule === "straight" ? "Straight" : state.settings.inRule} IN • ${state.settings.outRule === "straight" ? "Straight" : state.settings.outRule} OUT`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.customHeader}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerGameType}>
            {state.settings.startPoints}
          </Text>
          <Text style={styles.headerSubInfo}>{inOutText.toUpperCase()}</Text>
          <Text style={styles.headerSubInfo}>
            FIRST TO {state.settings.legs} L / {state.settings.sets} S
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
        ref={scrollViewRef}
        style={styles.scoreBoardScroll}
        contentContainerStyle={styles.scoreBoardContent}
      >
        {state.playerStates.map((p, i) => {
          const isActive = i === state.currentIndex && !p.isFinished;
          const avg =
            p.darts > 0
              ? (
                  ((state.settings.startPoints - p.score) / p.darts) *
                  3
                ).toFixed(1)
              : "0.0";

          const turnSum =
            p.turnThrows?.reduce((sum, t) => sum + t.value * t.multiplier, 0) ||
            0;

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
                            style={styles.throwBoxText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {p.turnThrows?.[idx]
                              ? formatThrow(p.turnThrows[idx])
                              : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text
                      style={[
                        styles.turnSumText,
                        (!p.turnThrows || p.turnThrows.length === 0) && {
                          opacity: 0,
                        },
                      ]}
                    >
                      Σ {turnSum}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    {!isSingleLegMatch && (
                      <View style={styles.legSetBadge}>
                        <Text style={styles.legSetText}>
                          L: {p.legs} S: {p.sets}
                        </Text>
                      </View>
                    )}
                    <View style={styles.statRow}>
                      <Ionicons
                        name="locate-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>{p.darts}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.avgIcon}>Ø</Text>
                      <Text style={styles.statBold}>{avg}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.checkoutWrapper}>
        {checkoutSuggestion && state.settings.outRule !== "straight" ? (
          <View style={styles.checkoutBadge}>
            <Text style={styles.checkoutLabel}>CHECKOUT</Text>
            <Text style={styles.checkoutValue}>{checkoutSuggestion}</Text>
          </View>
        ) : (
          <View style={{ height: 40 }} />
        )}
      </View>

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
            onPress={handleUndo}
            style={[styles.keyAction, styles.undoKey]}
          >
            <Ionicons name="arrow-undo" size={28} color={theme.colors.danger} />
          </Pressable>
        </View>
      </View>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.trophyWrapper}>
              <Text style={{ fontSize: 40 }}>🏆</Text>
            </View>

            <Text style={styles.modalTitle}>{modalTitle}</Text>
            {!!modalSub && <Text style={styles.modalSub}>{modalSub}</Text>}

            {!!timerText && !state.matchWinner && (
              <Text style={styles.modalTimer}>
                {timerText}{" "}
                <Text style={styles.modalTimerValue}>{countdown}s</Text>
              </Text>
            )}

            <View style={styles.modalActionsCol}>
              {state.matchWinner ? (
                showContinueButton ? (
                  <View
                    style={{ flexDirection: "row", gap: 12, width: "100%" }}
                  >
                    <Pressable
                      style={[styles.modalBtnCont, { flex: 1 }]}
                      onPress={() => dispatch({ type: "CONTINUE_AFTER_WIN" })}
                    >
                      <Text style={styles.modalBtnText}>
                        {t(language, "continue") || "Continue"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalBtnFin, { flex: 1 }]}
                      onPress={saveMatchToHistory}
                    >
                      <Text style={styles.modalBtnTextFin}>
                        {t(language, "endMatch") || "End"}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.modalBtnCont}
                    onPress={saveMatchToHistory}
                  >
                    <Text style={styles.modalBtnText}>
                      {t(language, "endMatch") || "End"}
                    </Text>
                  </Pressable>
                )
              ) : (
                <Pressable
                  style={styles.modalBtnCont}
                  onPress={() => dispatch({ type: "START_NEXT_LEG" })}
                >
                  <Text style={styles.modalBtnText}>
                    {t(language, "continue") || "Continue"}
                  </Text>
                </Pressable>
              )}

              <Pressable style={styles.modalBtnUndo} onPress={handleUndo}>
                <Text style={styles.modalBtnTextUndo}>
                  {t(language, "undoThrow") || "Undo last throw"}
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
    headerBackBtn: {
      padding: 8,
      marginLeft: -8,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerGameType: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMain,
      marginBottom: 2,
    },
    headerSubInfo: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    headerRight: {
      minWidth: 40,
      alignItems: "flex-end",
    },
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
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
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

    throwsCol: {
      flex: 1.5,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    throwsRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 4,
    },
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
    throwBoxActive: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    throwBoxText: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.colors.textMain,
    },
    turnSumText: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.colors.primary,
    },

    statsCol: { flex: 1.3, alignItems: "flex-end", justifyContent: "center" },
    legSetBadge: {
      backgroundColor: theme.colors.textMain,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: 6,
    },
    legSetText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    statBold: { fontWeight: "700", color: theme.colors.textMain, fontSize: 13 },
    avgIcon: { fontSize: 14, color: theme.colors.textMuted, fontWeight: "700" },

    checkoutWrapper: {
      marginTop: "auto",
      paddingHorizontal: 15,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
    },
    checkoutBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      gap: 8,
    },
    checkoutLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    checkoutValue: {
      color: theme.colors.success,
      fontSize: 16,
      fontWeight: "900",
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
      elevation: 0,
      opacity: 0.5,
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
      marginBottom: 15,
    },
    modalSub: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 25,
    },

    modalTimer: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 20,
      fontStyle: "italic",
    },
    modalTimerValue: {
      fontWeight: "800",
      color: theme.colors.textMain,
      fontSize: 15,
    },

    modalActionsCol: { width: "100%", gap: 12 },
    modalBtnCont: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    modalBtnFin: {
      backgroundColor: theme.colors.textMain,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
    },
    modalBtnUndo: {
      backgroundColor: theme.colors.background,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
    },
    modalBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

    modalBtnTextFin: {
      color: theme.colors.background,
      fontWeight: "800",
      fontSize: 16,
    },

    modalBtnTextUndo: {
      color: theme.colors.textMuted,
      fontWeight: "700",
      fontSize: 15,
    },
  });
