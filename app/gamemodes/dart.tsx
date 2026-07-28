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
import { produce, current } from "immer";
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
import {
  popHistorySnapshot,
  pushHistorySnapshot,
  useMatchLifecycle,
} from "../../hooks/useMatchLifecycle";
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
  legs: number;
  sets: number;
};

type PlayerState = {
  name: string;
  score: number;
  roundStartScore: number;
  hasOpened: boolean;
  roundStartHasOpened: boolean;
  darts: number;
  turnThrows: Throw[];
  allTurns?: Throw[][];
  legs: number;
  sets: number;
  isFinished: boolean;
  rank?: number;
  totalMatchDarts: number;
  totalMatchScore?: number;
  checkoutDarts: number;
  checkoutHits: number;
};

type GameState = {
  settings: GameSettings;
  playerStates: PlayerState[];
  currentIndex: number;
  startingPlayerIndex: number;
  throwsThisTurn: number;
  history: GameState[];
  legWinner: PlayerState | null;
  setWinner: PlayerState | null;
  matchWinner: PlayerState | null;
  finishedPlayersCount: number;
  speechEvent?: { text: string; id: number } | null;
  isUndoing?: boolean;
};

const initialState = (players: string[], settings: GameSettings): GameState => {
  const isStraightIn = settings.inRule === "straight";
  return {
    settings,
    playerStates: players.map((p) => ({
      name: p,
      score: settings.startPoints,
      roundStartScore: settings.startPoints,
      hasOpened: isStraightIn,
      roundStartHasOpened: isStraightIn,
      darts: 0,
      turnThrows: [],
      allTurns: [],
      legs: 0,
      sets: 0,
      isFinished: false,
      totalMatchDarts: 0,
      totalMatchScore: 0,
      checkoutDarts: 0,
      checkoutHits: 0,
    })),
    currentIndex: 0,
    startingPlayerIndex: 0,
    throwsThisTurn: 0,
    history: [],
    legWinner: null,
    setWinner: null,
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
  | { type: "START_NEXT_LEG" }
  | { type: "CONTINUE_AFTER_WIN" }
  | { type: "UNDO" }
  | { type: "RESET_CURRENT_TURN" };

const gameReducer = produce((draft: GameState, action: Action) => {
  switch (action.type) {
    case "ADD_THROW": {
      const { value, multiplier, coords } = action.payload;
      const {
        inRule,
        outRule,
        legs: targetLegs = 1,
        sets: targetSets = 1,
      } = draft.settings || {};

      pushHistorySnapshot(draft, current(draft));

      const player = draft.playerStates[draft.currentIndex];

      player.totalMatchDarts = (player.totalMatchDarts || 0) + 1;

      const isGameDart =
        player.score === 50 || (player.score <= 40 && player.score % 2 === 0);
      if (isGameDart) {
        player.checkoutDarts = (player.checkoutDarts || 0) + 1;
      }

      if (draft.throwsThisTurn === 0) {
        player.roundStartScore = player.score;
        player.roundStartHasOpened = player.hasOpened;
      }

      let hitPoints = value * multiplier;
      let validIn = player.hasOpened;

      if (!validIn) {
        if (inRule === "double" && multiplier === 2) validIn = true;
        if (inRule === "master" && (multiplier === 2 || multiplier === 3))
          validIn = true;
      }

      if (!validIn) hitPoints = 0;
      else player.hasOpened = true;

      player.darts += 1;
      const newScore = player.score - hitPoints;
      if (!player.turnThrows) player.turnThrows = [];
      player.turnThrows.push({ value, multiplier, coords });

      let isWin = false;
      let isBust = newScore < 0;

      if (newScore === 0) {
        let validOut = true;
        if (outRule === "double" && multiplier !== 2) validOut = false;
        if (outRule === "master" && multiplier !== 2 && multiplier !== 3)
          validOut = false;
        if (validOut) isWin = true;
        else isBust = true;
      } else if (newScore === 1) {
        if (outRule === "double" || outRule === "master") isBust = true;
      }

      const currentDartScore = value * multiplier;
      const previousDartsScore = player.turnThrows
        .slice(0, -1)
        .reduce((sum: number, t: Throw) => sum + t.value * t.multiplier, 0);
      const turnSumTotal = previousDartsScore + currentDartScore;

      let newSpeechText: string | null = null;
      if (isBust) {
        newSpeechText = "0";
      } else if (isWin || draft.throwsThisTurn === 2) {
        newSpeechText = turnSumTotal.toString();
      }
      const newSpeechEvent = newSpeechText
        ? { text: newSpeechText, id: Date.now() }
        : null;

      player.score = isWin ? 0 : isBust ? player.roundStartScore : newScore;
      if (isBust) player.hasOpened = player.roundStartHasOpened;

      if (isWin || isBust || draft.throwsThisTurn === 2) {
        player.totalMatchScore =
          (player.totalMatchScore || 0) + (isBust ? 0 : turnSumTotal);
        if (!player.allTurns) player.allTurns = [];
        player.allTurns.push(player.turnThrows);
      }

      if (isWin) {
        if (isGameDart) player.checkoutHits = (player.checkoutHits || 0) + 1;

        const isMatchWin =
          player.sets + (player.legs + 1 === targetLegs ? 1 : 0) === targetSets;
        const isSetWin = player.legs + 1 === targetLegs;

        player.legs += 1;
        if (isMatchWin || isSetWin) {
          player.sets += 1;
        }

        if (isMatchWin) draft.matchWinner = player as any;
        else if (isSetWin) draft.setWinner = player as any;
        else draft.legWinner = player as any;

        draft.speechEvent = newSpeechEvent;
        return;
      }

      if (isBust || draft.throwsThisTurn === 2) {
        draft.speechEvent = newSpeechEvent;
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
      draft.speechEvent = newSpeechEvent;
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
      const {
        inRule,
        outRule,
        legs: targetLegs = 1,
        sets: targetSets = 1,
      } = draft.settings || {};

      pushHistorySnapshot(draft, current(draft));

      const player = draft.playerStates[draft.currentIndex];

      if (draft.throwsThisTurn === 0) {
        player.roundStartScore = player.score;
        player.roundStartHasOpened = player.hasOpened;
      }

      let openedThisTurn = false;
      if (!player.hasOpened && turnScore > 0) {
        openedThisTurn = true;
      }

      const newScore =
        player.hasOpened || openedThisTurn
          ? player.score - turnScore
          : player.score;

      let isWin = false;
      let isBust = newScore < 0 || forceBust;

      if (newScore === 0 && !isBust) {
        isWin = true;
        if (dartsAtDouble > 0 || outRule === "straight") {
          player.checkoutHits = (player.checkoutHits || 0) + 1;
        }
      } else if (
        newScore === 1 &&
        (outRule === "double" || outRule === "master")
      ) {
        isBust = true;
      }

      let dartsToLog = 3 - draft.throwsThisTurn;
      if (isWin && dartsAtDouble > 0) {
        dartsToLog = dartsAtDouble;
      }

      player.checkoutDarts = (player.checkoutDarts || 0) + dartsAtDouble;
      player.totalMatchDarts = (player.totalMatchDarts || 0) + dartsToLog;
      player.darts += dartsToLog;

      if (openedThisTurn) player.hasOpened = true;

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

      let newSpeechText: string | null = null;
      if (isBust) {
        newSpeechText = "0";
      } else {
        newSpeechText = turnSumTotal.toString();
      }
      const newSpeechEvent = newSpeechText
        ? { text: newSpeechText, id: Date.now() }
        : null;

      player.score = isWin ? 0 : isBust ? player.roundStartScore : newScore;
      if (isBust) player.hasOpened = player.roundStartHasOpened;

      if (isWin || isBust || draft.throwsThisTurn === 2) {
        player.totalMatchScore =
          (player.totalMatchScore || 0) + (isBust ? 0 : turnSumTotal);
        if (!player.allTurns) player.allTurns = [];
        player.allTurns.push(player.turnThrows);
      }

      if (isWin) {
        const isMatchWin =
          player.sets + (player.legs + 1 === targetLegs ? 1 : 0) === targetSets;
        const isSetWin = player.legs + 1 === targetLegs;

        player.legs += 1;
        if (isMatchWin || isSetWin) {
          player.sets += 1;
        }

        if (isMatchWin) draft.matchWinner = player as any;
        else if (isSetWin) draft.setWinner = player as any;
        else draft.legWinner = player as any;

        draft.speechEvent = newSpeechEvent;
        return;
      }

      draft.speechEvent = newSpeechEvent;
      let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
      while (draft.playerStates[nextIdx].isFinished) {
        nextIdx = (nextIdx + 1) % draft.playerStates.length;
      }
      draft.playerStates[nextIdx].turnThrows = [];
      draft.currentIndex = nextIdx;
      draft.throwsThisTurn = 0;
      return;
    }

    case "START_NEXT_LEG": {
      pushHistorySnapshot(draft, current(draft));

      const isNewSet = draft.setWinner !== null;
      const nextStarter =
        (draft.startingPlayerIndex + 1) % draft.playerStates.length;
      const isStraightIn = draft.settings?.inRule === "straight";

      draft.playerStates.forEach((p) => {
        p.score = draft.settings?.startPoints || 501;
        p.roundStartScore = draft.settings?.startPoints || 501;
        p.hasOpened = isStraightIn;
        p.roundStartHasOpened = isStraightIn;
        p.darts = 0;
        p.turnThrows = [];
        if (isNewSet) p.legs = 0;
      });

      draft.currentIndex = nextStarter;
      draft.startingPlayerIndex = nextStarter;
      draft.throwsThisTurn = 0;
      draft.legWinner = null;
      draft.setWinner = null;
      draft.matchWinner = null;
      draft.speechEvent = null;
      return;
    }

    case "CONTINUE_AFTER_WIN": {
      const winnerIndex = draft.playerStates.findIndex(
        (p) => p.name === draft.matchWinner?.name,
      );
      if (winnerIndex === -1) return;

      const winner = draft.playerStates[winnerIndex];
      draft.finishedPlayersCount += 1;
      winner.isFinished = true;
      winner.rank = draft.finishedPlayersCount;

      let activeLeft = draft.playerStates.filter((p) => !p.isFinished).length;
      if (activeLeft === 0) {
        draft.matchWinner = null;
        draft.speechEvent = null;
        draft.isUndoing = false;
        return;
      }

      draft.matchWinner = null;
      draft.speechEvent = null;

      let nextIdx = (draft.currentIndex + 1) % draft.playerStates.length;
      while (draft.playerStates[nextIdx].isFinished) {
        nextIdx = (nextIdx + 1) % draft.playerStates.length;
      }
      draft.playerStates[nextIdx].turnThrows = [];
      draft.currentIndex = nextIdx;
      draft.throwsThisTurn = 0;
      draft.isUndoing = false;
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
});

export default function Game() {
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
      ? {
          ...parsedResume.gameState,
          settings: parsedResume.gameState.settings ||
            parsedResume.settings || {
              inRule: "straight",
              outRule: "double",
              startPoints: 501,
              legs: 1,
              sets: 1,
            },
        }
      : initialState(selectedPlayers || [], {
          inRule: settings?.inRule || "straight",
          outRule: settings?.outRule || "double",
          startPoints: settings?.startPoints || 501,
          legs: settings?.legs || 1,
          sets: settings?.sets || 1,
        }),
  );

  const [inputMode, setInputMode] = useState<"dart" | "score" | "board">(
    "dart",
  );
  const [typedScore, setTypedScore] = useState("");
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState(3);
  const matchTimeRef = useRef<number>(
    parsedResume?.gameState?.savedMatchTime || 0,
  );
  const handleTimeUpdate = useCallback((time: number) => {
    matchTimeRef.current = time;
  }, []);

  const hasMatchStarted = state.playerStates.some(
    (p) =>
      p.score !== (state.settings?.startPoints || 501) ||
      p.darts > 0 ||
      p.legs > 0 ||
      p.sets > 0 ||
      (p.totalMatchDarts && p.totalMatchDarts > 0),
  );
  const isMatchFinished = state.finishedPlayersCount > 0 || !!state.matchWinner;

  useExitGuard(hasMatchStarted || isMatchFinished, () => {
    if (isMatchFinished) {
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
    if (state.speechEvent) {
      speak(t(language, state.speechEvent.text));
    }
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
        const baseline = await getPlayersHistoricalBaseline(humanNames, "X01");
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
    state.settings,
    historicalBaseline,
  );

  useBotTurn({
    condition:
      isBaselineLoaded &&
      !state.legWinner &&
      !state.setWinner &&
      !state.matchWinner &&
      !showDoublePrompt &&
      !state.isUndoing &&
      state.throwsThisTurn === 0 &&
      !!currentPlayer,
    botAvg,
    delay,
    historyLength: state.history.length,
    calculate: () => {
      const outRule = state.settings.outRule || "double";
      const inRule = state.settings.inRule || "straight";
      const hasOpened = currentPlayer.hasOpened;
      const botScore = simulateBotTurn(
        botAvg!,
        currentPlayer.score,
        hasOpened,
        inRule,
        outRule,
      );
      let dartsAtDouble = 0;
      const newLeft = currentPlayer.score - botScore;
      const isCheckoutSetup =
        outRule === "straight"
          ? currentPlayer.score <= 180
          : currentPlayer.score <= 170 &&
            !BOGEY_NUMBERS.includes(currentPlayer.score);
      let isBust = false;
      if (botScore === 0 && isCheckoutSetup && hasOpened) isBust = true;
      let minDarts = 1;
      if (outRule !== "straight") {
        const checkoutStr = getCheckoutInfo(currentPlayer.score);
        minDarts = checkoutStr ? checkoutStr.split(" ").length : 1;
      } else {
        if (currentPlayer.score > 120) minDarts = 3;
        else if (currentPlayer.score > 60) minDarts = 2;
      }
      if (botScore === currentPlayer.score)
        dartsAtDouble =
          outRule === "straight"
            ? 0
            : Math.floor(Math.random() * (4 - minDarts)) + minDarts;
      else if (isCheckoutSetup && (newLeft <= 50 || isBust))
        dartsAtDouble = outRule === "straight" ? 0 : 3;
      let dartsToLog = 3 - state.throwsThisTurn;
      if (botScore === currentPlayer.score && dartsAtDouble > 0)
        dartsToLog = dartsAtDouble;
      else if (botScore === currentPlayer.score && outRule === "straight")
        dartsToLog = minDarts;
      else if (isBust && isCheckoutSetup) dartsToLog = 3;
      const individualDarts = breakdownScoreToDarts(
        botScore,
        dartsToLog,
        botScore === currentPlayer.score,
        hasOpened,
        inRule,
        outRule,
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

  useEffect(() => {
    if (state.matchWinner || state.setWinner || state.legWinner) {
      triggerHaptic("success");
    }
  }, [state.matchWinner, state.setWinner, state.legWinner]);

  const saveMatchToHistory = async (navigateAway: boolean = true) => {
    const mappedPlayers = state.playerStates.map((p, idx) => {
      let validTurns = [];
      if (p.allTurns) {
        validTurns = [...p.allTurns];
        if (
          !p.isFinished &&
          p.turnThrows &&
          p.turnThrows.length > 0 &&
          state.currentIndex === idx &&
          !state.matchWinner &&
          !state.legWinner &&
          !state.setWinner
        ) {
          validTurns.push(p.turnThrows);
        }
      } else {
        const rawTurns = state.history.map(
          (h) => h.playerStates[idx].turnThrows,
        );
        rawTurns.push(state.playerStates[idx].turnThrows);
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
        legs: p.legs,
        sets: p.sets,
        rank: p.rank,
        totalMatchDarts: p.totalMatchDarts || 0,
        checkoutDarts: p.checkoutDarts || 0,
        checkoutHits: p.checkoutHits || 0,
        allTurns: validTurnsFormatted,
      };
    });

    mappedPlayers.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return b.sets - a.sets || b.legs - a.legs || a.score - b.score;
    });

    const isUnfinished =
      state.matchWinner === null && state.finishedPlayersCount === 0;

    await persistMatchToHistory({
      mode: "X01",
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
    if (state.legWinner || state.setWinner || state.matchWinner) return;

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
    setMultiplier((prev: 1 | 2 | 3) => (prev === newMult ? 1 : newMult));
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

    const currentPlayer = state.playerStates[state.currentIndex];
    const outRule = state.settings?.outRule || "double";

    prepareScoreSubmission(
      { currentLeft: currentPlayer.score, score, outRule },
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

  const isSingleLegMatch =
    (state.settings?.legs || 1) === 1 && (state.settings?.sets || 1) === 1;
  const activePlayersCount = state.playerStates.filter(
    (p) => !p.isFinished,
  ).length;

  let checkoutSuggestion: string | null = null;
  if (
    currentPlayer &&
    !state.legWinner &&
    !state.setWinner &&
    !state.matchWinner &&
    !currentPlayer.isFinished
  ) {
    checkoutSuggestion = getCheckoutSuggestion({
      score: currentPlayer.score,
      roundStartScore: currentPlayer.roundStartScore,
      throwsThisTurn: state.throwsThisTurn,
      turnThrows: currentPlayer.turnThrows,
      dartsRemaining: 3 - state.throwsThisTurn,
    });
  }

  const isModalVisible =
    !!state.matchWinner || !!state.setWinner || !!state.legWinner;
  const winnerName =
    state.matchWinner?.name ||
    state.setWinner?.name ||
    state.legWinner?.name ||
    "";

  let modalTitle = "";
  let modalSub = "";
  let timerText = "";
  let showContinueButton = false;

  if (state.matchWinner) {
    if (isSingleLegMatch && activePlayersCount > 1) {
      modalTitle = (
        t(language, "playerFinished")
      ).replace("{{name}}", winnerName);
      modalSub = t(language, "continueOrEnd");
      showContinueButton = true;
    } else {
      modalTitle = isSingleLegMatch
        ? (
            t(language, "playerFinished")
          ).replace("{{name}}", winnerName)
        : (t(language, "matchWinner")).replace(
            "{{name}}",
            winnerName,
          );
    }
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

  const inRuleKey =
    state.settings?.inRule === "master"
      ? "masterIn"
      : state.settings?.inRule === "double"
        ? "doubleIn"
        : "straightIn";
  const outRuleKey =
    state.settings?.outRule === "master"
      ? "masterOut"
      : state.settings?.outRule === "double"
        ? "doubleOut"
        : "straightOut";
  const inOutText = `${t(language, inRuleKey)} • ${t(language, outRuleKey)}`;

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
            {state.settings?.startPoints || 501}
          </Text>
          <Text style={styles.headerSubInfo}>{inOutText.toUpperCase()}</Text>
          <Text style={styles.headerSubInfo}>
            {t(language, "firstTo")?.toUpperCase()}{" "}
            {state.settings?.legs || 1} L / {state.settings?.sets || 1} S
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
          const avg =
            p.darts > 0
              ? (
                  (((state.settings?.startPoints || 501) - p.score) / p.darts) *
                  3
                ).toFixed(1)
              : "0.0";

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
                    {!isSingleLegMatch && (
                      <View style={styles.legSetBadge}>
                        <Text style={styles.legSetText}>
                          {" "}
                          L: {p.legs} S: {p.sets}{" "}
                        </Text>
                      </View>
                    )}
                    <View style={styles.statRow}>
                      <Ionicons
                        name="locate-outline"
                        size={14}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.statBold}>{p.darts}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.avgIcon}>Ø</Text>
                      <Text style={styles.statBold}>
                        {" "}
                        {p.darts > 0
                          ? (
                              ((state.settings.startPoints - p.score) /
                                p.darts) *
                              3
                            ).toFixed(1)
                          : "0.0"}{" "}
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
        {checkoutSuggestion && state.settings?.outRule !== "straight" ? (
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
        {!!timerText && !state.matchWinner && (
          <Text style={styles.modalTimer}>
            {timerText} <Text style={styles.modalTimerValue}>{countdown}s</Text>
          </Text>
        )}

        <View style={styles.modalActionsCol}>
          {state.matchWinner ? (
            showContinueButton ? (
              <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                <AnimatedPrimaryButton
                  title={t(language, "continue")}
                  theme={theme}
                  style={{ flex: 1 }}
                  onPress={() => {
                    saveMatchToHistory(false);
                    dispatch({ type: "CONTINUE_AFTER_WIN" });
                  }}
                />
                <AnimatedPrimaryButton
                  title={t(language, "endMatch")}
                  theme={theme}
                  color={theme.colors.textMain}
                  textColor={theme.colors.background}
                  style={{ flex: 1 }}
                  onPress={() => saveMatchToHistory(true)}
                />
              </View>
            ) : (
              <AnimatedPrimaryButton
                title={t(language, "endMatch")}
                theme={theme}
                onPress={() => saveMatchToHistory(true)}
              />
            )
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

      <DoubleOutModal
        visible={showDoublePrompt}
        pendingTurn={pendingTurn}
        onSelect={(score, dartsAtDouble, isBust) =>
          processScoreTurn(score, dartsAtDouble, isBust)
        }
        theme={theme}
        language={language}
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

    legSetBadge: {
      backgroundColor: theme.colors.textMain,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: 6,
    },
    legSetText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    avgIcon: { fontSize: 14, color: theme.colors.textMuted, fontWeight: "700" },

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
