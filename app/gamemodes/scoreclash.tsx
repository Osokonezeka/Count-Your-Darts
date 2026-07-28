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
  currentRoundScore: number;
  totalMatchScore: number;
  dartsCount: number;
  roundDarts: number;
  turnThrows: Throw[];
  allTurns?: Throw[][];
  isFinished: boolean;
  rank?: number;
};

type GameState = {
  settings: {
    dartsPerRound: number;
    targetPoints: number;
    scoreClashTieRule: "points" | "tiebreaker";
  };
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  roundNumber: number;
  activeTiebreaker: number[] | null;
  history: GameState[];
  matchWinner: PlayerState | null;
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

const scoreClashReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW":
    case "ADD_TURN_SCORE": {
      const isTurnScore = action.type === "ADD_TURN_SCORE";
      const payload = action.payload as any;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      const activePool =
        draft.activeTiebreaker || draft.playerStates.map((_, i) => i);

      let turnSum = 0;
      let addedDartsCount = 0;

      if (!player.turnThrows) player.turnThrows = [];

      if (isTurnScore) {
        const dartsRemainingInTurn = 3 - draft.throwsThisTurn;
        turnSum = payload.score;
        addedDartsCount = dartsRemainingInTurn;
        player.dartsCount += addedDartsCount;
        draft.throwsThisTurn = 3;

        if (payload.individualDarts) {
          player.turnThrows = payload.individualDarts.map((d: any) => ({
            ...d,
            darts: 1,
            isScoreInput: false,
          }));
        } else {
          player.turnThrows.push({
            value: turnSum,
            multiplier: 1,
            darts: addedDartsCount,
            isScoreInput: true,
          });
        }
      } else {
        const { value, multiplier, coords } = payload;
        turnSum = value * multiplier;
        addedDartsCount = 1;
        player.dartsCount += addedDartsCount;
        draft.throwsThisTurn += 1;
        player.turnThrows.push({ value, multiplier, coords });
      }

      player.roundDarts = (player.roundDarts || 0) + addedDartsCount;
      player.currentRoundScore += turnSum;
      player.totalMatchScore += turnSum;

      const isTurnOver = draft.throwsThisTurn === 3;

      if (isTurnOver) {
        if (!player.allTurns) player.allTurns = [];
        player.allTurns.push(player.turnThrows);

        const currentTurnSumTotal = player.turnThrows.reduce(
          (sum, tr) =>
            sum + (tr.isScoreInput ? tr.value : tr.value * tr.multiplier),
          0,
        );
        draft.speechEvent = {
          text: currentTurnSumTotal.toString(),
          id: Date.now(),
        };

        const isRoundOver = activePool.every(
          (idx) =>
            (draft.playerStates[idx].roundDarts || 0) >=
            draft.settings.dartsPerRound,
        );

        if (isRoundOver) {
          const maxScore = Math.max(
            ...activePool.map(
              (idx) => draft.playerStates[idx].currentRoundScore,
            ),
          );
          const tiedPlayers = activePool.filter(
            (idx) => draft.playerStates[idx].currentRoundScore === maxScore,
          );

          if (
            tiedPlayers.length === 1 ||
            draft.settings.scoreClashTieRule !== "tiebreaker"
          ) {
            if (maxScore > 0 || tiedPlayers.length === 1) {
              tiedPlayers.forEach((idx) => {
                draft.playerStates[idx].score += 1;
              });
            }
            draft.activeTiebreaker = null;
            draft.roundNumber += 1;
          } else {
            draft.activeTiebreaker = tiedPlayers;
          }

          const matchWinners = draft.playerStates.filter(
            (p) => p.score >= draft.settings.targetPoints,
          );

          if (matchWinners.length > 0) {
            draft.playerStates.forEach((p) => (p.isFinished = true));
            const sorted = [...draft.playerStates].sort(
              (a, b) =>
                b.score - a.score || b.totalMatchScore - a.totalMatchScore,
            );
            sorted.forEach((p, idx) => {
              const original = draft.playerStates.find(
                (op) => op.name === p.name,
              )!;
              original.rank = idx + 1;
            });
            draft.matchWinner = draft.playerStates.find(
              (p) => p.name === sorted[0].name,
            ) as any;
            return;
          }

          draft.playerStates.forEach((p) => {
            p.currentRoundScore = 0;
            p.roundDarts = 0;
            p.turnThrows = [];
          });

          const nextActivePool =
            draft.activeTiebreaker || draft.playerStates.map((_, i) => i);
          draft.currentIndex = nextActivePool[0];
          draft.throwsThisTurn = 0;
        } else {
          let currentPoolIdx = activePool.indexOf(draft.currentIndex);
          let nextPoolIdx = (currentPoolIdx + 1) % activePool.length;
          draft.currentIndex = activePool[nextPoolIdx];
          draft.playerStates[draft.currentIndex].turnThrows = [];
          draft.throwsThisTurn = 0;
        }
        return;
      }
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

    case "UNDO":
    case "RESET_CURRENT_TURN": {
      if (draft.history.length === 0) return;
      let turnStartIndex = draft.history.length - 1;
      if (action.type === "RESET_CURRENT_TURN") {
        if (draft.throwsThisTurn === 0) return;
        turnStartIndex = draft.history.length - draft.throwsThisTurn;
        if (turnStartIndex < 0) return;
      }
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

export default function ScoreClash() {
  const { selectedPlayers, settings } = useGame();
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
    () => ({ ...getSharedGameStyles(theme), ...getSpecificStyles(theme) }),
    [theme],
  );
  const {
    GameAlerts,
    showExitConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  const [state, dispatch] = useReducer(
    scoreClashReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          settings: {
            dartsPerRound: settings?.scoreClashDartsPerRound || 3,
            targetPoints: settings?.scoreClashTargetPoints || 3,
            scoreClashTieRule: settings?.scoreClashTieRule || "points",
          },
          playerStates: selectedPlayers.map((name) => ({
            name,
            score: 0,
            currentRoundScore: 0,
            totalMatchScore: 0,
            dartsCount: 0,
            roundDarts: 0,
            turnThrows: [],
            allTurns: [],
            isFinished: false,
          })),
          currentIndex: 0,
          throwsThisTurn: 0,
          roundNumber: 1,
          activeTiebreaker: null,
          history: [],
          matchWinner: null,
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

  useEffect(() => {
    if (state.speechEvent) speak(t(language, state.speechEvent.text));
  }, [state.speechEvent]);

  const isGameOver = !!state.matchWinner;
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
          "Score Clash",
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
      !isGameOver &&
      !state.isUndoing &&
      state.throwsThisTurn === 0 &&
      !!activePlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      const botScore = simulateBotTurn(botAvg!, 9999);
      const individualDarts = breakdownScoreToDarts(botScore, 3, false);
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
    if (isGameOver) {
      triggerHaptic("success");
    }
  }, [isGameOver]);

  const saveScoringStats = async (navigateAway: boolean = true) => {
    const mappedPlayers = state.playerStates
      .map((p) => ({
        name: p.name,
        score: p.score,
        totalMatchScore: p.totalMatchScore,
        darts: p.dartsCount,
        rank: p.rank,
      }))
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));

    await persistMatchToHistory({
      mode: "Score Clash",
      settings: state.settings,
      players: mappedPlayers,
      isUnfinished: !isGameOver,
      gameState: { ...state, history: [], savedMatchTime: matchTimeRef.current },
      matchTimeSeconds: matchTimeRef.current,
      navigateAway,
    });
  };

  const hasMatchStarted = state.playerStates.some((p) => p.dartsCount > 0);

  useExitGuard(hasMatchStarted || isGameOver, () => {
    if (isGameOver) {
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
    if (isGameOver) return;
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
      if (next.length > 3 || parseInt(next, 10) > 180) return prev;
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
          <Text style={styles.headerGameType}>
            {t(language, "scoreClash")?.toUpperCase()}
          </Text>
          <Text style={styles.headerSubInfo}>
            {t(language, "round")?.toUpperCase()} {state.roundNumber} •{" "}
            {t(language, "firstTo")?.toUpperCase()}{" "}
            {state.settings.targetPoints}
            {state.activeTiebreaker
              ? ` • ${t(language, "tiebreakerBadge")}`
              : ""}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TimerBadge
            initialTime={matchTimeRef.current}
            isRunning={!isGameOver}
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
          const isTiebreakerActive = state.activeTiebreaker !== null;
          const isEliminatedFromTiebreaker =
            isTiebreakerActive && !state.activeTiebreaker.includes(i);
          const turnSum =
            p.turnThrows?.reduce(
              (sum, tr) =>
                sum + (tr.isScoreInput ? tr.value : tr.value * tr.multiplier),
              0,
            ) || 0;

          return (
            <View
              key={i}
              style={[
                styles.playerRow,
                isActive && styles.activePlayerRow,
                p.isFinished && styles.finishedPlayerRow,
                isEliminatedFromTiebreaker && { opacity: 0.3 },
              ]}
            >
              <View style={styles.scoreCol}>
                {p.isFinished ? (
                  <Text style={styles.rankText}>{p.rank}</Text>
                ) : (
                  <Text
                    style={[styles.playerScore, isActive && styles.activeText]}
                  >
                    {" "}
                    {p.score}{" "}
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
                          const tObj = p.turnThrows[throwIdx];
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
                                {tObj ? formatThrow(tObj) : ""}
                              </Text>
                            </View>
                          );
                        })}
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
                  )}

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>
                        {t(language, "roundPts")}
                      </Text>
                      <Text
                        style={[
                          styles.statBold,
                          { fontSize: 16, color: theme.colors.primary },
                        ]}
                      >
                        {p.currentRoundScore}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: theme.colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {p.roundDarts || 0} / {state.settings.dartsPerRound} 🎯
                    </Text>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {!isGameOver && (
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
        visible={isGameOver}
        title={`${state.matchWinner?.name || t(language, "player")} ${t(language, "wins")} 🏆`}
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
    turnSumText: {
      fontSize: 12,
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
    typedScoreDisplayBoxActive: { borderColor: theme.colors.primary },
    typedScoreDisplayBoxText: {
      fontSize: 26,
      fontWeight: "900",
      color: theme.colors.textMuted,
    },
    typedScoreDisplayBoxTextActive: { color: theme.colors.primary },
  });
