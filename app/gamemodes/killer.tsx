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

type Throw = {
  value: number;
  multiplier: number;
  coords?: { x: number; y: number };
};

type PlayerState = {
  name: string;
  target: number | null;
  lives: number;
  isKiller: boolean;
  isFinished: boolean;
  rank?: number;
  dartsCount: number;
  turnThrows: Throw[];
};

type GameState = {
  settings: {
    lives: number;
    killerAssignMode: "random" | "throw";
    killerMode: "double" | "treble" | "any";
    killerSelfPenalty: boolean;
  };
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: GameState[];
  matchWinner: PlayerState | null;
  finishedCount: number;
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

const assignRandomTargets = (playerCount: number) => {
  const available = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, playerCount);
};

const killerReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;
      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      player.dartsCount += 1;
      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, coords });
      draft.throwsThisTurn += 1;

      let points = value * multiplier;
      let speechText = points.toString();

      if (player.target === null) {
        if (value > 0 && value <= 25) {
          const isTaken = draft.playerStates.some((p) => p.target === value);
          if (!isTaken) {
            player.target = value;
          }
        }
      } else {
        if (!player.isKiller) {
          if (value === player.target) {
            const becomesKiller =
              draft.settings.killerMode === "any" ||
              (draft.settings.killerMode === "double" && multiplier === 2) ||
              (draft.settings.killerMode === "treble" && multiplier === 3);
            if (becomesKiller) {
              player.isKiller = true;
              speechText = "Killer";
            }
          }
        } else {
          const hitOpponents = draft.playerStates.filter(
            (p) =>
              p.target === value && p.name !== player.name && !p.isFinished,
          );

          if (hitOpponents.length > 0) {
            hitOpponents.forEach((opp) => {
              opp.lives -= multiplier;
              if (opp.lives <= 0) {
                opp.lives = 0;
                opp.isFinished = true;
                draft.finishedCount += 1;
                opp.rank = draft.playerStates.length - draft.finishedCount + 1;
              }
            });
          } else if (
            value === player.target &&
            draft.settings.killerSelfPenalty
          ) {
            player.lives -= multiplier;
            player.isKiller = false;

            if (player.lives <= 0) {
              player.lives = 0;
              player.isFinished = true;
              draft.finishedCount += 1;
              player.rank = draft.playerStates.length - draft.finishedCount + 1;
            }
          }
        }
      }

      draft.speechEvent = { text: speechText, id: Date.now() };

      const alivePlayers = draft.playerStates.filter((p) => !p.isFinished);
      const allHaveTargets = draft.playerStates.every((p) => p.target !== null);

      if (
        alivePlayers.length === 1 &&
        draft.playerStates.length > 1 &&
        allHaveTargets
      ) {
        alivePlayers[0].isFinished = true;
        alivePlayers[0].rank = 1;
        draft.matchWinner = alivePlayers[0];
        return;
      } else if (alivePlayers.length === 0) {
        draft.matchWinner = draft.playerStates[0];
        return;
      }

      const isTurnOver = draft.throwsThisTurn === 3 || player.isFinished;

      if (isTurnOver) {
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

export default function Killer() {
  const { players, settings } = useGame();
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
    killerReducer,
    parsedResume
      ? parsedResume.gameState
      : (() => {
          const isRandom = settings?.killerAssignMode === "random";
          const initialTargets = isRandom
            ? assignRandomTargets(players.length)
            : Array(players.length).fill(null);

          return {
            settings: {
              lives: settings?.lives || 3,
              killerAssignMode: settings?.killerAssignMode || "random",
              killerMode: settings?.killerMode || "double",
              killerSelfPenalty: settings?.killerSelfPenalty || false,
            },
            playerStates: players.map((name, i) => ({
              name,
              target: initialTargets[i],
              lives: settings?.lives || 3,
              isKiller: false,
              isFinished: false,
              dartsCount: 0,
              turnThrows: [],
            })),
            currentIndex: 0,
            throwsThisTurn: 0,
            history: [],
            matchWinner: null,
            finishedCount: 0,
            speechEvent: null,
          };
        })(),
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

  const isGameOver = !!state.matchWinner;
  const { isFastBot, delay } = useBotDelay(state.isUndoing, 1000);
  const activePlayer = state.playerStates[state.currentIndex];

  const currentDelay =
    state.throwsThisTurn === 0 ? delay : isFastBot ? 50 : 350;

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
      isBaselineLoaded && !isGameOver && !state.isUndoing && !!activePlayer,
    botAvg,
    delay: currentDelay,
    historyLength: state.history.length,
    calculate: () => {
      if (activePlayer.target === null) {
        const assigned = state.playerStates
          .map((p) => p.target)
          .filter((t) => t !== null);
        const available = Array.from({ length: 20 }, (_, i) => i + 1).filter(
          (t) => !assigned.includes(t),
        );
        const aim =
          available[Math.floor(Math.random() * available.length)] || 20;
        const res = simulateCricketBotThrow(botAvg!, aim);
        return {
          value: res.hit ? aim : res.missedValue || 0,
          multiplier: res.multiplier,
        };
      }

      if (!activePlayer.isKiller) {
        if (state.settings.killerMode === "any") {
          const res = simulateCricketBotThrow(botAvg!, activePlayer.target);
          return {
            value: res.hit ? activePlayer.target : res.missedValue || 0,
            multiplier: res.multiplier,
          };
        } else if (state.settings.killerMode === "treble") {
          const res = simulateCricketBotThrow(botAvg!, activePlayer.target);
          if (res.hit && res.multiplier === 3)
            return { value: activePlayer.target, multiplier: 3 };
          return {
            value: res.missedValue || 0,
            multiplier: 1,
          };
        } else {
          const hit = simulateBobsBotThrow(botAvg!, activePlayer.target === 25);
          if (hit) return { value: activePlayer.target, multiplier: 2 };
          const res = simulateCricketBotThrow(botAvg!, activePlayer.target);
          return { value: res.missedValue || 0, multiplier: 1 };
        }
      }

      const opponents = state.playerStates.filter(
        (p) =>
          !p.isFinished && p.name !== activePlayer.name && p.target !== null,
      );

      if (opponents.length > 0) {
        const opp = opponents[Math.floor(Math.random() * opponents.length)];
        const aim = opp.target!;

        const tryTrebleFirst = Math.random() < 0.6;
        if (tryTrebleFirst && aim !== 25) {
          const res = simulateCricketBotThrow(botAvg!, aim);
          if (res.hit && res.multiplier === 3)
            return { value: aim, multiplier: 3 };
        }

        const hitDouble = simulateBobsBotThrow(botAvg!, aim === 25);
        if (hitDouble) return { value: aim, multiplier: 2 };

        const res = simulateCricketBotThrow(botAvg!, aim);
        return {
          value: res.hit ? aim : res.missedValue || 0,
          multiplier: res.multiplier,
        };
      }

      return { value: 0, multiplier: 1 };
    },
    execute: (dart) => {
      handleThrow(dart.value, dart.multiplier);
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

  const saveMatchStats = async (navigateAway: boolean = true) => {
    try {
      if (navigateAway) isExiting.current = true;
      const formattedDate = dayjs().format("DD.MM.YYYY, HH:mm");
      const isUnfinished = !isGameOver;
      const historyItem = {
        id: matchId,
        date: formattedDate,
        duration: formatTime(matchTimeRef.current),
        mode: "Killer",
        isUnfinished,
        gameState: isUnfinished
          ? { ...state, history: [], savedMatchTime: matchTimeRef.current }
          : undefined,
        players: state.playerStates
          .map((p) => ({
            name: p.name,
            score: p.lives,
            darts: p.dartsCount,
            rank: p.rank,
            status:
              state.matchWinner?.name === p.name
                ? "WINNER"
                : p.lives <= 0
                  ? "ELIMINATED"
                  : "ALIVE",
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
      console.error("Save Killer error", e);
      if (navigateAway) router.push("/play");
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current || isGameOver) return;
      e.preventDefault();
      const hasStarted = state.playerStates.some((p) => p.dartsCount > 0);
      if (!hasStarted) {
        isExiting.current = true;
        navigation.dispatch(e.data.action);
        return;
      }
      showExitConfirm(() => {
        saveMatchStats(false).then(() => {
          isExiting.current = true;
          navigation.dispatch(e.data.action);
        });
      });
    });
    return unsubscribe;
  }, [navigation, isGameOver, state]);

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
          <Text style={styles.headerTitle}>
            {t(language, "killer")?.toUpperCase() || "KILLER"}
          </Text>
          <Text style={styles.headerSub}>
            {state.settings.killerMode === "double"
              ? t(language, "double")?.toUpperCase() || "DOUBLE"
              : state.settings.killerMode === "treble"
                ? tripleTerm.toUpperCase()
                : t(language, "anyHit")?.toUpperCase() || "ANY HIT"}
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
          const targetLabel = p.target !== null ? p.target : "?";

          let heartDisplay = null;
          if (p.lives > 5) {
            heartDisplay = <Text style={styles.heartText}>❤️ x {p.lives}</Text>;
          } else if (p.lives > 0) {
            heartDisplay = (
              <Text style={styles.heartText}>{"❤️".repeat(p.lives)}</Text>
            );
          } else {
            heartDisplay = <Text style={styles.heartText}>💀</Text>;
          }

          return (
            <View
              key={i}
              style={[
                styles.playerRow,
                isActive && styles.activePlayerRow,
                p.isFinished && styles.finishedPlayerRow,
                p.isKiller &&
                  !p.isFinished && {
                    borderColor: theme.colors.danger,
                    borderWidth: 2,
                  },
              ]}
            >
              <View style={styles.scoreCol}>
                {p.isFinished ? (
                  <Text style={styles.rankText}>{p.rank}</Text>
                ) : (
                  <Text
                    style={[
                      styles.playerScore,
                      isActive && styles.activeText,
                      p.isKiller && { color: theme.colors.danger },
                    ]}
                  >
                    {p.isKiller ? "💀" : targetLabel}
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
                                throwObj && { color: theme.colors.textMain },
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
                      {p.target !== null
                        ? `${t(language, "target")?.toUpperCase() || "TARGET"}: ${p.target}`
                        : `${t(language, "assignNumbers")?.toUpperCase() || "ASSIGN TARGET"}`}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>{heartDisplay}</View>
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
        visible={isGameOver}
        title={`${state.matchWinner?.name || "Player"} wins! 🏆`}
        subtitle={
          t(language, "trainingSaved") ||
          "Your results have been saved to history."
        }
        theme={theme}
        iconBgColor={theme.colors.danger}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch") || "End"}
            theme={theme}
            onPress={() => saveMatchStats(true)}
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
    heartText: {
      fontSize: 16,
      letterSpacing: 2,
    },
  });
