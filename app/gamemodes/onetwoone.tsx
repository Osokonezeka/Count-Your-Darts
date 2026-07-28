import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
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

import { Ionicons } from "@expo/vector-icons";
import { current, produce } from "immer";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { BotAwareKeyboard } from "../../components/common/BotAwareKeyboard";
import { getSharedGameStyles } from "../../components/common/SharedGameStyles";
import { TimerBadge } from "../../components/common/TimerBadge";
import { DartKeyboard } from "../../components/keyboards/DartKeyboard";
import { InputModeSelector } from "../../components/keyboards/InputModeSelector";
import { InteractiveDartboard } from "../../components/keyboards/InteractiveDartboard";
import { ScoreKeyboard } from "../../components/keyboards/ScoreKeyboard";
import { DoubleOutModal } from "../../components/modals/DoubleOutModal";
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
    getCheckoutSuggestion,
    useX01Engine,
} from "../../hooks/useX01Engine";
import {
    breakdownScoreToDarts,
    resolveBotAverage,
    simulateBotTurn,
} from "../../lib/bot";
import { getCheckoutInfo } from "../../lib/checkouts";
import {
    BOGEY_NUMBERS,
    formatThrow,
    IMPOSSIBLE_SCORES,
} from "../../lib/gameUtils";
import { t } from "../../lib/i18n";
import { getPlayersHistoricalBaseline, isBot } from "../../lib/statsUtils";

type Throw = {
  value: number;
  multiplier: number;
  darts?: number;
  isScoreInput?: boolean;
  coords?: { x: number; y: number };
};

type GameSettings = {
  inRule: "straight" | "double" | "master";
  outRule: "straight" | "double" | "master";
  startPoints: number;
};

type PlayerState = {
  name: string;
  score: number;
  roundStartScore: number;
  target: number;
  dartsLeft: number;
  highestTarget: number;
  turnThrows: Throw[];
  allTurns?: Throw[][];
  isFinished: boolean;
  rank?: number;
  totalMatchDarts: number;
  checkoutDarts: number;
  checkoutHits: number;
};

type GameState = {
  settings: GameSettings;
  playerStates: PlayerState[];
  currentIndex: number;
  throwsThisTurn: number;
  history: GameState[];
  matchWinner: PlayerState | null;
  finishedPlayersCount: number;
  speechEvent?: { text: string; id: number } | null;
  isUndoing?: boolean;
};

const initialState = (players: string[], settings: GameSettings): GameState => {
  return {
    settings,
    playerStates: players.map((p) => ({
      name: p,
      score: 121,
      roundStartScore: 121,
      target: 121,
      highestTarget: 120,
      dartsLeft: 9,
      turnThrows: [],
      allTurns: [],
      isFinished: false,
      totalMatchDarts: 0,
      checkoutDarts: 0,
      checkoutHits: 0,
    })),
    currentIndex: 0,
    throwsThisTurn: 0,
    history: [],
    matchWinner: null,
    finishedPlayersCount: 0,
    speechEvent: null,
    isUndoing: false,
  };
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
        dartsAtDouble?: number;
        isBust?: boolean;
        individualDarts?: { value: number; multiplier: number }[] | null;
      };
    }
  | { type: "UNDO" }
  | { type: "RESET_CURRENT_TURN" };

const gameReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;
      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      player.totalMatchDarts += 1;
      player.dartsLeft -= 1;

      const isGameDart =
        player.score === 50 || (player.score <= 40 && player.score % 2 === 0);
      if (isGameDart) player.checkoutDarts += 1;

      if (draft.throwsThisTurn === 0) {
        player.roundStartScore = player.score;
      }

      const hitPoints = value * multiplier;
      const newScore = player.score - hitPoints;

      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, coords });

      let isWin = false;
      let isBust = newScore < 0;

      if (newScore === 0) {
        if (multiplier === 2) isWin = true;
        else isBust = true;
      } else if (newScore === 1) {
        isBust = true;
      }

      const currentDartScore = value * multiplier;
      const previousDartsScore = player.turnThrows
        .slice(0, -1)
        .reduce((sum: number, t: Throw) => sum + t.value * t.multiplier, 0);
      const turnSumTotal = previousDartsScore + currentDartScore;

      let newSpeechText: string | null = null;
      if (isBust) newSpeechText = "0";
      else if (isWin || draft.throwsThisTurn === 2)
        newSpeechText = turnSumTotal.toString();

      draft.speechEvent = newSpeechText
        ? { text: newSpeechText, id: Date.now() }
        : null;
      player.score = isWin ? 0 : isBust ? player.roundStartScore : newScore;

      if (isWin || isBust || draft.throwsThisTurn === 2) {
        if (!player.allTurns) player.allTurns = [];
        player.allTurns.push(player.turnThrows);
      }

      if (isWin) {
        if (isGameDart) player.checkoutHits += 1;
        player.highestTarget = player.target;
        player.target += 1;
        player.score = player.target;
        player.roundStartScore = player.target;
        player.dartsLeft = 9;

        let activeLeft = draft.playerStates.filter((p) => !p.isFinished).length;
        if (activeLeft === 0) {
          draft.matchWinner = [...draft.playerStates].sort(
            (a, b) => b.highestTarget - a.highestTarget,
          )[0] as any;
          return;
        }
        let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
        while (
          draft.playerStates[nextIdx].isFinished &&
          nextIdx !== draft.currentIndex
        ) {
          nextIdx = (nextIdx + 1) % draft.playerStates.length;
        }
        draft.currentIndex = nextIdx;
        draft.throwsThisTurn = 0;
        draft.playerStates[nextIdx].turnThrows = [];
        return;
      }

      if (isBust || draft.throwsThisTurn === 2) {
        if (player.dartsLeft <= 0) {
          player.isFinished = true;
          draft.finishedPlayersCount += 1;
          player.rank =
            draft.playerStates.length - draft.finishedPlayersCount + 1;
        }

        let activeLeft = draft.playerStates.filter((p) => !p.isFinished).length;
        if (activeLeft === 0) {
          draft.matchWinner = [...draft.playerStates].sort(
            (a, b) => b.highestTarget - a.highestTarget,
          )[0] as any;
          return;
        }

        let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
        while (draft.playerStates[nextIdx].isFinished) {
          nextIdx = (nextIdx + 1) % draft.playerStates.length;
        }
        draft.currentIndex = nextIdx;
        draft.throwsThisTurn = 0;
        draft.playerStates[nextIdx].turnThrows = [];
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
      const {
        score: turnScore,
        dartsAtDouble = 0,
        isBust: forceBust = false,
        individualDarts = null,
      } = action.payload;
      const snapshot = current(draft);
      draft.history.push({ ...snapshot, history: [] });
      draft.isUndoing = false;

      const player = draft.playerStates[draft.currentIndex];
      if (draft.throwsThisTurn === 0) {
        player.roundStartScore = player.score;
      }

      const newScore = player.score - turnScore;
      let isWin = false;
      let isBust = newScore < 0 || forceBust;

      if (newScore === 0 && !isBust) {
        isWin = true;
        if (dartsAtDouble > 0) player.checkoutHits += 1;
      } else if (newScore === 1) {
        isBust = true;
      }

      let dartsToLog = 3 - draft.throwsThisTurn;
      if (isWin && dartsAtDouble > 0) dartsToLog = dartsAtDouble;

      player.checkoutDarts += dartsAtDouble;
      player.totalMatchDarts += dartsToLog;
      player.dartsLeft -= dartsToLog;

      if (individualDarts) {
        player.turnThrows = individualDarts.map((d) => ({
          ...d,
          darts: 1,
          isScoreInput: false,
        }));
      } else {
        if (!player.turnThrows) player.turnThrows = [];
        player.turnThrows.push({
          value: turnScore,
          multiplier: 1,
          darts: dartsToLog,
          isScoreInput: true,
        });
      }

      const itemsAdded = individualDarts ? individualDarts.length : 1;
      const previousDartsScore = player.turnThrows
        .slice(0, -itemsAdded)
        .reduce((sum: number, t: Throw) => sum + t.value * t.multiplier, 0);
      const turnSumTotal = previousDartsScore + turnScore;

      let newSpeechText: string | null = isBust ? "0" : turnSumTotal.toString();
      draft.speechEvent = newSpeechText
        ? { text: newSpeechText, id: Date.now() }
        : null;

      player.score = isWin ? 0 : isBust ? player.roundStartScore : newScore;

      if (isWin || isBust || draft.throwsThisTurn === 2) {
        if (!player.allTurns) player.allTurns = [];
        player.allTurns.push(player.turnThrows);
      }

      if (isWin) {
        player.highestTarget = player.target;
        player.target += 1;
        player.score = player.target;
        player.roundStartScore = player.target;
        player.dartsLeft = 9;

        let activeLeft = draft.playerStates.filter((p) => !p.isFinished).length;
        if (activeLeft === 0) {
          draft.matchWinner = [...draft.playerStates].sort(
            (a, b) => b.highestTarget - a.highestTarget,
          )[0] as any;
          return;
        }
        let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
        while (
          draft.playerStates[nextIdx].isFinished &&
          nextIdx !== draft.currentIndex
        ) {
          nextIdx = (nextIdx + 1) % draft.playerStates.length;
        }
        draft.currentIndex = nextIdx;
        draft.throwsThisTurn = 0;
        draft.playerStates[nextIdx].turnThrows = [];
        return;
      }

      if (player.dartsLeft <= 0) {
        player.isFinished = true;
        draft.finishedPlayersCount += 1;
        player.rank =
          draft.playerStates.length - draft.finishedPlayersCount + 1;
      }

      let activeLeft = draft.playerStates.filter((p) => !p.isFinished).length;
      if (activeLeft === 0) {
        draft.matchWinner = [...draft.playerStates].sort(
          (a, b) => b.highestTarget - a.highestTarget,
        )[0] as any;
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

export default function OneTwoOneGame() {
  const { selectedPlayers, settings } = useGame();
  const { language } = useLanguage();
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const { theme } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { speak } = useSpeech();
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

  const {
    GameAlerts,
    showExitConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  const { showDoublePrompt, pendingTurn, prepareScoreSubmission, closeDoublePrompt } =
    useX01Engine();

  const [state, dispatch] = useReducer(
    gameReducer,
    parsedResume && parsedResume.gameState
      ? { ...parsedResume.gameState }
      : initialState(selectedPlayers || [], {
          inRule: "straight",
          outRule: "double",
          startPoints: 121,
        }),
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

  const hasMatchStarted = state.playerStates.some(
    (p) => p.score !== 121 || p.totalMatchDarts > 0,
  );

  useExitGuard(hasMatchStarted || !!state.matchWinner, () => {
    if (state.matchWinner) {
      saveMatchToHistory(false).then(confirmExit);
      return;
    }

    showExitConfirm(() => {
      saveMatchToHistory(false).then(confirmExit);
    });
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (state.speechEvent) speak(t(language, state.speechEvent.text));
  }, [state.speechEvent]);

  const currentPlayer = state.playerStates[state.currentIndex];
  const scrollViewRef = useRef<ScrollView>(null);

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
          "121_checkout",
        );
        setHistoricalBaseline(baseline);
        setIsBaselineLoaded(true);
      }
    };
    fetchBaseline();
  }, [selectedPlayers]);

  const { isFastBot, delay } = useBotDelay(state.isUndoing, 700);
  const botAvg = resolveBotAverage(
    currentPlayer?.name || "",
    state.playerStates,
    "X01",
    {
      inRule: "straight",
      outRule: "double",
      startPoints: 501,
      legs: 1,
      sets: 1,
    },
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded &&
      !state.matchWinner &&
      !showDoublePrompt &&
      !state.isUndoing &&
      state.throwsThisTurn === 0 &&
      !!currentPlayer &&
      !currentPlayer.isFinished,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      const hasOpened = true;
      const botScore = simulateBotTurn(
        botAvg!,
        currentPlayer.score,
        hasOpened,
        "straight",
        "double",
      );
      let dartsAtDouble = 0;
      const newLeft = currentPlayer.score - botScore;
      const isCheckoutSetup =
        currentPlayer.score <= 170 &&
        !BOGEY_NUMBERS.includes(currentPlayer.score);
      let isBust = false;
      if (botScore === 0 && isCheckoutSetup && hasOpened) isBust = true;

      let minDarts = 1;
      const checkoutStr = getCheckoutInfo(currentPlayer.score);
      minDarts = checkoutStr ? checkoutStr.split(" ").length : 1;

      if (botScore === currentPlayer.score) {
        dartsAtDouble = Math.floor(Math.random() * (4 - minDarts)) + minDarts;
      } else if (isCheckoutSetup && (newLeft <= 50 || isBust)) {
        dartsAtDouble = 3;
      }

      let dartsToLog = Math.min(
        3 - state.throwsThisTurn,
        currentPlayer.dartsLeft,
      );
      if (botScore === currentPlayer.score && dartsAtDouble > 0)
        dartsToLog = dartsAtDouble;
      else if (isBust && isCheckoutSetup)
        dartsToLog = Math.min(3, currentPlayer.dartsLeft);

      const individualDarts = breakdownScoreToDarts(
        botScore,
        dartsToLog,
        botScore === currentPlayer.score,
        hasOpened,
        "straight",
        "double",
        currentPlayer.score,
      );
      return { botScore, dartsAtDouble, isBust, individualDarts };
    },
    execute: async ({ botScore, dartsAtDouble, isBust, individualDarts }) => {
      for (let i = 0; i < individualDarts.length; i++) {
        dispatch({ type: "ADD_DART_VISUAL", payload: individualDarts[i] });
        await new Promise((res) => setTimeout(res, isFastBot ? 50 : 200));
      }
      processScoreTurn(botScore, dartsAtDouble, isBust, individualDarts);
    },
  });

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: state.currentIndex * 85,
        animated: true,
      });
    }
  }, [state.currentIndex]);

  useEffect(() => {
    if (state.matchWinner) triggerHaptic("success");
  }, [state.matchWinner]);

  const saveMatchToHistory = async (navigateAway: boolean = true) => {
    const mappedPlayers = state.playerStates.map((p, idx) => {
      let validTurns = p.allTurns ? [...p.allTurns] : [];
      if (
        !p.isFinished &&
        p.turnThrows &&
        p.turnThrows.length > 0 &&
        state.currentIndex === idx &&
        !state.matchWinner
      ) {
        validTurns.push(p.turnThrows);
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
        score: p.highestTarget,
        rank: p.rank,
        totalMatchDarts: p.totalMatchDarts || 0,
        checkoutDarts: p.checkoutDarts || 0,
        checkoutHits: p.checkoutHits || 0,
        allTurns: validTurnsFormatted,
      };
    });

    mappedPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));

    const isUnfinished = state.matchWinner === null;

    await persistMatchToHistory({
      mode: "121_checkout",
      settings: state.settings,
      players: mappedPlayers,
      isUnfinished,
      gameState: { ...state, history: [], savedMatchTime: matchTimeRef.current },
      matchTimeSeconds: matchTimeRef.current,
      navigateAway,
    });
  };

  const handleThrow = (
    value: number,
    overrideMultiplier?: number,
    coords?: { x: number; y: number },
  ) => {
    if (state.matchWinner) return;
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

    prepareScoreSubmission(
      { currentLeft: currentPlayer.score, score, outRule: "double" },
      (resolvedScore, dartsAtDouble, isBust) =>
        processScoreTurn(resolvedScore, dartsAtDouble, isBust),
    );
  };

  const processScoreTurn = (
    score: number,
    dartsAtDouble: number,
    isBust: boolean = false,
    individualDarts?: { value: number; multiplier: number }[],
  ) => {
    dispatch({
      type: "ADD_TURN_SCORE",
      payload: { score, dartsAtDouble, isBust, individualDarts },
    });
    setTypedScore("");
    closeDoublePrompt();
  };

  let checkoutSuggestion: string | null = null;
  if (currentPlayer && !state.matchWinner && !currentPlayer.isFinished) {
    checkoutSuggestion = getCheckoutSuggestion({
      score: currentPlayer.score,
      roundStartScore: currentPlayer.roundStartScore,
      throwsThisTurn: state.throwsThisTurn,
      turnThrows: currentPlayer.turnThrows,
      dartsRemaining: Math.min(
        3 - state.throwsThisTurn,
        currentPlayer.dartsLeft,
      ),
    });
  }

  const isModalVisible = !!state.matchWinner;
  const winnerName = state.matchWinner?.name || "";
  const modalTitle = t(language, "trainingFinished");
  const modalSub =
    (t(language, "highestReached")) +
    " " +
    (state.matchWinner?.highestTarget || 120);

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
            {t(language, "121Checkout")}
          </Text>
          <Text style={styles.headerSubInfo}>
            {t(language, "training")?.toUpperCase()}
          </Text>
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

      <ScrollView
        ref={scrollViewRef}
        style={styles.scoreBoardScroll}
        contentContainerStyle={styles.scoreBoardContent}
      >
        {state.playerStates.map((p, i) => {
          const isActive = i === state.currentIndex && !p.isFinished;
          const turnSum =
            p.turnThrows?.reduce((sum, t) => sum + t.value * t.multiplier, 0) ||
            0;

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
                        {[0, 1, 2].map((idx) => (
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
                              {p.turnThrows?.[idx]
                                ? formatThrow(p.turnThrows[idx])
                                : ""}
                            </Text>
                          </View>
                        ))}
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
                      <Ionicons
                        name="pricetag-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>
                        {t(language, "level")}:{" "}
                        <Text style={{ color: theme.colors.primary }}>
                          {p.target}
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.statRow}>
                      <Ionicons
                        name="timer-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>
                        {t(language, "dartsRemaining")}:{" "}
                        <Text
                          style={{
                            color:
                              p.dartsLeft <= 3
                                ? theme.colors.danger
                                : theme.colors.textMain,
                          }}
                        >
                          {p.dartsLeft}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.checkoutWrapper}>
        {checkoutSuggestion ? (
          <View style={styles.checkoutBadge}>
            <Text style={styles.checkoutLabel}>
              {t(language, "checkoutUpper")}
            </Text>
            <Text style={styles.checkoutValue}>{checkoutSuggestion}</Text>
          </View>
        ) : (
          <View style={{ height: 40 }} />
        )}
      </View>

      <BotAwareKeyboard
        playerName={currentPlayer?.name || ""}
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

      <FinishModal
        visible={isModalVisible}
        title={modalTitle}
        subtitle={modalSub}
        theme={theme}
      >
        <View style={styles.modalActionsCol}>
          <AnimatedPrimaryButton
            title={t(language, "endMatch")}
            theme={theme}
            onPress={() => saveMatchToHistory(true)}
          />
        </View>
      </FinishModal>

      <DoubleOutModal
        visible={showDoublePrompt}
        pendingTurn={pendingTurn}
        onSelect={(score, dartsAtDouble, isBust) =>
          processScoreTurn(score, dartsAtDouble, isBust)
        }
        theme={theme}
        language={language}
        maxDartsAvailable={currentPlayer?.dartsLeft || 3}
      />
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
    checkoutWrapper: {
      marginTop: "auto",
      paddingHorizontal: 15,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
    },
    checkoutBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      gap: 8,
    },
    checkoutLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    checkoutValue: {
      color: theme.colors.success,
      fontSize: 16,
      fontWeight: "900",
    },
  });
