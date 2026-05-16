import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
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
import {
  resolveBotAverage,
  simulateBobsBotThrow,
  simulateCricketBotThrow,
} from "../../lib/bot";
import { formatTime } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

export const JDC_SEQUENCE = [
  ...[10, 11, 12, 13, 14, 15].flatMap((t) => Array(3).fill({ target: t })),
  ...Array.from({ length: 20 }, (_, i) => ({
    target: i + 1,
    reqMult: 2,
    points: 50,
  })),
  { target: 25, reqMult: 2, points: 50 },
  ...[15, 16, 17, 18, 19, 20].flatMap((t) => Array(3).fill({ target: t })),
];

type Throw = {
  value: number;
  multiplier: number;
  pts: number;
  isHit: boolean;
  coords?: { x: number; y: number };
};

type PlayerState = {
  name: string;
  score: number;
  dartsCount: number;
  turnThrows: Throw[];
  isFinished: boolean;
  rank?: number;
  phase1: number;
  phase2: number;
  phase3: number;
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
  | { type: "UNDO" }
  | { type: "RESET_CURRENT_TURN" };

const jdcReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      const dartReq = JDC_SEQUENCE[player.dartsCount];

      let pts = 0;
      let isHit = false;

      if (value === dartReq.target) {
        if (dartReq.reqMult) {
          if (multiplier === dartReq.reqMult) {
            pts = dartReq.points || 0;
            isHit = true;
          }
        } else {
          pts = value * multiplier;
          isHit = true;
        }
      }

      if (player.dartsCount < 18) player.phase1 += pts;
      else if (player.dartsCount < 39) player.phase2 += pts;
      else player.phase3 += pts;

      player.score += pts;
      player.dartsCount += 1;

      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, pts, isHit, coords });
      draft.throwsThisTurn += 1;

      const isTurnOver =
        draft.throwsThisTurn === 3 || player.dartsCount === JDC_SEQUENCE.length;

      if (isTurnOver) {
        if (player.dartsCount === JDC_SEQUENCE.length) {
          player.isFinished = true;
        }

        const turnSum = player.turnThrows.reduce((sum, tr) => sum + tr.pts, 0);
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

const formatThrow = (t: Throw) => {
  if (t.value === 0) return "0";
  if (t.value === 25) return t.multiplier === 2 ? "D25" : "25";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};

export default function JDCChallenge() {
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
    jdcReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            score: 0,
            dartsCount: 0,
            turnThrows: [],
            isFinished: false,
            phase1: 0,
            phase2: 0,
            phase3: 0,
          })),
          currentIndex: 0,
          throwsThisTurn: 0,
          history: [],
          speechEvent: null,
        },
  );

  const [inputMode, setInputMode] = useState<"dart" | "board">("dart");
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );

  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const { GameAlerts, showExitConfirm } = useGameModals(language);

  useEffect(() => {
    if (state.speechEvent) speak(state.speechEvent.text);
  }, [state.speechEvent]);

  const allDone = state.playerStates.every((p) => p.isFinished);
  const { delay } = useBotDelay(state.isUndoing, 1000);
  const activePlayer = state.playerStates[state.currentIndex];

  const [historicalBaseline, setHistoricalBaseline] = useState<
    number | undefined
  >(undefined);
  const [isBaselineLoaded, setIsBaselineLoaded] = useState(false);
  useEffect(() => {
    const fetchBaseline = async () => {
      if (players) {
        const humanNames = players.filter((p: string) => !isBot(p));
        const baseline = await getPlayersHistoricalBaseline(humanNames, "X01");
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [players]);

  const botAvg = resolveBotAverage(
    activePlayer?.name || "",
    state.playerStates,
    "X01",
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
      const dartReq = JDC_SEQUENCE[activePlayer.dartsCount];
      const isDoubleReq = dartReq.reqMult === 2;
      const isBull = dartReq.target === 25;

      let val = 0;
      let mult = 1;

      if (isDoubleReq) {
        const hit = simulateBobsBotThrow(botAvg!, isBull);
        if (hit) {
          val = dartReq.target;
          mult = 2;
        }
      } else {
        const res = simulateCricketBotThrow(botAvg!, dartReq.target);
        if (res.hit) {
          val = dartReq.target;
          mult = res.multiplier;
        } else {
          val = res.missedValue || 0;
        }
      }
      return { value: val, multiplier: mult };
    },
    execute: (dart) => {
      handleThrow(dart.value, dart.multiplier);
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
    try {
      if (navigateAway) isExiting.current = true;
      const formattedDate = dayjs().format("DD.MM.YYYY, HH:mm");
      const isUnfinished = !allDone;
      const historyItem = {
        id: matchId,
        date: formattedDate,
        duration: formatTime(matchTimeRef.current),
        mode: "JDC Challenge",
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTimeRef.current }
          : undefined,
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            score: p.score,
            darts: p.dartsCount,
            rank: p.rank,
            phase1: p.phase1,
            phase2: p.phase2,
            phase3: p.phase3,
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
      if (existingIndex > -1) existingHistory[existingIndex] = historyItem;
      else existingHistory.unshift(historyItem);

      await AsyncStorage.setItem(
        "@dart_match_history",
        JSON.stringify(existingHistory),
      );
      if (navigateAway) router.push("/play");
    } catch (e) {
      console.error("Save JDC error", e);
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
  }, [navigation, allDone, state]);

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
    setMultiplier(1);
    dispatch({ type: "UNDO" });
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
          <Text style={styles.headerTitle}>JDC CHALLENGE</Text>
          <Text style={styles.headerSub}>57 DARTS ROUTINE</Text>
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
          const targetReq =
            JDC_SEQUENCE[p.dartsCount] || JDC_SEQUENCE[JDC_SEQUENCE.length - 1];
          const isDouble = targetReq.reqMult === 2;
          const targetLabel = isDouble
            ? `D${targetReq.target === 25 ? bullTerm : targetReq.target}`
            : `${targetReq.target === 25 ? bullTerm : targetReq.target}`;

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
                        const throwObj = p.turnThrows?.[idx];
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
                                throwObj?.isHit && {
                                  color: theme.colors.success,
                                },
                                throwObj &&
                                  !throwObj.isHit && {
                                    color: theme.colors.textMuted,
                                  },
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {throwObj ? formatThrow(throwObj) : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.targetLabel}>
                      {t(language, "target")?.toUpperCase() || "TARGET"}:{" "}
                      <Text style={{ color: theme.colors.textMain }}>
                        {targetLabel}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Ionicons
                        name="locate-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>{p.dartsCount}</Text>
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
            setInputMode={(mode) => {
              if (mode === "score") return;
              setInputMode(mode as "dart" | "board");
            }}
            theme={theme}
            language={language}
            onReset={() => {
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
  });
