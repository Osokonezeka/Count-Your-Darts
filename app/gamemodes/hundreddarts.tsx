import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, {
  useEffect,
  useLayoutEffect,
  useReducer,
  useState,
  useMemo,
  useRef,
} from "react";
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
import { getSharedGameStyles } from "../../components/common/SharedGameStyles";
import { BotAwareKeyboard } from "../../components/common/BotAwareKeyboard";
import { useBotDelay } from "../../hooks/useBotDelay";
import { useBotTurn } from "../../hooks/useBotTurn";
import {
  getBotDifficultyFromName,
  simulateBotTurn,
  breakdownScoreToDarts,
  resolveBotAverage,
} from "../../lib/bot";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

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
  allTurns?: Throw[][];
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
  history: GameState[];
  speechEvent?: { text: string; id: number } | null;
  isUndoing?: boolean;
};

const formatThrow = (t: Throw) => {
  if (t.value === 0) return "0";
  if (t.value === 25) return t.multiplier === 2 ? "D25" : "25";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};

type Action =
  | {
      type: "ADD_THROW";
      payload: {
        value: number;
        multiplier: number;
        coords?: { x: number; y: number };
      };
    }
  | { type: "ADD_DART_VISUAL"; payload: { value: number; multiplier: number } }
  | {
      type: "ADD_TURN_SCORE";
      payload: {
        score: number;
        individualDarts?: { value: number; multiplier: number }[];
      };
    }
  | { type: "UNDO" }
  | { type: "RESET_CURRENT_TURN" };

function scoringReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;
      const snapshot = JSON.parse(JSON.stringify({ ...state, history: [] }));
      snapshot.isUndoing = false;

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
        player.allTurns = [...(player.allTurns || []), player.turnThrows];

        newSpeechEvent = { text: turnSum.toString(), id: Date.now() };
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
            isUndoing: false,
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
          isUndoing: false,
        };
      }

      return {
        ...state,
        playerStates: updatedPlayers,
        throwsThisTurn: state.throwsThisTurn + 1,
        history: [...state.history, snapshot],
        speechEvent: null,
        isUndoing: false,
      };
    }

    case "ADD_DART_VISUAL": {
      const { value, multiplier } = action.payload;
      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };
      player.turnThrows = [
        ...(player.turnThrows || []),
        { value, multiplier, darts: 1, isScoreInput: false },
      ];
      updatedPlayers[state.currentIndex] = player;
      return { ...state, playerStates: updatedPlayers };
    }

    case "ADD_TURN_SCORE": {
      const { score, individualDarts = null } = action.payload;
      const snapshot = JSON.parse(JSON.stringify({ ...state, history: [] }));
      snapshot.isUndoing = false;

      const updatedPlayers = [...state.playerStates];
      const player = { ...updatedPlayers[state.currentIndex] };

      player.score += score;
      const dartsRemainingInTurn = 3 - state.throwsThisTurn;
      const maxDartsLeft = MAX_DARTS - player.dartsCount;
      const dartsToLog = Math.min(dartsRemainingInTurn, maxDartsLeft);

      player.dartsCount += dartsToLog;

      if (individualDarts) {
        player.turnThrows = individualDarts.map(
          (d: { value: number; multiplier: number }) => ({
            value: d.value,
            multiplier: d.multiplier,
            darts: 1,
            isScoreInput: false,
          }),
        );
      } else {
        player.turnThrows = [
          {
            value: score,
            multiplier: 1,
            darts: dartsToLog,
            isScoreInput: true,
          },
        ];
      }

      if (score >= 180) player.s180++;
      else if (score >= 140) player.s140++;
      else if (score >= 100) player.s100++;
      else if (score >= 60) player.s60++;

      if (player.dartsCount >= MAX_DARTS) {
        player.isFinished = true;
      }

      player.allTurns = [...(player.allTurns || []), player.turnThrows];

      const newSpeechEvent = { text: score.toString(), id: Date.now() };

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
          isUndoing: false,
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
        isUndoing: false,
      };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      const prevState = state.history[state.history.length - 1];
      if (prevState.throwsThisTurn === 0) {
        prevState.playerStates[prevState.currentIndex].turnThrows = [];
      }
      return {
        ...prevState,
        history: state.history.slice(0, -1),
        speechEvent: null,
        isUndoing: true,
      };
    }

    case "RESET_CURRENT_TURN": {
      if (state.throwsThisTurn === 0) return state;
      const turnStartIndex = state.history.length - state.throwsThisTurn;
      if (turnStartIndex < 0) return state;
      const prevState = state.history[turnStartIndex];
      if (prevState.throwsThisTurn === 0) {
        prevState.playerStates[prevState.currentIndex].turnThrows = [];
      }
      return {
        ...prevState,
        history: state.history.slice(0, turnStartIndex),
        speechEvent: null,
        isUndoing: true,
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
    scoringReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            score: 0,
            dartsCount: 0,
            turnThrows: [],
            allTurns: [],
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
        },
  );

  const [inputMode, setInputMode] = useState<"dart" | "score" | "board">(
    "dart",
  );
  const [typedScore, setTypedScore] = useState("");
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [matchTime, setMatchTime] = useState(
    () => parsedResume?.gameState?.savedMatchTime || 0,
  );
  const {
    GameAlerts,
    showExitConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  useEffect(() => {
    if (state.speechEvent) {
      speak(state.speechEvent.text);
    }
  }, [state.speechEvent]);

  const allDone = state.playerStates.every((p) => p.isFinished);
  const { isFastBot, delay } = useBotDelay(state.isUndoing, 700);
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
          "100 Darts",
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
    "100 Darts",
    undefined,
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded &&
      !allDone &&
      !state.isUndoing &&
      state.throwsThisTurn === 0 &&
      !!activePlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      let botScore = simulateBotTurn(botAvg!, 9999);
      let individualDarts = breakdownScoreToDarts(botScore, 3, false);
      const maxDartsLeft = MAX_DARTS - activePlayer.dartsCount;
      if (maxDartsLeft < 3) {
        individualDarts = individualDarts.slice(0, maxDartsLeft);
        botScore = individualDarts.reduce(
          (sum: number, d: { value: number; multiplier: number }) =>
            sum + d.value * d.multiplier,
          0,
        );
      }
      return { botScore, individualDarts };
    },
    execute: async ({ botScore, individualDarts }) => {
      for (let i = 0; i < individualDarts.length; i++) {
        dispatch({ type: "ADD_DART_VISUAL", payload: individualDarts[i] });
        await new Promise((res) => setTimeout(res, isFastBot ? 50 : 200));
      }
      dispatch({
        type: "ADD_TURN_SCORE",
        payload: { score: botScore, individualDarts },
      });
    },
    dependencies: [
      state.currentIndex,
      state.throwsThisTurn,
      isFastBot,
      botAvg,
      isBaselineLoaded,
    ],
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!allDone) {
      interval = setInterval(() => setMatchTime((p: number) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [allDone]);

  useEffect(() => {
    if (allDone) {
      triggerHaptic("success");
      saveScoringStats();
    }
  }, [allDone]);

  const saveScoringStats = async (navigateAway: boolean = true) => {
    try {
      if (navigateAway) isExiting.current = true;
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const isUnfinished = !allDone;
      const historyItem = {
        id: matchId,
        date: formattedDate,
        duration: formatTime(matchTime),
        mode: "100 Darts",
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTime }
          : undefined,
        players: state.playerStates
          .map((p, idx) => {
            let validTurns = [];
            if (p.allTurns) {
              validTurns = [...p.allTurns];
              if (
                !p.isFinished &&
                p.turnThrows &&
                p.turnThrows.length > 0 &&
                state.currentIndex === idx
              ) {
                validTurns.push(p.turnThrows);
              }
            } else {
              const rawTurns = state.history
                ? state.history.map((h) => h.playerStates[idx].turnThrows)
                : [];
              rawTurns.push(p.turnThrows);
              validTurns = rawTurns.filter((turn, i, arr) => {
                const nextTurn = arr[i + 1];
                return (
                  turn &&
                  turn.length > 0 &&
                  (!nextTurn || nextTurn.length < turn.length)
                );
              });
            }

            const validTurnsFormatted = validTurns.map((turn) =>
              turn.map((t: Throw) => ({
                v: t.value,
                m: t.multiplier,
                d: t.darts,
                i: t.isScoreInput,
                c: t.coords,
              })),
            );

            return {
              name: p.name,
              score: p.score,
              darts: p.dartsCount,
              rank: p.rank,
              avg:
                p.dartsCount > 0
                  ? ((p.score / p.dartsCount) * 3).toFixed(1)
                  : "0.0",
              s180: p.s180,
              s140: p.s140,
              s100: p.s100,
              s60: p.s60,
              allTurns: validTurnsFormatted,
            };
          })
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
      console.error("Save 100 Darts error", e);
      if (navigateAway) router.push("/play");
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current || allDone) return;
      e.preventDefault();
      const hasStarted = state.playerStates.some((p) => p.dartsCount > 0);
      if (!hasStarted) {
        isExiting.current = true;
        navigation.dispatch(e.data.action);
        return;
      }
      showExitConfirm(() => {
        saveScoringStats(false).then(() => {
          isExiting.current = true;
          navigation.dispatch(e.data.action);
        });
      });
    });
    return unsubscribe;
  }, [navigation, allDone, state, matchTime]);

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
    setTypedScore("");
    setMultiplier(1);
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
                      <Text style={styles.targetLabel}>
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
        <BotAwareKeyboard
          playerName={activePlayer?.name || ""}
          onUndo={handleUndo}
          theme={theme}
          language={language}
          style={styles.keyboard}
        >
          <InputModeSelector
            inputMode={inputMode}
            setInputMode={setInputMode}
            theme={theme}
            language={language}
            onReset={() => {
              setTypedScore("");
              setMultiplier(1);
              dispatch({ type: "RESET_CURRENT_TURN" });
            }}
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
        </BotAwareKeyboard>
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

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    targetLabel: {
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
  });
