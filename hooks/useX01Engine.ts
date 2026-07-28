import { useCallback, useState } from "react";

import { getCheckoutInfo } from "../lib/checkouts";
import { BOGEY_NUMBERS, DOUBLE_ATTEMPT_BOGEY_NUMBERS } from "../lib/gameUtils";

export type X01OutRule = "straight" | "double" | "master";

export interface X01Throw {
  value: number;
  multiplier: number;
  darts?: number;
  isScoreInput?: boolean;
  coords?: { x: number; y: number };
}

export interface PendingX01Turn {
  score: number;
  newLeft: number;
  isBust: boolean;
  currentLeft: number;
}

export const getDictionaryFormat = (t: X01Throw): string => {
  if (t.value === 25 && t.multiplier === 2) return "BULL";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};

export interface CheckoutSuggestionParams {
  score: number;
  roundStartScore: number;
  throwsThisTurn: number;
  turnThrows: readonly X01Throw[] | undefined;
  dartsRemaining: number;
}

export function getCheckoutSuggestion({
  score,
  roundStartScore,
  throwsThisTurn,
  turnThrows,
  dartsRemaining,
}: CheckoutSuggestionParams): string | null {
  if (throwsThisTurn === 0) {
    return getCheckoutInfo(score);
  }

  const originalCheckoutStr = getCheckoutInfo(roundStartScore);
  if (originalCheckoutStr) {
    const plan = originalCheckoutStr.split(" ");
    let followedPlan = true;
    for (let i = 0; i < (turnThrows?.length || 0); i++) {
      if (getDictionaryFormat(turnThrows![i]) !== plan[i]) {
        followedPlan = false;
        break;
      }
    }
    if (followedPlan) {
      return plan.slice(turnThrows?.length || 0).join(" ");
    }
  }

  const newCheckoutStr = getCheckoutInfo(score);
  if (newCheckoutStr && newCheckoutStr.split(" ").length <= dartsRemaining) {
    return newCheckoutStr;
  }
  return null;
}

export interface ScoreSubmissionEvaluation {
  newLeft: number;
  isCheckoutSetup: boolean;
  isBust: boolean;
  couldHaveThrownDouble: boolean;
}


export function evaluateScoreSubmission(
  currentLeft: number,
  score: number,
  outRule: X01OutRule,
): ScoreSubmissionEvaluation {
  const newLeft = currentLeft - score;
  const isCheckoutSetup =
    currentLeft <= 170 && !BOGEY_NUMBERS.includes(currentLeft);
  const isBust =
    newLeft < 0 ||
    (newLeft === 1 && (outRule === "double" || outRule === "master")) ||
    (newLeft === 0 && outRule !== "straight" && !isCheckoutSetup);

  let couldHaveThrownDouble = false;
  if (outRule === "double" || outRule === "master") {
    couldHaveThrownDouble = isCheckoutSetup && (newLeft <= 50 || isBust);
  }

  return { newLeft, isCheckoutSetup, isBust, couldHaveThrownDouble };
}

export function getMaxDoubleAttemptDarts(
  currentLeft: number,
  dartsAvailable: number = 3,
): number {
  let maxDarts = Math.min(3, dartsAvailable);
  if (
    currentLeft > 110 ||
    DOUBLE_ATTEMPT_BOGEY_NUMBERS.includes(currentLeft)
  ) {
    maxDarts = 1;
  } else if (currentLeft > 50) {
    maxDarts = Math.min(2, maxDarts);
  }
  return maxDarts;
}

export function useX01Engine() {
  const [showDoublePrompt, setShowDoublePrompt] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<PendingX01Turn | null>(null);

  const closeDoublePrompt = useCallback(() => {
    setShowDoublePrompt(false);
    setPendingTurn(null);
  }, []);

  const prepareScoreSubmission = useCallback(
    (
      params: { currentLeft: number; score: number; outRule: X01OutRule },
      onDirectSubmit: (score: number, dartsAtDouble: number, isBust: boolean) => void,
    ) => {
      const { newLeft, isBust, couldHaveThrownDouble } = evaluateScoreSubmission(
        params.currentLeft,
        params.score,
        params.outRule,
      );

      if (couldHaveThrownDouble) {
        setPendingTurn({
          score: params.score,
          newLeft,
          isBust,
          currentLeft: params.currentLeft,
        });
        setShowDoublePrompt(true);
      } else {
        onDirectSubmit(params.score, 0, isBust);
      }
    },
    [],
  );

  return {
    showDoublePrompt,
    pendingTurn,
    prepareScoreSubmission,
    closeDoublePrompt,
  };
}
