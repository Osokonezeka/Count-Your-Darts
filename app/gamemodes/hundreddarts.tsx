import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { current, produce } from "immer";
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
import { InputModeSelector } from "../../components/keyboards/InputModeSelector";
import { InteractiveDartboard } from "../../components/keyboards/InteractiveDartboard";
import { ScoreKeyboard } from "../../components/keyboards/ScoreKeyboard";
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
import { useMatchLifecycle } from "../../hooks/useMatchLifecycle";
import {
  breakdownScoreToDarts,
  resolveBotAverage,
  simulateBotTurn,
} from "../../lib/bot";
import { formatThrow, IMPOSSIBLE_SCORES } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
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

const scoringReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];

      const hitPoints = value * multiplier;
      player.score += hitPoints;
      player.dartsCount += 1;

      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, coords });

      const isTurnOver =
        draft.throwsThisTurn === 2 || player.dartsCount === MAX_DARTS;

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
        if (!player.allTurns) player.allTurns = [];
        player.allTurns.push(player.turnThrows);

        draft.speechEvent = { text: turnSum.toString(), id: Date.now() };

        const allDone = draft.playerStates.every((p) => p.isFinished);
        if (allDone) {
          const finishers = draft.playerStates
            .map((p, idx) => ({ ...p, originalIdx: idx }))
            .sort((a, b) => b.score - a.score);
          finishers.forEach((f, rankIdx) => {
            draft.playerStates[f.originalIdx].rank = rankIdx + 1;
          });
          return;
        }

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

    case "ADD_DART_VISUAL": {
      const { value, multiplier } = action.payload;
      const player = draft.playerStates[draft.currentIndex];
      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({
        value,
        multiplier,
        darts: 1,
        isScoreInput: false,
      });
      return;
    }

    case "ADD_TURN_SCORE": {
      const { score, individualDarts = null } = action.payload;
      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];

      player.score += score;
      const dartsRemainingInTurn = 3 - draft.throwsThisTurn;
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
        if (!player.turnThrows) player.turnThrows = [];
        player.turnThrows.push({
          value: score,
          multiplier: 1,
          darts: dartsToLog,
          isScoreInput: true,
        });
      }

      if (score >= 180) player.s180++;
      else if (score >= 140) player.s140++;
      else if (score >= 100) player.s100++;
      else if (score >= 60) player.s60++;

      if (player.dartsCount >= MAX_DARTS) {
        player.isFinished = true;
      }

      if (!player.allTurns) player.allTurns = [];
      player.allTurns.push(player.turnThrows);

      draft.speechEvent = { text: score.toString(), id: Date.now() };

      const allDone = draft.playerStates.every((p) => p.isFinished);
      if (allDone) {
        const finishers = draft.playerStates
          .map((p, idx) => ({ ...p, originalIdx: idx }))
          .sort((a, b) => b.score - a.score);
        finishers.forEach((f, rankIdx) => {
          draft.playerStates[f.originalIdx].rank = rankIdx + 1;
        });
        return;
      }

      let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
      while (draft.playerStates[nextIdx].isFinished) {
        nextIdx = (nextIdx + 1) % draft.playerStates.length;
      }
      draft.playerStates[nextIdx].turnThrows = [];
      draft.currentIndex = nextIdx;
      draft.throwsThisTurn = 0;
      return;
    }

    case "UNDO": {
      if (!draft.history || draft.history.length === 0) return;
      const prevState = draft.history[draft.history.length - 1];

      let restoredPlayers = prevState.playerStates;
      if (prevState.throwsThisTurn === 0) {
        restoredPlayers = restoredPlayers.map((p, idx) =>
          idx === prevState.currentIndex ? { ...p, turnThrows: [] } : p,
        );
      }
      return {
        ...prevState,
        playerStates: restoredPlayers,
        history: draft.history.slice(0, -1),
        speechEvent: null,
        isUndoing: true,
      };
    }

    case "RESET_CURRENT_TURN": {
      if (draft.throwsThisTurn === 0) return;
      const turnStartIndex = draft.history.length - draft.throwsThisTurn;
      if (turnStartIndex < 0) return;

      const prevState = draft.history[turnStartIndex];

      let restoredPlayers = prevState.playerStates;
      if (prevState.throwsThisTurn === 0) {
        restoredPlayers = restoredPlayers.map((p, idx) =>
          idx === prevState.currentIndex ? { ...p, turnThrows: [] } : p,
        );
      }
      return {
        ...prevState,
        playerStates: restoredPlayers,
        history: draft.history.slice(0, turnStartIndex),
        speechEvent: null,
        isUndoing: true,
      };
    }
  }
});

export default function OneHundredDarts() {
  const { selectedPlayers } = useGame();
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

  const {
    saveMatchToHistory: persistMatchToHistory,
    useExitGuard,
    confirmExit,
  } = useMatchLifecycle(matchId);

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
          playerStates: selectedPlayers.map((name) => ({
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
  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const {
    GameAlerts,
    showExitConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  useEffect(() => {
    if (state.speechEvent) {
      speak(t(language, state.speechEvent.text));
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
      if (selectedPlayers) {
        const humanNames = selectedPlayers.filter((p: string) => !isBot(p));
        const baseline = await getPlayersHistoricalBaseline(
          humanNames,
          "100 Darts",
        );
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [selectedPlayers]);

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
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (allDone) {
      triggerHaptic("success");
    }
  }, [allDone]);

  const saveScoringStats = async (navigateAway: boolean = true) => {
    const mappedPlayers = state.playerStates
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
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));

    await persistMatchToHistory({
      mode: "100 Darts",
      players: mappedPlayers,
      isUnfinished: !allDone,
      gameState: { ...state, history: [], savedMatchTime: matchTimeRef.current },
      matchTimeSeconds: matchTimeRef.current,
      navigateAway,
    });
  };

  const hasMatchStarted = state.playerStates.some((p) => p.dartsCount > 0);

  useExitGuard(hasMatchStarted || allDone, () => {
    if (allDone) {
      saveScoringStats(false).then(confirmExit);
      return;
    }

    showExitConfirm(() => {
      saveScoringStats(false).then(confirmExit);
    });
  });

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
            {t(language, "100Darts")?.toUpperCase()}
          </Text>
          <Text style={styles.headerSub}>
            {t(language, "highScore")?.toUpperCase()}
          </Text>
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
                        {t(language, "thrown")?.toUpperCase()}:{" "}
                        {p.dartsCount} / {MAX_DARTS}
                      </Text>
                    </View>
                  )}

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>
                        {t(language, "avgShort")}
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
        title={t(language, "trainingFinished")}
        subtitle={t(language, "trainingSaved")}
        theme={theme}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch")}
            theme={theme}
            onPress={() => saveScoringStats(true)}
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
