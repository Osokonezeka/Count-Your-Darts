import AsyncStorage from "@react-native-async-storage/async-storage";
import { debounce } from "lodash";
import { useEffect, useMemo, useState } from "react";
import { useSpeech } from "../context/SpeechContext";
import {
  calculateX01BotTurnDetails,
  getBotDifficultyFromName,
} from "../lib/bot";
import { BOGEY_NUMBERS, IMPOSSIBLE_SCORES } from "../lib/gameUtils";
import {
  generateMatchStats,
  LegLog,
  Match,
  PlayerMatchStats,
} from "../lib/statsUtils";
import { useMatchStore } from "../store/useMatchStore";
import { useBotDelay } from "./useBotDelay";
import { useBotTurn } from "./useBotTurn";

type X01Settings = {
  startingPoints: number;
  targetLegs: number;
  targetSets: number;
  inRule?: "straight" | "double" | "master";
  outRule?: "straight" | "double" | "master";
  name?: string;
};

export function useX01Match(
  match: Match,
  settings: X01Settings,
  isFormatLoaded: boolean,
  callbacks: {
    showUndoConfirm: (playerName: string, onUndo: () => void) => void;
    showInvalidScoreAlert: () => void;
  },
) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [starterId, setStarterId] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState("");

  const [p1Score, setP1Score] = useState({ sets: 0, legs: 0 });
  const [p2Score, setP2Score] = useState({ sets: 0, legs: 0 });
  const [p1Throws, setP1Throws] = useState<string[]>([]);
  const [p2Throws, setP2Throws] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);

  const [legsHistory, setLegsHistory] = useState<LegLog[]>([]);
  const [p1DoubleAttempts, setP1DoubleAttempts] = useState(0);
  const [p2DoubleAttempts, setP2DoubleAttempts] = useState(0);

  const [p1DoubleThrows, setP1DoubleThrows] = useState<number[]>([]);
  const [p2DoubleThrows, setP2DoubleThrows] = useState<number[]>([]);

  const [showDoublePrompt, setShowDoublePrompt] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<{
    isP1: boolean;
    score: number;
    newLeft: number;
    isBust: boolean;
    currentLeft: number;
  } | null>(null);

  const { speak } = useSpeech();

  const saveMatch = useMatchStore((state) => state.saveMatch);
  const clearMatch = useMatchStore((state) => state.clearMatch);
  const savedData = useMatchStore((state) => state.matches[match?.id]);
  const hasHydrated = useMatchStore.persist.hasHydrated();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const { isFastBot, delay } = useBotDelay(isUndoing, 1500);

  const debouncedSaveMatch = useMemo(
    () =>
      debounce(
        (id: string, data: Parameters<typeof saveMatch>[1]) =>
          saveMatch(id, data),
        500,
      ),
    [saveMatch],
  );

  useEffect(() => {
    return () => {
      debouncedSaveMatch.flush();
    };
  }, [debouncedSaveMatch]);

  const p1PrevTurns = useMemo(() => {
    return legsHistory.reduce(
      (acc, leg) => acc + (leg.p1Throws || []).length,
      0,
    );
  }, [legsHistory]);

  const p2PrevTurns = useMemo(() => {
    return legsHistory.reduce(
      (acc, leg) => acc + (leg.p2Throws || []).length,
      0,
    );
  }, [legsHistory]);

  const p1ActiveMember = useMemo(() => {
    if (!match?.player1?.isTeam || !match?.player1?.members) return null;
    const totalTurns = p1PrevTurns + p1Throws.length;
    return match.player1.members[totalTurns % match.player1.members.length];
  }, [match, p1Throws.length, p1PrevTurns]);

  const p2ActiveMember = useMemo(() => {
    if (!match?.player2?.isTeam || !match?.player2?.members) return null;
    const totalTurns = p2PrevTurns + p2Throws.length;
    return match.player2.members[totalTurns % match.player2.members.length];
  }, [match, p2Throws.length, p2PrevTurns]);

  useEffect(() => {
    if (hasHydrated && !isLoaded) {
      if (savedData) {
        setP1Score(savedData.p1Score);
        setP2Score(savedData.p2Score);
        setP1Throws(savedData.p1Throws);
        setP2Throws(savedData.p2Throws);
        setActivePlayerId(savedData.activePlayerId);
        setStarterId(savedData.starterId);
        setLegsHistory(savedData.legsHistory || []);
        setP1DoubleAttempts(savedData.p1DoubleAttempts || 0);
        setP2DoubleAttempts(savedData.p2DoubleAttempts || 0);
        setP1DoubleThrows(savedData.p1DoubleThrows || []);
        setP2DoubleThrows(savedData.p2DoubleThrows || []);
      } else if (match) {
        setActivePlayerId(match.player1?.id || null);
        setStarterId(match.player1?.id || null);
      }
      setIsLoaded(true);
    }
  }, [hasHydrated, isLoaded, savedData, match]);

  useEffect(() => {
    if (isLoaded && match && !winner && isFormatLoaded) {
      debouncedSaveMatch(match.id, {
        p1Score,
        p2Score,
        p1Throws,
        p2Throws,
        activePlayerId,
        starterId,
        legsHistory,
        p1DoubleAttempts,
        p2DoubleAttempts,
        p1DoubleThrows,
        p2DoubleThrows,
      });
    }
  }, [
    p1Score,
    p2Score,
    p1Throws,
    p2Throws,
    activePlayerId,
    starterId,
    legsHistory,
    p1DoubleAttempts,
    p2DoubleAttempts,
    p1DoubleThrows,
    p2DoubleThrows,
    isFormatLoaded,
    isLoaded,
    match,
    winner,
    debouncedSaveMatch,
  ]);

  const isP1 = activePlayerId === match?.player1?.id;
  const activeName = isP1 ? match?.player1?.name : match?.player2?.name;
  const botAvg = activeName ? getBotDifficultyFromName(activeName) : null;

  useBotTurn({
    condition:
      !winner && !showDoublePrompt && !!match && isLoaded && !isUndoing,
    botAvg,
    delay,
    historyLength: (isP1 ? p1Throws : p2Throws).length,
    calculate: () => {
      const currentLeft =
        settings.startingPoints -
        (isP1 ? p1Throws : p2Throws).reduce(
          (a: number, b: string) => a + (b === "BUST" ? 0 : parseInt(b)),
          0,
        );
      const outRule = settings.outRule || "double";
      const inRule = settings.inRule || "straight";
      const hasOpened =
        inRule === "straight" ||
        (isP1 ? p1Throws : p2Throws).some(
          (t: string) => t !== "BUST" && parseInt(t) > 0,
        );
      const details = calculateX01BotTurnDetails(
        botAvg!,
        currentLeft,
        hasOpened,
        inRule,
        outRule,
        0,
      );
      return {
        botScore: details.botScore,
        newLeft: details.newLeft,
        isBust: details.isBust,
        dartsAtDouble: details.dartsAtDouble,
      };
    },
    execute: ({ botScore, newLeft, isBust, dartsAtDouble }) => {
      processTurn(isP1, botScore, newLeft, isBust, dartsAtDouble);
    },
  });

  const handleKeyPress = (val: string) => {
    if (currentInput.length < 3 && !winner)
      setCurrentInput((prev: string) => prev + val);
  };

  const handleDelete = () => {
    if (winner || currentInput.length > 0) {
      setCurrentInput((prev: string) => prev.slice(0, -1));
      return;
    }
    const isP1 = activePlayerId === match?.player1?.id;
    const targetName = isP1
      ? p2Throws.length > 0
        ? match.player2?.name
        : match.player1?.name
      : p1Throws.length > 0
        ? match.player1?.name
        : "";
    const targetId =
      (isP1
        ? p2Throws.length > 0
          ? match.player2?.id
          : match.player1?.id
        : match.player1?.id) || null;

    if (targetName) {
      callbacks.showUndoConfirm(targetName, () => {
        setIsUndoing(true);
        if (targetId === match.player1?.id) {
          setP1Throws((v: string[]) => v.slice(0, -1));
          setP1DoubleAttempts((v: number) =>
            Math.max(0, v - (p1DoubleThrows[p1DoubleThrows.length - 1] || 0)),
          );
          setP1DoubleThrows((v: number[]) => v.slice(0, -1));
        } else {
          setP2Throws((v: string[]) => v.slice(0, -1));
          setP2DoubleAttempts((v: number) =>
            Math.max(0, v - (p2DoubleThrows[p2DoubleThrows.length - 1] || 0)),
          );
          setP2DoubleThrows((v: number[]) => v.slice(0, -1));
        }
        setActivePlayerId(targetId);
      });
    }
  };

  const handleEnter = () => {
    if (!currentInput || winner) return;
    const score = parseInt(currentInput);

    if (score > 180 || IMPOSSIBLE_SCORES.includes(score)) {
      callbacks.showInvalidScoreAlert();
      setCurrentInput("");
      return;
    }

    const isP1 = activePlayerId === match.player1?.id;
    const currentLeft =
      settings.startingPoints -
      (isP1 ? p1Throws : p2Throws).reduce(
        (a, b) => a + (b === "BUST" ? 0 : parseInt(b)),
        0,
      );
    const newLeft = currentLeft - score;

    const isCheckoutSetup =
      currentLeft <= 170 && !BOGEY_NUMBERS.includes(currentLeft);
    const isBust =
      newLeft < 0 || newLeft === 1 || (newLeft === 0 && !isCheckoutSetup);

    const couldHaveThrownDouble = isCheckoutSetup && (newLeft <= 50 || isBust);

    if (couldHaveThrownDouble) {
      if (score === 0 && (currentLeft <= 40 || currentLeft === 50)) {
        processTurn(isP1, score, newLeft, isBust, 3);
      } else {
        setPendingTurn({ isP1, score, newLeft, isBust, currentLeft });
        setShowDoublePrompt(true);
      }
    } else {
      processTurn(isP1, score, newLeft, isBust, 0);
    }
  };

  const processTurn = (
    isP1: boolean,
    score: number,
    newLeft: number,
    isBust: boolean,
    dartsAtDouble: number,
  ) => {
    setIsUndoing(false);
    speak(isBust ? "0" : score.toString());

    if (isP1) {
      setP1DoubleAttempts((v: number) => v + dartsAtDouble);
      setP1DoubleThrows((v: number[]) => [...v, dartsAtDouble]);
    } else {
      setP2DoubleAttempts((v: number) => v + dartsAtDouble);
      setP2DoubleThrows((v: number[]) => [...v, dartsAtDouble]);
    }

    if (newLeft === 0 && !isBust) {
      handleWinLeg(isP1, score.toString(), dartsAtDouble);
    } else {
      let result = score.toString();
      if (isBust) result = "BUST";

      if (isP1) {
        setP1Throws([...p1Throws, result]);
        if (match.player2) setActivePlayerId(match.player2.id);
      } else {
        setP2Throws([...p2Throws, result]);
        setActivePlayerId(match.player1?.id || null);
      }
      setCurrentInput("");
    }
    setShowDoublePrompt(false);
    setPendingTurn(null);
  };

  const handleWinLeg = async (
    isP1: boolean,
    winningThrowStr: string,
    winningDartsAtDouble: number,
  ) => {
    let mWinner = null;
    let mWinnerObj: PlayerMatchStats | undefined = undefined;
    const f1 = isP1 ? [...p1Throws, winningThrowStr] : p1Throws;
    const f2 = !isP1 ? [...p2Throws, winningThrowStr] : p2Throws;
    const newHistory = [
      ...legsHistory,
      {
        p1Throws: f1,
        p2Throws: f2,
        winnerId: isP1 ? match.player1?.id : match.player2?.id,
        starterId: starterId || undefined,
      },
    ];
    setLegsHistory(newHistory);

    let nSet1 = p1Score.sets,
      nLeg1 = p1Score.legs,
      nSet2 = p2Score.sets,
      nLeg2 = p2Score.legs;

    if (isP1) {
      nLeg1++;
      if (nLeg1 === settings.targetLegs) {
        nSet1++;
        if (nSet1 === settings.targetSets) {
          mWinner = match.player1?.name;
          mWinnerObj = match.player1;
        } else {
          nLeg1 = 0;
          nLeg2 = 0;
        }
      }
      setP1Score({ sets: nSet1, legs: nLeg1 });
      setP2Score({ sets: nSet2, legs: nLeg2 });
    } else {
      nLeg2++;
      if (nLeg2 === settings.targetLegs) {
        nSet2++;
        if (nSet2 === settings.targetSets) {
          mWinner = match.player2?.name;
          mWinnerObj = match.player2;
        } else {
          nLeg2 = 0;
          nLeg1 = 0;
        }
      }
      setP2Score({ sets: nSet2, legs: nLeg2 });
      setP1Score({ sets: nSet1, legs: nLeg1 });
    }

    if (mWinner) {
      setWinner(mWinner);
      try {
        debouncedSaveMatch.cancel();
        clearMatch(match.id);
        const bKey = `bracket_structure_${settings.name?.replace(/\s/g, "_")}`;
        const bStr = await AsyncStorage.getItem(bKey);
        if (bStr) {
          const bracket: Match[] = JSON.parse(bStr);
          const idx = bracket.findIndex((m: Match) => m.id === match.id);
          if (idx > -1) {
            bracket[idx].winner = mWinnerObj;
            bracket[idx].score = {
              p1Sets: nSet1,
              p1Legs: nLeg1,
              p2Sets: nSet2,
              p2Legs: nLeg2,
            };
            const totalP1Att =
              p1DoubleAttempts + (isP1 ? winningDartsAtDouble : 0);
            const totalP2Att =
              p2DoubleAttempts + (!isP1 ? winningDartsAtDouble : 0);
            bracket[idx].stats = generateMatchStats(
              match,
              newHistory,
              totalP1Att,
              totalP2Att,
            );
            bracket[idx].logs = newHistory;

            const nextId = bracket[idx].nextMatchId;
            if (nextId) {
              const nIdx = bracket.findIndex((m: Match) => m.id === nextId);
              if (nIdx > -1) {
                if (bracket[idx].nextMatchSlot === "p1")
                  bracket[nIdx].player1 = mWinnerObj;
                else if (bracket[idx].nextMatchSlot === "p2")
                  bracket[nIdx].player2 = mWinnerObj;
                else {
                  if ((bracket[idx].matchIndex || 0) % 2 === 0)
                    bracket[nIdx].player1 = mWinnerObj;
                  else bracket[nIdx].player2 = mWinnerObj;
                }
              }
            }

            const dropId = bracket[idx].loserDropMatchId;
            if (dropId) {
              const dIdx = bracket.findIndex((m: Match) => m.id === dropId);
              if (dIdx > -1) {
                const mLoserObj = isP1 ? match.player2 : match.player1;
                if (bracket[idx].loserDropSlot === "p1")
                  bracket[dIdx].player1 = mLoserObj;
                else bracket[dIdx].player2 = mLoserObj;
              }
            }

            if (bracket[idx].bracket === "gf" && bracket[idx].round === 1) {
              const gfM1 = bracket.find(
                (x: Match) => x.bracket === "gf" && x.round === 2,
              );
              if (gfM1) {
                if (mWinnerObj?.id === bracket[idx].player1?.id) {
                  gfM1.isBye = true;
                  gfM1.winner = mWinnerObj;
                } else {
                  gfM1.player1 = bracket[idx].player1;
                  gfM1.player2 = bracket[idx].player2;
                }
              }
            }

            const totalR = Math.max(...bracket.map((m: Match) => m.round || 0));
            if (bracket[idx].round === totalR - 1) {
              const loser = isP1 ? match.player2 : match.player1;
              const tpIdx = bracket.findIndex((m: Match) => m.isThirdPlace);
              if (tpIdx > -1) {
                if ((bracket[idx].matchIndex || 0) % 2 === 0)
                  bracket[tpIdx].player1 = loser;
                else bracket[tpIdx].player2 = loser;
              }
            }
            await AsyncStorage.setItem(bKey, JSON.stringify(bracket));
          }
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setP1Throws([]);
      setP2Throws([]);
      setP1DoubleThrows([]);
      setP2DoubleThrows([]);
      const nStart =
        starterId === match.player1?.id
          ? match.player2?.id || null
          : match.player1?.id || null;
      setStarterId(nStart);
      setActivePlayerId(nStart);
      setCurrentInput("");
    }
  };

  return {
    activePlayerId,
    currentInput,
    p1Score,
    p2Score,
    p1Throws,
    p2Throws,
    winner,
    showDoublePrompt,
    pendingTurn,
    p1ActiveMember,
    p2ActiveMember,
    handleKeyPress,
    handleDelete,
    handleEnter,
    processTurn,
  };
}
