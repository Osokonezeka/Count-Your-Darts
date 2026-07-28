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
import { resolveBotAverage } from "../../lib/bot";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../common/AnimatedPrimaryButton";
import { BotAwareKeyboard } from "../common/BotAwareKeyboard";
import { getSharedGameStyles } from "../common/SharedGameStyles";
import { TimerBadge } from "../common/TimerBadge";
import { TrainingKeyboard } from "../keyboards/TrainingKeyboard";
import { FinishModal } from "../modals/FinishModal";

export type HitMissPlayerState = {
  name: string;
  currentTargetIdx: number;
  darts: number;
  hits: number;
  turnThrows: { hit: boolean }[];
  isFinished: boolean;
  rank?: number;
};

export type HitMissGameState = {
  playerStates: HitMissPlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: HitMissGameState[];
  finishedCount: number;
  isUndoing?: boolean;
  speechEvent?: { text: string; id: number } | null;
};

type HitMissAction =
  | { type: "THROW"; payload: { hit: boolean } }
  | { type: "UNDO" };

function createHitMissReducer(targetsLength: number) {
  return produce((draft: HitMissGameState, action: HitMissAction) => {
    switch (action.type) {
      case "THROW": {
        const { hit } = action.payload;

        pushHistorySnapshot(draft, current(draft));

        const player = draft.playerStates[draft.currentIndex];
        draft.speechEvent = {
          text: hit ? "hit" : "miss",
          id: Date.now(),
        };

        player.darts += 1;
        if (hit) player.hits += 1;

        if (!player.turnThrows) player.turnThrows = [];
        player.turnThrows.push({ hit });

        if (hit) {
          if (player.currentTargetIdx === targetsLength - 1) {
            player.isFinished = true;
            player.rank = draft.finishedCount + 1;
          } else {
            player.currentTargetIdx += 1;
          }
        }

        const isTurnOver = draft.throwsThisTurn === 2 || player.isFinished;

        if (isTurnOver) {
          if (player.isFinished) draft.finishedCount += 1;

          const allFinished = draft.playerStates.every((p) => p.isFinished);
          if (allFinished) return;

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

      case "UNDO": {
        const prevState = popHistorySnapshot(draft);
        if (!prevState) return;
        return { ...prevState, speechEvent: null };
      }
    }
  });
}

type BotAverageMode = Parameters<typeof resolveBotAverage>[2];

export interface HitMissTrainerProps<TTarget> {
  targets: TTarget[];
  getTargetLabel: (target: TTarget) => string;
  headerTitle: string;
  headerSub: string;
  historyMode: string;
  botAverageMode: BotAverageMode;

  historicalBaselineMode?: string;
  calculateBotHit: (target: TTarget, botAvg: number) => boolean;
}

export function HitMissTrainer<TTarget>({
  targets,
  getTargetLabel,
  headerTitle,
  headerSub,
  historyMode,
  botAverageMode,
  historicalBaselineMode,
  calculateBotHit,
}: HitMissTrainerProps<TTarget>) {
  const { selectedPlayers } = useGame();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { speak } = useSpeech();
  const { missTerm } = useTerminology();
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

  const reducer = useMemo(
    () => createHitMissReducer(targets.length),
    [targets.length],
  );

  const [state, dispatch] = useReducer(
    reducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: selectedPlayers.map((name) => ({
            name,
            currentTargetIdx: 0,
            darts: 0,
            hits: 0,
            turnThrows: [],
            isFinished: false,
          })),
          currentIndex: 0,
          throwsThisTurn: 0,
          history: [],
          finishedCount: 0,
          speechEvent: null,
        },
  );

  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);
  const { GameAlerts, showExitConfirm } = useGameModals(language);

  useEffect(() => {
    if (state.speechEvent) speak(t(language, state.speechEvent.text));
  }, [state.speechEvent]);

  const allFinished = state.playerStates.every((p) => p.isFinished);
  const { delay } = useBotDelay(state.isUndoing, 1200);
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
          historicalBaselineMode ?? botAverageMode,
        );
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [selectedPlayers, historicalBaselineMode, botAverageMode]);

  const botAvg = resolveBotAverage(
    activePlayer?.name || "",
    state.playerStates,
    botAverageMode,
    undefined,
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded && !allFinished && !state.isUndoing && !!activePlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () =>
      calculateBotHit(targets[activePlayer.currentTargetIdx], botAvg!),
    execute: (hit) => handleThrow(hit),
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (allFinished) {
      triggerHaptic("success");
    }
  }, [allFinished]);

  const saveTrainingStats = async (navigateAway: boolean = true) => {
    const isUnfinished = !allFinished;

    await persistMatchToHistory({
      mode: historyMode,
      players: state.playerStates
        .map((p) => ({
          name: p.name,
          darts: p.darts,
          rank: p.rank,
          accuracy:
            p.darts > 0 ? ((p.hits / p.darts) * 100).toFixed(1) + "%" : "0%",
        }))
        .sort((a, b) => (a.rank || 0) - (b.rank || 0)),
      isUnfinished,
      gameState: { ...state, history: [], savedMatchTime: matchTimeRef.current },
      matchTimeSeconds: matchTimeRef.current,
      navigateAway,
    });
  };

  const hasMatchStarted = state.playerStates.some((p) => p.darts > 0);

  useExitGuard(hasMatchStarted && !allFinished, () => {
    showExitConfirm(() => {
      saveTrainingStats(false).then(confirmExit);
    });
  });

  const handleThrow = (hit: boolean) => {
    if (allFinished) return;
    triggerHaptic(hit ? "tap" : "heavy");
    dispatch({ type: "THROW", payload: { hit } });
  };

  const currentPlayer = state.playerStates[state.currentIndex];

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
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
        <View style={styles.headerRight}>
          <TimerBadge
            initialTime={matchTimeRef.current}
            isRunning={!allFinished}
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
          const target = targets[Math.min(p.currentTargetIdx, targets.length - 1)];

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
                    style={[styles.targetValue, isActive && styles.activeText]}
                  >
                    {getTargetLabel(target)}
                  </Text>
                )}
                <Text style={styles.playerName}>{p.name}</Text>
              </View>

              {!p.isFinished && (
                <>
                  <View style={styles.throwsCol}>
                    <View style={styles.throwsRow}>
                      {[0, 1, 2].map((idx) => {
                        const isHit = p.turnThrows?.[idx]?.hit === true;
                        const isMiss = p.turnThrows?.[idx]?.hit === false;

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
                                isHit && { color: theme.colors.success },
                                isMiss && { color: theme.colors.danger },
                              ]}
                            >
                              {p.turnThrows?.[idx] ? (isHit ? "✔" : "✘") : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.targetLabel}>
                      {t(language, "target")?.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    <View style={styles.statRow}>
                      <Ionicons
                        name="locate-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>{p.darts}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>
                        {t(language, "accuracyShort")}:
                      </Text>
                      <Text style={styles.statBold}>
                        {p.darts > 0
                          ? ((p.hits / p.darts) * 100).toFixed(0)
                          : 0}
                        %
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {!allFinished && (
        <BotAwareKeyboard
          playerName={currentPlayer?.name || ""}
          onUndo={() => dispatch({ type: "UNDO" })}
          theme={theme}
          language={language}
          botStyle={[styles.keyboard, { padding: 16 }]}
        >
          <TrainingKeyboard
            playerName={currentPlayer.name}
            instructionText={(t(language, "hitLower")) + ":"}
            targetValue={getTargetLabel(
              targets[currentPlayer.currentTargetIdx],
            )}
            hitLabel={t(language, "hit")?.toUpperCase()}
            missLabel={missTerm}
            onHit={() => handleThrow(true)}
            onMiss={() => handleThrow(false)}
            onUndo={() => dispatch({ type: "UNDO" })}
            theme={theme}
          />
        </BotAwareKeyboard>
      )}

      <FinishModal
        visible={allFinished}
        title={t(language, "trainingFinished")}
        subtitle={t(language, "trainingSaved")}
        theme={theme}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch")}
            theme={theme}
            onPress={() => saveTrainingStats(true)}
          />
        </View>
      </FinishModal>

      {GameAlerts}
    </SafeAreaView>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    targetValue: {
      fontSize: 36,
      fontWeight: "900",
      color: theme.colors.textMain,
      lineHeight: 40,
    },
    targetLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    keyboard: {
      padding: 16,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 30,
    },
  });
