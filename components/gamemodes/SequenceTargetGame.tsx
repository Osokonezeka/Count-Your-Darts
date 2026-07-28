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
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedPressable } from "../common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../common/AnimatedPrimaryButton";
import { BotAwareKeyboard } from "../common/BotAwareKeyboard";
import { getSharedGameStyles } from "../common/SharedGameStyles";
import { TimerBadge } from "../common/TimerBadge";
import { DartKeyboard } from "../keyboards/DartKeyboard";
import { InputModeSelector } from "../keyboards/InputModeSelector";
import { InteractiveDartboard } from "../keyboards/InteractiveDartboard";
import { FinishModal } from "../modals/FinishModal";
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
import { formatThrow } from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";


export type RoundTarget = {
  name: string;
  reqValue?: number;
  reqMult?: number;
  points?: number;
};

export type SequenceThrow = {
  value: number;
  multiplier: number;
  pts: number;
  isHit: boolean;
  coords?: { x: number; y: number };
};

export type SequencePlayerState<
  Extra extends Record<string, number> = Record<string, never>,
> = {
  name: string;
  score: number;
  dartsCount: number;
  turnThrows: SequenceThrow[];
  halves: number;
  isFinished: boolean;
  rank?: number;
} & Extra;

export type SequenceGameState<
  Extra extends Record<string, number> = Record<string, never>,
> = {
  playerStates: SequencePlayerState<Extra>[];
  currentIndex: number;
  throwsThisTurn: number;
  history: SequenceGameState<Extra>[];
  speechEvent?: { text: string; id: number } | null;
  isUndoing?: boolean;
};

type SequenceAction =
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

export const checkSequenceHit = (
  val: number,
  mult: number,
  target: RoundTarget,
) => {
  if (val === 0) return false;
  if (target.reqValue !== undefined && target.reqMult !== undefined) {
    return val === target.reqValue && mult === target.reqMult;
  }
  if (target.reqValue !== undefined) return val === target.reqValue;
  if (target.reqMult !== undefined) return mult === target.reqMult;
  return false;
};

export const formatSequenceThrow = (throwObj: SequenceThrow) =>
  formatThrow(throwObj);

type InternalPlayerState = {
  name: string;
  score: number;
  dartsCount: number;
  turnThrows: SequenceThrow[];
  halves: number;
  isFinished: boolean;
  rank?: number;
  [extraKey: string]: unknown;
};

type InternalGameState = {
  playerStates: InternalPlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: InternalGameState[];
  speechEvent?: { text: string; id: number } | null;
  isUndoing?: boolean;
};

export type SequenceRoundEndResult = {
  overrideSpeech?: string;
  finishAll?: boolean;
} | void;

type SequenceReducerConfig<Extra extends Record<string, number>> = {
  rounds: RoundTarget[];
  totalDarts: number;
  resolveTarget: (dartsCount: number) => RoundTarget;
  calculatePoints: (
    value: number,
    multiplier: number,
    target: RoundTarget,
    isHit: boolean,
  ) => number;
  disableHalving?: boolean;
  onHit?: (
    player: SequencePlayerState<Extra>,
    value: number,
    multiplier: number,
  ) => void;
  onDart?: (
    player: SequencePlayerState<Extra>,
    value: number,
    multiplier: number,
    pts: number,
    isHit: boolean,
  ) => void;
  onZeroScoreTurn?: (player: SequencePlayerState<Extra>) => void;
  onRoundEnd?: (
    player: SequencePlayerState<Extra>,
    turnThrows: SequenceThrow[],
    turnSum: number,
    allPlayers: SequencePlayerState<Extra>[],
  ) => SequenceRoundEndResult;
  rankComparator?: (
    a: SequencePlayerState<Extra>,
    b: SequencePlayerState<Extra>,
  ) => number;
};

function createSequenceReducer<Extra extends Record<string, number>>({
  totalDarts,
  resolveTarget,
  calculatePoints,
  disableHalving,
  onHit,
  onDart,
  onZeroScoreTurn,
  onRoundEnd,
  rankComparator,
}: SequenceReducerConfig<Extra>): (
  state: SequenceGameState<Extra>,
  action: SequenceAction,
) => SequenceGameState<Extra> {
  const untypedReducer = produce(
    (draft: InternalGameState, action: SequenceAction) => {
      switch (action.type) {
        case "ADD_THROW": {
          const { value, multiplier, coords } = action.payload;

          pushHistorySnapshot(draft, current(draft));

          const player = draft.playerStates[draft.currentIndex];
          const target = resolveTarget(player.dartsCount);

          const isHit = checkSequenceHit(value, multiplier, target);
          if (isHit)
            onHit?.(player as SequencePlayerState<Extra>, value, multiplier);
          const pts = calculatePoints(value, multiplier, target, isHit);
          onDart?.(
            player as SequencePlayerState<Extra>,
            value,
            multiplier,
            pts,
            isHit,
          );

          player.dartsCount += 1;
          if (!player.turnThrows) player.turnThrows = [];
          player.turnThrows.push({ value, multiplier, pts, isHit, coords });
          draft.throwsThisTurn += 1;

          const isTurnOver =
            draft.throwsThisTurn === 3 || player.dartsCount === totalDarts;

          if (isTurnOver) {
            const turnSum = player.turnThrows.reduce(
              (sum, tr) => sum + tr.pts,
              0,
            );

            if (!disableHalving && turnSum === 0) {
              player.score = Math.floor(player.score / 2);
              player.halves += 1;
              draft.speechEvent = { text: "speechHalved", id: Date.now() };
            } else {
              player.score += turnSum;
              draft.speechEvent = { text: turnSum.toString(), id: Date.now() };
              if (turnSum === 0)
                onZeroScoreTurn?.(player as SequencePlayerState<Extra>);
            }

            const roundResult = onRoundEnd?.(
              player as SequencePlayerState<Extra>,
              player.turnThrows as SequenceThrow[],
              turnSum,
              draft.playerStates as SequencePlayerState<Extra>[],
            );
            if (roundResult?.overrideSpeech !== undefined) {
              draft.speechEvent = {
                text: roundResult.overrideSpeech,
                id: Date.now(),
              };
            }
            if (roundResult?.finishAll) {
              draft.playerStates.forEach((p) => (p.isFinished = true));
            }

            if (player.dartsCount === totalDarts) {
              player.isFinished = true;
            }

            const allDone = draft.playerStates.every((p) => p.isFinished);
            if (allDone) {
              const finishers = draft.playerStates
                .map((p, idx) => ({ ...p, originalIdx: idx }))
                .sort(
                  (rankComparator as (a: InternalPlayerState, b: InternalPlayerState) => number) ??
                    ((a, b) => (b.score as number) - (a.score as number)),
                );
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
          const prevState = popHistorySnapshot(draft);
          if (!prevState) return;
          let restoredPlayers = prevState.playerStates;
          if (prevState.throwsThisTurn === 0) {
            restoredPlayers = restoredPlayers.map((p, idx) =>
              idx === prevState.currentIndex ? { ...p, turnThrows: [] } : p,
            );
          }
          return {
            ...prevState,
            playerStates: restoredPlayers,
            speechEvent: null,
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
    },
  );

  return untypedReducer as unknown as (
    state: SequenceGameState<Extra>,
    action: SequenceAction,
  ) => SequenceGameState<Extra>;
}

const getTargetLabel = (
  target: RoundTarget,
  terms: { bullTerm: string; tripleTerm: string; language: Parameters<typeof t>[0] },
) => {
  const { bullTerm, tripleTerm, language } = terms;
  if (target.name === "BULL") return bullTerm;
  if (target.name === "D-BULL") return `D${bullTerm}`;
  if (target.name === "TREBLE") return tripleTerm.toUpperCase();
  if (target.name === "DOUBLE")
    return t(language, "double")?.toUpperCase();
  return target.name;
};

export interface SequenceTargetGameProps<
  Extra extends Record<string, number> = Record<string, never>,
> {
  rounds: RoundTarget[];
  initialScore: number;
  headerTitle: string;
  headerSub: string;
  historyMode: string;
  createExtraState?: () => Extra;
  onHit?: (
    player: SequencePlayerState<Extra>,
    value: number,
    multiplier: number,
  ) => void;
  mapHistoryExtra?: (player: SequencePlayerState<Extra>) => Record<string, unknown>;
  calculateBotThrow: (
    target: RoundTarget,
    botAvg: number,
  ) => { value: number; multiplier: number };

  totalDarts?: number;
  resolveTarget?: (dartsCount: number) => RoundTarget;
  calculatePoints?: (
    value: number,
    multiplier: number,
    target: RoundTarget,
    isHit: boolean,
  ) => number;
  onDart?: (
    player: SequencePlayerState<Extra>,
    value: number,
    multiplier: number,
    pts: number,
    isHit: boolean,
  ) => void;
  disableHalving?: boolean;
  onZeroScoreTurn?: (player: SequencePlayerState<Extra>) => void;
  onRoundEnd?: (
    player: SequencePlayerState<Extra>,
    turnThrows: SequenceThrow[],
    turnSum: number,
    allPlayers: SequencePlayerState<Extra>[],
  ) => SequenceRoundEndResult;
  rankComparator?: (
    a: SequencePlayerState<Extra>,
    b: SequencePlayerState<Extra>,
  ) => number;

  getTargetPrefix?: (roundIndex: number, totalRounds: number) => string;
  renderStatsCol?: (
    player: SequencePlayerState<Extra>,
    ctx: { isActive: boolean; targetReq: RoundTarget },
  ) => React.ReactNode;
  getRowExtraStyle?: (
    player: SequencePlayerState<Extra>,
  ) => StyleProp<ViewStyle>;
  renderRank?: (player: SequencePlayerState<Extra>) => React.ReactNode;
  renderRowExtra?: (player: SequencePlayerState<Extra>) => React.ReactNode;
  getFinishTitle?: (
    playerStates: SequencePlayerState<Extra>[],
    defaultTitle: string,
  ) => string;
  getFinishIconBgColor?: (
    playerStates: SequencePlayerState<Extra>[],
  ) => string | undefined;
}

export function SequenceTargetGame<
  Extra extends Record<string, number> = Record<string, never>,
>({
  rounds,
  initialScore,
  headerTitle,
  headerSub,
  historyMode,
  createExtraState,
  onHit,
  mapHistoryExtra,
  calculateBotThrow,
  totalDarts: totalDartsProp,
  resolveTarget: resolveTargetProp,
  calculatePoints: calculatePointsProp,
  onDart,
  disableHalving,
  onZeroScoreTurn,
  onRoundEnd,
  rankComparator,
  getTargetPrefix,
  renderStatsCol,
  getRowExtraStyle,
  renderRank,
  renderRowExtra,
  getFinishTitle,
  getFinishIconBgColor,
}: SequenceTargetGameProps<Extra>) {
  const totalDarts = totalDartsProp ?? rounds.length * 3;
  const resolveTarget = useCallback(
    (dartsCount: number) =>
      resolveTargetProp
        ? resolveTargetProp(dartsCount)
        : rounds[Math.floor(dartsCount / 3)],
    [resolveTargetProp, rounds],
  );
  const calculatePoints = useCallback(
    (
      value: number,
      multiplier: number,
      target: RoundTarget,
      isHit: boolean,
    ) =>
      calculatePointsProp
        ? calculatePointsProp(value, multiplier, target, isHit)
        : isHit
          ? value * multiplier
          : 0,
    [calculatePointsProp],
  );
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

  const reducer = useMemo(
    () =>
      createSequenceReducer<Extra>({
        rounds,
        totalDarts,
        resolveTarget,
        calculatePoints,
        disableHalving,
        onHit,
        onDart,
        onZeroScoreTurn,
        onRoundEnd,
        rankComparator,
      }),
    [
      rounds,
      totalDarts,
      resolveTarget,
      calculatePoints,
      disableHalving,
      onHit,
      onDart,
      onZeroScoreTurn,
      onRoundEnd,
      rankComparator,
    ],
  );

  const [state, dispatch] = useReducer(
    reducer,
    parsedResume
      ? parsedResume.gameState
      : {
          playerStates: selectedPlayers.map((name) => ({
            name,
            score: initialScore,
            dartsCount: 0,
            turnThrows: [],
            halves: 0,
            isFinished: false,
            ...(createExtraState ? createExtraState() : ({} as Extra)),
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
    if (state.speechEvent) speak(t(language, state.speechEvent.text));
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
      if (selectedPlayers) {
        const humanNames = selectedPlayers.filter((p: string) => !isBot(p));
        const baseline = await getPlayersHistoricalBaseline(
          humanNames,
          historyMode,
        );
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [selectedPlayers, historyMode]);

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
      const target = resolveTarget(activePlayer.dartsCount);
      return calculateBotThrow(target, botAvg!);
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
    const mappedPlayers = state.playerStates
      .map((p) => ({
        name: p.name,
        score: p.score,
        darts: p.dartsCount,
        rank: p.rank,
        halves: p.halves,
        ...(mapHistoryExtra ? mapHistoryExtra(p) : {}),
      }))
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));

    await persistMatchToHistory({
      mode: historyMode,
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
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
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
            rounds.length - 1,
          );
          const targetReq = resolveTarget(Math.min(p.dartsCount, totalDarts - 1));
          const targetLabel = getTargetLabel(targetReq, {
            bullTerm,
            tripleTerm,
            language,
          });
          const targetPrefix = getTargetPrefix
            ? getTargetPrefix(roundIdx, rounds.length)
            : t(language, "target")?.toUpperCase();

          return (
            <View
              key={i}
              style={[
                styles.playerRow,
                isActive && styles.activePlayerRow,
                p.isFinished && styles.finishedPlayerRow,
                getRowExtraStyle?.(p as SequencePlayerState<Extra>),
              ]}
            >
              <View style={styles.scoreCol}>
                {p.isFinished ? (
                  renderRank ? (
                    renderRank(p as SequencePlayerState<Extra>)
                  ) : (
                    <Text style={styles.rankText}>{p.rank}</Text>
                  )
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
                              {throwObj ? formatSequenceThrow(throwObj) : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.targetLabel}>
                      {targetPrefix}:{" "}
                      <Text style={{ color: theme.colors.textMain }}>
                        {targetLabel}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.statsCol}>
                    {renderStatsCol ? (
                      renderStatsCol(p as SequencePlayerState<Extra>, {
                        isActive,
                        targetReq,
                      })
                    ) : (
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
                    )}
                  </View>
                </>
              )}

              {renderRowExtra?.(p as SequencePlayerState<Extra>)}
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
        title={getFinishTitle
          ? getFinishTitle(
              state.playerStates as SequencePlayerState<Extra>[],
              t(language, "trainingFinished"),
            )
          : t(language, "trainingFinished")}
        subtitle={t(language, "trainingSaved")}
        theme={theme}
        iconBgColor={getFinishIconBgColor?.(
          state.playerStates as SequencePlayerState<Extra>[],
        )}
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
  });
