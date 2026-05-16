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

type RoundTarget = {
  name: string;
  reqValue?: number;
  reqMult?: number;
};

const HALVEIT_ROUNDS: RoundTarget[] = [
  { name: "15", reqValue: 15 },
  { name: "16", reqValue: 16 },
  { name: "DOUBLE", reqMult: 2 },
  { name: "17", reqValue: 17 },
  { name: "18", reqValue: 18 },
  { name: "TREBLE", reqMult: 3 },
  { name: "19", reqValue: 19 },
  { name: "20", reqValue: 20 },
  { name: "BULL", reqValue: 25 },
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
  halves: number;
  isFinished: boolean;
  rank?: number;
  sHits: number;
  dHits: number;
  tHits: number;
  hits: number;
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

const checkHit = (val: number, mult: number, target: RoundTarget) => {
  if (val === 0) return false;
  if (target.reqValue !== undefined && target.reqMult !== undefined) {
    return val === target.reqValue && mult === target.reqMult;
  }
  if (target.reqValue !== undefined) return val === target.reqValue;
  if (target.reqMult !== undefined) return mult === target.reqMult;
  return false;
};

const halveItReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      const roundIdx = Math.floor(player.dartsCount / 3);
      const target = HALVEIT_ROUNDS[roundIdx];

      const isHit = checkHit(value, multiplier, target);

      if (isHit) {
        player.hits += 1;
        if (multiplier === 1) player.sHits += 1;
        else if (multiplier === 2) player.dHits += 1;
        else if (multiplier === 3) player.tHits += 1;
      }
      const pts = isHit ? value * multiplier : 0;

      player.dartsCount += 1;
      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, pts, isHit, coords });
      draft.throwsThisTurn += 1;

      const isTurnOver =
        draft.throwsThisTurn === 3 ||
        player.dartsCount === HALVEIT_ROUNDS.length * 3;

      if (isTurnOver) {
        const turnSum = player.turnThrows.reduce((sum, tr) => sum + tr.pts, 0);

        if (turnSum === 0) {
          player.score = Math.floor(player.score / 2);
          player.halves += 1;
          draft.speechEvent = { text: "Halved", id: Date.now() };
        } else {
          player.score += turnSum;
          draft.speechEvent = { text: turnSum.toString(), id: Date.now() };
        }

        if (player.dartsCount === HALVEIT_ROUNDS.length * 3) {
          player.isFinished = true;
        }

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

export default function HalveIt() {
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
    halveItReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            score: 40,
            dartsCount: 0,
            turnThrows: [],
            halves: 0,
            isFinished: false,
            sHits: 0,
            dHits: 0,
            tHits: 0,
            hits: 0,
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
      const roundIdx = Math.floor(activePlayer.dartsCount / 3);
      const target = HALVEIT_ROUNDS[roundIdx];

      let val = 0;
      let mult = 1;

      if (target.reqValue === 25) {
        const hit = simulateBobsBotThrow(botAvg!, false);
        if (hit) {
          val = 25;
          mult = Math.random() < 0.2 ? 2 : 1;
        }
      } else if (
        target.reqMult !== undefined &&
        target.reqValue === undefined
      ) {
        const aimValue = [20, 19, 18, 16][Math.floor(Math.random() * 4)];
        if (target.reqMult === 2) {
          const hit = simulateBobsBotThrow(botAvg!, false);
          if (hit) {
            val = aimValue;
            mult = 2;
          }
        } else {
          const res = simulateCricketBotThrow(botAvg!, aimValue);
          if (res.hit && res.multiplier === 3) {
            val = aimValue;
            mult = 3;
          } else {
            val = res.missedValue || 0;
            mult = 1;
          }
        }
      } else if (target.reqValue !== undefined) {
        const res = simulateCricketBotThrow(botAvg!, target.reqValue);
        if (res.hit) {
          val = target.reqValue;
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
        mode: "Halve-It",
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
            halves: p.halves,
            sHits: p.sHits,
            dHits: p.dHits,
            tHits: p.tHits,
            hits: p.hits,
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
      console.error("Save Halve-It error", e);
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
          <Text style={styles.headerTitle}>HALVE-IT</Text>
          <Text style={styles.headerSub}>START WITH 40 PTS</Text>
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
          const roundIdx = Math.min(
            Math.floor(p.dartsCount / 3),
            HALVEIT_ROUNDS.length - 1,
          );
          const targetReq = HALVEIT_ROUNDS[roundIdx];

          let targetLabel = targetReq.name;
          if (targetReq.name === "BULL") targetLabel = bullTerm;
          if (targetReq.name === "TREBLE")
            targetLabel = tripleTerm.toUpperCase();
          if (targetReq.name === "DOUBLE")
            targetLabel = t(language, "double")?.toUpperCase() || "DOUBLE";

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
                        name="warning-outline"
                        size={14}
                        color={theme.colors.danger}
                      />
                      <Text
                        style={[
                          styles.statBold,
                          { color: theme.colors.danger },
                        ]}
                      >
                        {p.halves}
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
