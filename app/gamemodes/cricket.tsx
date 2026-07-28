import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { produce, current } from "immer";
import React, {
  useCallback,
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

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { BotAwareKeyboard } from "../../components/common/BotAwareKeyboard";
import { getSharedGameStyles } from "../../components/common/SharedGameStyles";
import { TimerBadge } from "../../components/common/TimerBadge";
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
  popHistorySnapshot,
  pushHistorySnapshot,
  useMatchLifecycle,
} from "../../hooks/useMatchLifecycle";
import {
  getCricketBotTarget,
  resolveBotAverage,
  simulateCricketBotThrow,
} from "../../lib/bot";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

const TARGETS = [20, 19, 18, 17, 16, 15, 25];
const COLUMN_WIDTH = 105;

type PlayerCricketState = {
  name: string;
  marks: Record<number, number>;
  score: number;
  darts: number;
  totalMarks?: number;
  legs: number;
  sets: number;
  totalMatchDarts?: number;
  totalMatchScore?: number;
  totalMatchMarks?: number;
  totalClosedTargets?: number;
};

type CricketGameState = {
  settings: {
    cricketMode?: string;
    legs?: number;
    sets?: number;
    [key: string]: string | number | boolean | undefined;
  };
  playerStates: PlayerCricketState[];
  currentIndex: number;
  startingPlayerIndex: number;
  throwsThisTurn: number;
  currentTurnThrows: string[];
  history: CricketGameState[];
  matchWinner: PlayerCricketState | null;
  legWinner: PlayerCricketState | null;
  setWinner: PlayerCricketState | null;
  speechEvent?: { text: string; id: number } | null;
  turnPointsAdded?: number;
  isUndoing?: boolean;
};

type Action =
  | {
      type: "ADD_MARK";
      payload: {
        value: number;
        multiplier: number;
        cricketMode: string;
        throwLabel: string;
      };
    }
  | { type: "START_NEXT_LEG" }
  | { type: "UNDO" };

const getMarkSymbol = (count: number) => {
  if (count <= 0) return "";
  if (count === 1) return "/";
  if (count === 2) return "X";
  return "⦻";
};

const cricketReducer = produce((draft: CricketGameState, action: Action) => {
  switch (action.type) {
    case "ADD_MARK": {
      const { value, multiplier, cricketMode, throwLabel } = action.payload;

      pushHistorySnapshot(draft, current(draft));

      const player = draft.playerStates[draft.currentIndex];

      player.darts += 1;
      player.totalMatchDarts = (player.totalMatchDarts || 0) + 1;

      if (!draft.currentTurnThrows) draft.currentTurnThrows = [];
      draft.currentTurnThrows.push(throwLabel);

      let pointsAdded = 0;

      if (TARGETS.includes(value)) {
        player.totalMarks = (player.totalMarks || 0) + multiplier;
        player.totalMatchMarks = (player.totalMatchMarks || 0) + multiplier;

        let hitsLeft = multiplier;
        if (!player.marks) player.marks = {};
        const currentMarks = player.marks[value] || 0;

        if (currentMarks < 3) {
          const toAdd = Math.min(3 - currentMarks, hitsLeft);
          player.marks[value] = currentMarks + toAdd;
          hitsLeft -= toAdd;
          if (player.marks[value] === 3) {
            player.totalClosedTargets = (player.totalClosedTargets || 0) + 1;
          }
        }

        if (hitsLeft > 0 && cricketMode === "standard") {
          const anyoneElseOpen = draft.playerStates.some(
            (p, idx) => idx !== draft.currentIndex && (p.marks[value] || 0) < 3,
          );

          if (anyoneElseOpen) {
            pointsAdded = value * hitsLeft;
            player.score += pointsAdded;
            player.totalMatchScore =
              (player.totalMatchScore || 0) + pointsAdded;
          }
        }
      }

      draft.turnPointsAdded =
        draft.throwsThisTurn === 0
          ? pointsAdded
          : (draft.turnPointsAdded || 0) + pointsAdded;

      const hasClosedAll = TARGETS.every(
        (num) => (player.marks[num] || 0) >= 3,
      );
      const hasHighestScore = draft.playerStates.every(
        (p) => p.score <= player.score,
      );

      const isGameOver =
        hasClosedAll && (cricketMode === "no-score" || hasHighestScore);
      const isTurnOver = draft.throwsThisTurn === 2 || isGameOver;

      if (isTurnOver && draft.turnPointsAdded > 0) {
        draft.speechEvent = {
          text: draft.turnPointsAdded.toString(),
          id: Date.now(),
        };
      } else {
        draft.speechEvent = null;
      }

      if (isGameOver) {
        const targetLegs = draft.settings?.legs || 1;
        const targetSets = draft.settings?.sets || 1;

        player.legs += 1;
        const isSetWin = player.legs === targetLegs;
        const isMatchWin = isSetWin && player.sets + 1 === targetSets;

        if (isMatchWin) {
          player.sets += 1;
          draft.matchWinner = player;
        } else if (isSetWin) {
          player.sets += 1;
          draft.setWinner = player;
        } else {
          draft.legWinner = player;
        }
        return;
      }

      if (draft.throwsThisTurn === 2) {
        draft.currentIndex =
          (draft.currentIndex + 1) % draft.playerStates.length;
        draft.throwsThisTurn = 0;
        draft.currentTurnThrows = [];
        draft.turnPointsAdded = 0;
        return;
      }

      draft.throwsThisTurn += 1;
      return;
    }

    case "START_NEXT_LEG": {
      const isNewSet = draft.setWinner !== null;
      const nextStarter =
        (draft.startingPlayerIndex + 1) % draft.playerStates.length;

      draft.playerStates.forEach((p) => {
        p.marks = {};
        p.score = 0;
        p.darts = 0;
        p.totalMarks = 0;
        if (isNewSet) p.legs = 0;
      });

      draft.currentIndex = nextStarter;
      draft.startingPlayerIndex = nextStarter;
      draft.throwsThisTurn = 0;
      draft.currentTurnThrows = [];
      draft.legWinner = null;
      draft.setWinner = null;
      draft.matchWinner = null;
      draft.speechEvent = null;
      draft.turnPointsAdded = 0;
      draft.isUndoing = false;
      return;
    }

    case "UNDO": {
      const prevState = popHistorySnapshot(draft);
      if (!prevState) return;
      return { ...prevState, speechEvent: null };
    }
  }
});

export default function Cricket() {
  const { selectedPlayers, settings } = useGame();
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
    cricketReducer,
    parsedResume
      ? parsedResume.gameState
      : {
          settings: parsedResume?.gameState?.settings ||
            parsedResume?.settings || {
              cricketMode: settings?.cricketMode || "standard",
              legs: settings?.legs || 1,
              sets: settings?.sets || 1,
            },
          playerStates: (selectedPlayers || []).map((name) => ({
            name,
            marks: {},
            score: 0,
            darts: 0,
            totalMarks: 0,
            legs: 0,
            sets: 0,
            totalMatchDarts: 0,
            totalMatchScore: 0,
            totalMatchMarks: 0,
            totalClosedTargets: 0,
          })),
          currentIndex: 0,
          startingPlayerIndex: 0,
          throwsThisTurn: 0,
          currentTurnThrows: [],
          history: [],
          matchWinner: null,
          legWinner: null,
          setWinner: null,
          speechEvent: null,
          turnPointsAdded: 0,
        },
  );

  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const [countdown, setCountdown] = useState(3);

  const isSingleLegMatch =
    (state.settings?.legs || 1) === 1 && (state.settings?.sets || 1) === 1;
  const { isFastBot, delay } = useBotDelay(state.isUndoing, 1200);

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
          "Cricket",
        );
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [selectedPlayers]);

  useEffect(() => {
    if (state.legWinner || state.setWinner) {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown((prev: number) => {
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

  const { GameAlerts, showExitConfirm } = useGameModals(language);
  const activePlayer = state.playerStates[state.currentIndex];

  const botAvg = resolveBotAverage(
    activePlayer?.name || "",
    state.playerStates,
    "Cricket",
    state.settings,
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded &&
      !state.matchWinner &&
      !state.legWinner &&
      !state.setWinner &&
      !state.isUndoing &&
      !!activePlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      const botMarks = activePlayer.marks;
      const botScore = activePlayer.score;

      let bestOpponentScore = -1;
      let opponentMarks: Record<number, number> = {};

      state.playerStates.forEach((p) => {
        if (p.name !== activePlayer.name) {
          if (p.score >= bestOpponentScore) {
            bestOpponentScore = p.score;
            opponentMarks = p.marks;
          }
        }
      });

      const target = getCricketBotTarget(
        botAvg!,
        botMarks,
        opponentMarks,
        botScore,
        Math.max(0, bestOpponentScore),
        currentMode,
      );

      return { target, ...simulateCricketBotThrow(botAvg!, target) };
    },
    execute: ({ target, hit, multiplier, missedValue }) => {
      if (hit) {
        handleThrow(target, target === 25 && multiplier === 3 ? 2 : multiplier);
      } else {
        handleThrow(missedValue || 0, 1);
      }
    },
  });

  useEffect(() => {
    if (state.speechEvent) {
      speak(t(language, state.speechEvent.text));
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
    if (state.matchWinner) {
      triggerHaptic("success");
    }
  }, [state.matchWinner]);

  const hasMatchStarted = state.playerStates.some((p) => p.darts > 0);

  useExitGuard(hasMatchStarted || !!state.matchWinner, () => {
    if (state.matchWinner) {
      saveCricketHistory(false).then(confirmExit);
      return;
    }

    showExitConfirm(() => {
      saveCricketHistory(false).then(confirmExit);
    });
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const saveCricketHistory = async (navigateAway: boolean = true) => {
    const isUnfinished = !state.matchWinner;

    const mappedPlayers = state.playerStates.map((p) => {
      const closedCount =
        p.totalClosedTargets !== undefined
          ? p.totalClosedTargets
          : TARGETS.reduce(
              (acc, t) => acc + ((p.marks[t] || 0) >= 3 ? 1 : 0),
              0,
            );
      return {
        name: p.name,
        score: p.totalMatchScore !== undefined ? p.totalMatchScore : p.score,
        darts: p.totalMatchDarts !== undefined ? p.totalMatchDarts : p.darts,
        marks: p.marks,
        totalMarks:
          p.totalMatchMarks !== undefined
            ? p.totalMatchMarks
            : p.totalMarks || 0,
        closedTargets: closedCount,
        totalClosedTargets: closedCount,
        legs: p.legs,
        sets: p.sets,
        rank: 0,
      };
    });

    mappedPlayers.sort((a, b) => {
      if (a.name === state.matchWinner?.name) return -1;
      if (b.name === state.matchWinner?.name) return 1;
      return (
        (b.sets || 0) - (a.sets || 0) ||
        (b.legs || 0) - (a.legs || 0) ||
        (b.score || 0) - (a.score || 0)
      );
    });

    mappedPlayers.forEach((p, idx) => (p.rank = idx + 1));

    await persistMatchToHistory({
      mode: "Cricket",
      settings: {
        cricketMode: currentMode,
        legs: state.settings?.legs || 1,
        sets: state.settings?.sets || 1,
      },
      players: mappedPlayers,
      isUnfinished,
      gameState: { ...state, history: [], savedMatchTime: matchTimeRef.current },
      matchTimeSeconds: matchTimeRef.current,
      navigateAway,
    });
  };

  const handleThrow = (value: number, overrideMultiplier?: number) => {
    if (state.matchWinner || state.legWinner || state.setWinner) return;
    const activeMult = overrideMultiplier || multiplier;
    if ((value === 25 && activeMult === 3) || (value === 0 && activeMult !== 1))
      return;

    triggerHaptic("tap");

    let throwLabel = value === 0 ? "0" : value.toString();
    if (value === 25) throwLabel = activeMult === 2 ? "D25" : "25";
    else if (activeMult === 2) throwLabel = `D${value}`;
    else if (activeMult === 3) throwLabel = `T${value}`;

    dispatch({
      type: "ADD_MARK",
      payload: {
        value,
        multiplier: activeMult,
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
    setMultiplier(1);
    dispatch({ type: "UNDO" });
  };

  const isModalVisible =
    !!state.matchWinner || !!state.setWinner || !!state.legWinner;
  const winnerName =
    state.matchWinner?.name ||
    state.setWinner?.name ||
    state.legWinner?.name ||
    "";

  let modalTitle = "";
  let timerText = "";

  if (state.matchWinner) {
    modalTitle = isSingleLegMatch
      ? (
          t(language, "playerFinished")
        ).replace("{{name}}", winnerName)
      : (t(language, "matchWinner")).replace(
          "{{name}}",
          winnerName,
        );
  } else if (state.setWinner) {
    modalTitle = (t(language, "setWon"))
      .replace("{{name}}", winnerName)
      .replace("{{x}}", (state.setWinner.sets || 1).toString());
    timerText = t(language, "autoNextSet");
  } else if (state.legWinner) {
    modalTitle = (t(language, "legWon"))
      .replace("{{name}}", winnerName)
      .replace("{{x}}", (state.legWinner.legs || 1).toString());
    timerText = t(language, "autoNextLeg");
  }

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
            {t(language, "cricket")?.toUpperCase()}
          </Text>
          <Text style={styles.headerSub}>
            {currentMode === "standard"
              ? t(language, "withScore")?.toUpperCase()
              : t(language, "withoutScore")?.toUpperCase()}
          </Text>
          {!isSingleLegMatch && (
            <Text style={styles.headerSubInfo}>
              {t(language, "firstTo")?.toUpperCase()}{" "}
              {state.settings?.legs || 1} L / {state.settings?.sets || 1} S
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TimerBadge
            initialTime={matchTimeRef.current}
            isRunning={!state.matchWinner}
            onTimeUpdate={handleTimeUpdate}
            theme={theme}
            styles={styles}
          />
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
                  {!isSingleLegMatch && (
                    <Text style={styles.playerLegsSets}>
                      L:{p.legs} S:{p.sets}
                    </Text>
                  )}
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
                {t(language, "turn")}:
              </Text>
              <Text style={styles.infoActivePlayer}>{activePlayer?.name}</Text>
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

      <BotAwareKeyboard
        playerName={activePlayer?.name || ""}
        onUndo={handleUndo}
        theme={theme}
        language={language}
        style={styles.keyboard}
      >
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
              {t(language, "double")}
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
      </BotAwareKeyboard>

      <FinishModal visible={isModalVisible} title={modalTitle} theme={theme}>
        {!!timerText && !state.matchWinner && (
          <Text style={styles.modalTimer}>
            {timerText} <Text style={styles.modalTimerValue}>{countdown}s</Text>
          </Text>
        )}
        <View style={styles.modalActionsCol}>
          {state.matchWinner ? (
            <AnimatedPrimaryButton
              title={t(language, "endMatch")}
              theme={theme}
              onPress={() => saveCricketHistory(true)}
            />
          ) : (
            <AnimatedPrimaryButton
              title={t(language, "continue")}
              theme={theme}
              onPress={() => dispatch({ type: "START_NEXT_LEG" })}
            />
          )}
          <AnimatedPrimaryButton
            title={t(language, "undoThrow")}
            theme={theme}
            color={theme.colors.background}
            textColor={theme.colors.textMuted}
            onPress={handleUndo}
          />
        </View>
      </FinishModal>

      {GameAlerts}
    </SafeAreaView>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    headerSubInfo: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    boardWrapper: {
      flex: 1,
      flexDirection: "row",
      marginTop: 4,
    },
    targetsCol: {
      width: 56,
      backgroundColor: theme.colors.cardBorder,
      paddingVertical: 16,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      alignItems: "center",
      justifyContent: "space-between",
      elevation: 2,
    },
    emptyCorner: {
      flex: 1.2,
      maxHeight: 56,
      minHeight: 40,
      width: "100%",
    },
    targetCell: {
      width: 46,
      maxHeight: 46,
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
      paddingVertical: 4,
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
      flex: 1.2,
      maxHeight: 56,
      minHeight: 40,
      width: "100%",
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
    playerLegsSets: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },

    markCell: {
      width: 46,
      flex: 1,
      maxHeight: 46,
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
      flex: 1,
      maxHeight: 46,
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
  });
