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
import { resolveBotAverage, simulateCricketBotThrow } from "../../lib/bot";
import { formatTime } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

const TARGETS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
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
  shanghais: number;
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

const shanghaiReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;

      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      const target = TARGETS[Math.floor(player.dartsCount / 3)];

      const isHit = value === target;

      if (isHit) {
        player.hits += 1;
        if (multiplier === 1) player.sHits += 1;
        else if (multiplier === 2) player.dHits += 1;
        else if (multiplier === 3) player.tHits += 1;
      }
      const pts = isHit ? value * multiplier : 0;

      player.score += pts;
      player.dartsCount += 1;

      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, pts, isHit, coords });
      draft.throwsThisTurn += 1;

      const isTurnOver =
        draft.throwsThisTurn === 3 || player.dartsCount === TARGETS.length * 3;

      if (isTurnOver) {
        const hasS = player.turnThrows.some(
          (t) => t.value === target && t.multiplier === 1 && t.isHit,
        );
        const hasD = player.turnThrows.some(
          (t) => t.value === target && t.multiplier === 2 && t.isHit,
        );
        const hasT = player.turnThrows.some(
          (t) => t.value === target && t.multiplier === 3 && t.isHit,
        );

        if (hasS && hasD && hasT) {
          player.shanghais += 1;
          draft.speechEvent = { text: "Shanghai!", id: Date.now() };

          draft.playerStates.forEach((p) => (p.isFinished = true));
        } else {
          const turnSum = player.turnThrows.reduce(
            (sum, tr) => sum + tr.pts,
            0,
          );
          draft.speechEvent = { text: turnSum.toString(), id: Date.now() };
        }

        if (player.dartsCount >= TARGETS.length * 3) {
          player.isFinished = true;
        }

        const allDone = draft.playerStates.every((p) => p.isFinished);
        if (allDone) {
          const finishers = draft.playerStates
            .map((p, idx) => ({ ...p, originalIdx: idx }))
            .sort((a, b) => {
              if (a.shanghais !== b.shanghais) return b.shanghais - a.shanghais;
              return b.score - a.score;
            });
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

export default function Shanghai() {
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
    shanghaiReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: players.map((name) => ({
            name,
            score: 0,
            dartsCount: 0,
            turnThrows: [],
            shanghais: 0,
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
      const target = TARGETS[Math.floor(activePlayer.dartsCount / 3)];
      const res = simulateCricketBotThrow(botAvg!, target);
      return {
        value: res.hit ? target : res.missedValue || 0,
        multiplier: res.multiplier,
      };
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
        mode: "Shanghai",
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
            shanghais: p.shanghais,
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
      console.error("Save Shanghai error", e);
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

  const isInstantWin = state.playerStates.some((p) => p.shanghais > 0);

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
          <Text style={styles.headerTitle}>SHANGHAI</Text>
          <Text style={styles.headerSub}>1 ➔ 20</Text>
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
            TARGETS[Math.min(Math.floor(p.dartsCount / 3), TARGETS.length - 1)];
          const hasS = p.turnThrows?.some(
            (t) => t.value === targetReq && t.multiplier === 1 && t.isHit,
          );
          const hasD = p.turnThrows?.some(
            (t) => t.value === targetReq && t.multiplier === 2 && t.isHit,
          );
          const hasT = p.turnThrows?.some(
            (t) => t.value === targetReq && t.multiplier === 3 && t.isHit,
          );

          return (
            <View
              key={i}
              style={[
                styles.playerRow,
                isActive && styles.activePlayerRow,
                p.isFinished && styles.finishedPlayerRow,
                p.shanghais > 0 && {
                  borderColor: theme.colors.warning,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.scoreCol}>
                {p.isFinished ? (
                  <Text
                    style={[
                      styles.rankText,
                      p.shanghais > 0 && { color: theme.colors.warning },
                    ]}
                  >
                    {p.shanghais > 0 ? "🏆" : p.rank}
                  </Text>
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
                        {targetReq}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Text
                        style={[
                          styles.statBold,
                          {
                            fontSize: 13,
                            color: hasS
                              ? theme.colors.success
                              : theme.colors.textMuted,
                          },
                        ]}
                      >
                        S
                      </Text>
                      <Text
                        style={[
                          styles.statBold,
                          {
                            fontSize: 13,
                            color: hasD
                              ? theme.colors.success
                              : theme.colors.textMuted,
                          },
                        ]}
                      >
                        D
                      </Text>
                      <Text
                        style={[
                          styles.statBold,
                          {
                            fontSize: 13,
                            color: hasT
                              ? theme.colors.success
                              : theme.colors.textMuted,
                          },
                        ]}
                      >
                        T
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {p.isFinished && p.shanghais === 0 && (
                <View
                  style={[
                    styles.statsCol,
                    {
                      justifyContent: "center",
                      alignItems: "flex-end",
                      flex: 1,
                    },
                  ]}
                >
                  <Text style={[styles.playerScore, { fontSize: 24 }]}>
                    {p.score}
                  </Text>
                </View>
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
        title={
          isInstantWin
            ? "SHANGHAI! 🏆"
            : t(language, "trainingFinished") || "Training Finished!"
        }
        subtitle={
          t(language, "trainingSaved") ||
          "Your results have been saved to history."
        }
        theme={theme}
        iconBgColor={isInstantWin ? theme.colors.warning : theme.colors.primary}
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
