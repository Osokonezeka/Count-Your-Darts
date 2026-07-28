import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

const MATCH_HISTORY_KEY = "@dart_match_history";

export interface MatchHistoryPlayerBase {
  name: string;
  [key: string]: unknown;
}

export interface MatchHistoryItem<
  TGameState = unknown,
  TSettings = unknown,
  TPlayer extends MatchHistoryPlayerBase = MatchHistoryPlayerBase,
> {
  id: string;
  date: string;
  duration: string;
  mode: string;
  settings?: TSettings;
  isUnfinished: boolean;
  gameState?: TGameState;
  players: TPlayer[];
}

export interface SaveMatchToHistoryParams<
  TGameState = unknown,
  TSettings = unknown,
  TPlayer extends MatchHistoryPlayerBase = MatchHistoryPlayerBase,
> {
  mode: string;
  players: TPlayer[];
  isUnfinished: boolean;
  settings?: TSettings;
  gameState?: TGameState;
  matchTimeSeconds?: number;
  navigateAway?: boolean;
  navigateTo?: Parameters<ReturnType<typeof useRouter>["push"]>[0];
  onError?: (error: unknown) => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export function useMatchLifecycle(matchId: string) {
  const router = useRouter();
  const navigation = useNavigation();

  const isExiting = useRef(false);
  const pendingExitAction =
    useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

  const confirmExit = useCallback(() => {
    isExiting.current = true;
    if (pendingExitAction.current) {
      navigation.dispatch(pendingExitAction.current);
      pendingExitAction.current = null;
    }
  }, [navigation]);

  const saveMatchToHistory = useCallback(
    async <
      TGameState = unknown,
      TSettings = unknown,
      TPlayer extends MatchHistoryPlayerBase = MatchHistoryPlayerBase,
    >(
      params: SaveMatchToHistoryParams<TGameState, TSettings, TPlayer>,
    ): Promise<void> => {
      const {
        mode,
        players,
        isUnfinished,
        settings,
        gameState,
        matchTimeSeconds = 0,
        navigateAway = true,
        navigateTo = "/play",
        onError,
      } = params;

      try {
        if (navigateAway) isExiting.current = true;

        const historyItem: MatchHistoryItem<TGameState, TSettings, TPlayer> = {
          id: matchId,
          date: dayjs().format("DD.MM.YYYY, HH:mm"),
          duration: formatDuration(matchTimeSeconds),
          mode,
          settings,
          isUnfinished,
          gameState: isUnfinished ? gameState : undefined,
          players,
        };

        const existingHistoryStr = await AsyncStorage.getItem(
          MATCH_HISTORY_KEY,
        );
        const existingHistory: MatchHistoryItem[] = existingHistoryStr
          ? JSON.parse(existingHistoryStr)
          : [];

        const existingIndex = existingHistory.findIndex(
          (h) => h.id === matchId,
        );
        if (existingIndex > -1) {
          existingHistory[existingIndex] = historyItem as MatchHistoryItem;
        } else {
          existingHistory.unshift(historyItem as MatchHistoryItem);
        }

        await AsyncStorage.setItem(
          MATCH_HISTORY_KEY,
          JSON.stringify(existingHistory),
        );

        if (navigateAway) router.push(navigateTo);
      } catch (error) {
        console.error(`Error saving match history for mode "${mode}"`, error);
        onError?.(error);
        if (navigateAway) router.push(navigateTo);
      }
    },
    [matchId, router],
  );

  const useExitGuard = (
    isMatchInProgress: boolean,
    onConfirmExit: () => void,
  ): void => {
    useEffect(() => {
      const unsubscribe = navigation.addListener("beforeRemove", (e) => {
        if (isExiting.current) return;

        e.preventDefault();
        pendingExitAction.current = e.data.action;

        if (!isMatchInProgress) {
          confirmExit();
          return;
        }

        onConfirmExit();
      });

      return unsubscribe;
    }, [navigation, confirmExit, isMatchInProgress, onConfirmExit]);
  };

  return {
    matchId,
    isExiting,
    saveMatchToHistory,
    useExitGuard,
    confirmExit,
  };
}

export function pushHistorySnapshot<
  T extends { history: T[]; isUndoing?: boolean },
>(draft: T, snapshot: T): void {
  if (!draft.history) draft.history = [] as unknown as T[];
  draft.history.push({ ...snapshot, history: [] as unknown as T[] });
  draft.isUndoing = false;
}

export function popHistorySnapshot<T extends { history: T[] }>(
  draft: T,
): (T & { isUndoing: true }) | undefined {
  if (!draft.history || draft.history.length === 0) return undefined;
  const prevState = draft.history[draft.history.length - 1];
  return {
    ...prevState,
    history: draft.history.slice(0, -1),
    isUndoing: true,
  };
}
