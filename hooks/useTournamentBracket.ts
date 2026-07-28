import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { t } from "../lib/i18n";
import { advanceBracketAfterMatchWin } from "../lib/bracketAdvancement";
import { TournamentSettings } from "../lib/statsUtils";
import { useMatchStore } from "../store/useMatchStore";
import {
  SharedMatch as Match,
  SharedPlayer as Player,
} from "../components/tournament/MatchCard";

export interface ResetAlertState {
  visible: boolean;
  matchId: string;
}

export interface WalkoverAlertState {
  visible: boolean;
  matchId: string;
}

export interface UseTournamentBracketOptions {
  settings: TournamentSettings;
  players: Player[];
  language: Parameters<typeof t>[0];
  initialBracket?: Match[] | null;
  isReadOnly?: boolean;
  isHost?: boolean;
  onBracketGenerated?: (bracket: Match[]) => void | Promise<void>;

  generateBracket: (
    persistMatches: (newMatches: Match[]) => Promise<void>,
  ) => void | Promise<void>;
  onMatchesLoaded?: (
    matches: Match[],
    persistMatches: (newMatches: Match[]) => Promise<void>,
    source: "initial" | "focus",
  ) => void | Promise<void>;
}

export interface UseTournamentBracketResult {
  matches: Match[];
  setMatches: Dispatch<SetStateAction<Match[]>>;
  inProgressMatches: Record<string, boolean>;
  setInProgressMatches: Dispatch<SetStateAction<Record<string, boolean>>>;
  resetAlert: ResetAlertState;
  requestReset: (matchId: string) => void;
  cancelReset: () => void;
  performResetMatch: () => Promise<void>;
  walkoverAlert: WalkoverAlertState;
  requestWalkover: (matchId: string) => void;
  cancelWalkover: () => void;
  performWalkover: (forfeitingPlayerId: string) => Promise<void>;
  bracketStorageKey: string;
  persistMatches: (newMatches: Match[]) => Promise<void>;
  markMatchInProgress: (matchId: string) => Promise<Match[]>;
}

export function useTournamentBracket({
  settings,
  players,
  language,
  initialBracket = null,
  isReadOnly = false,
  isHost = true,
  onBracketGenerated,
  generateBracket,
  onMatchesLoaded,
}: UseTournamentBracketOptions): UseTournamentBracketResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [inProgressMatches, setInProgressMatches] = useState<
    Record<string, boolean>
  >({});
  const [resetAlert, setResetAlert] = useState<ResetAlertState>({
    visible: false,
    matchId: "",
  });
  const [walkoverAlert, setWalkoverAlert] = useState<WalkoverAlertState>({
    visible: false,
    matchId: "",
  });

  const bracketStorageKey = `bracket_structure_${String(settings?.name || "").replace(/\s/g, "_")}`;

  const loadProgressFor = useCallback(async (currentMatches: Match[]) => {
    const progressObj: Record<string, boolean> = {};
    for (const m of currentMatches) {
      const savedScore = await AsyncStorage.getItem(`match_save_${m.id}`);
      if (savedScore) progressObj[m.id] = true;
    }
    return progressObj;
  }, []);

  useEffect(() => {
    if (initialBracket) {
      setMatches(initialBracket);
      (async () => {
        await onMatchesLoaded?.(initialBracket, persistMatches, "initial");
        setInProgressMatches(await loadProgressFor(initialBracket));
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBracket]);

  useFocusEffect(
    useCallback(() => {
      const loadTournamentState = async () => {
        try {
          let currentMatches: Match[] = [];
          if (initialBracket) {
            currentMatches = initialBracket;
            setMatches(currentMatches);
            await onMatchesLoaded?.(currentMatches, persistMatches, "focus");
          } else {
            const savedBracketStr =
              await AsyncStorage.getItem(bracketStorageKey);
            if (savedBracketStr) {
              currentMatches = JSON.parse(savedBracketStr) as Match[];
              setMatches(currentMatches);
              await onMatchesLoaded?.(currentMatches, persistMatches, "focus");
            } else if (players.length > 0 && !isReadOnly && isHost) {
              await generateBracket(persistMatches);
              return;
            } else {
              return;
            }
          }

          setInProgressMatches(await loadProgressFor(currentMatches));
        } catch (e) {
          console.error(e);
        }
      };
      loadTournamentState();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players, initialBracket, isReadOnly]),
  );

  const persistMatches = useCallback(
    async (newMatches: Match[]) => {
      setMatches(newMatches);
      await AsyncStorage.setItem(
        bracketStorageKey,
        JSON.stringify(newMatches),
      );
      if (onBracketGenerated) await onBracketGenerated(newMatches);
    },
    [bracketStorageKey, onBracketGenerated],
  );

  const requestReset = useCallback((matchId: string) => {
    setResetAlert({ visible: true, matchId });
  }, []);

  const cancelReset = useCallback(() => {
    setResetAlert({ visible: false, matchId: "" });
  }, []);

  const performResetMatch = useCallback(async () => {
    if (!resetAlert.matchId) return;
    try {
      await AsyncStorage.removeItem(`match_save_${resetAlert.matchId}`);
      useMatchStore.getState().clearMultipleMatches([resetAlert.matchId]);
      setInProgressMatches((prev: Record<string, boolean>) => {
        const updated = { ...prev };
        delete updated[resetAlert.matchId];
        return updated;
      });

      const newMatches = matches.map((m) => {
        if (m.id === resetAlert.matchId) {
          const {
            score,
            gameState,
            inProgressDeviceName,
            inProgressDeviceId,
            ...rest
          } = m;
          return { ...rest, isInProgress: false, hasProgress: false };
        }
        return m;
      });
      await persistMatches(newMatches);
    } catch (e) {
      console.error(
        t(language, "resetMatchError"),
        e,
      );
    }
    setResetAlert({ visible: false, matchId: "" });
  }, [resetAlert.matchId, matches, persistMatches, language]);

  const requestWalkover = useCallback((matchId: string) => {
    setWalkoverAlert({ visible: true, matchId });
  }, []);

  const cancelWalkover = useCallback(() => {
    setWalkoverAlert({ visible: false, matchId: "" });
  }, []);

  const performWalkover = useCallback(
    async (forfeitingPlayerId: string) => {
      const matchId = walkoverAlert.matchId;
      if (!matchId) return;
      const target = matches.find((m) => m.id === matchId);
      if (!target) {
        setWalkoverAlert({ visible: false, matchId: "" });
        return;
      }

      const loser =
        target.player1?.id === forfeitingPlayerId
          ? target.player1
          : target.player2?.id === forfeitingPlayerId
            ? target.player2
            : null;
      const winner =
        loser === target.player1 ? target.player2 : target.player1;

      if (!winner || !loser) {
        setWalkoverAlert({ visible: false, matchId: "" });
        return;
      }

      try {
        await AsyncStorage.removeItem(`match_save_${matchId}`);
        useMatchStore.getState().clearMultipleMatches([matchId]);
      } catch (e) {
        console.error(e);
      }

      const newMatches: Match[] = matches.map((m) => ({ ...m }));
      const idx = newMatches.findIndex((m) => m.id === matchId);
      if (idx > -1) {
        newMatches[idx].isWalkover = true;
        newMatches[idx].forfeitWinnerId = winner.id;
        newMatches[idx].isInProgress = false;
        newMatches[idx].inProgressDeviceName = null;
        newMatches[idx].inProgressDeviceId = null;
        newMatches[idx].hasProgress = false;
        delete newMatches[idx].score;
        delete newMatches[idx].gameState;
      }
      advanceBracketAfterMatchWin(newMatches, matchId, winner, loser);

      setInProgressMatches((prev: Record<string, boolean>) => {
        const updated = { ...prev };
        delete updated[matchId];
        return updated;
      });

      await persistMatches(newMatches);
      setWalkoverAlert({ visible: false, matchId: "" });
    },
    [walkoverAlert.matchId, matches, persistMatches],
  );

  const markMatchInProgress = useCallback(
    async (matchId: string) => {
      const dName =
        (await AsyncStorage.getItem("@device_name")) || "Unknown Device";
      const dId = (await AsyncStorage.getItem("@device_id")) || "Unknown ID";
      const updatedMatches = matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              isInProgress: true,
              inProgressDeviceName: dName,
              inProgressDeviceId: dId,
            }
          : m,
      );
      await persistMatches(updatedMatches);
      await AsyncStorage.setItem("@bracket_needs_sync", "true");
      return updatedMatches;
    },
    [matches, persistMatches],
  );

  return {
    matches,
    setMatches,
    inProgressMatches,
    setInProgressMatches,
    resetAlert,
    requestReset,
    cancelReset,
    performResetMatch,
    walkoverAlert,
    requestWalkover,
    cancelWalkover,
    performWalkover,
    bracketStorageKey,
    persistMatches,
    markMatchInProgress,
  };
}
