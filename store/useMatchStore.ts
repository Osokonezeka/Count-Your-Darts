import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MatchData {
  p1Score: { sets: number; legs: number };
  p2Score: { sets: number; legs: number };
  p1Throws: string[];
  p2Throws: string[];
  activePlayerId: string | null;
  starterId: string | null;
  legsHistory: any[];
  p1DoubleAttempts: number;
  p2DoubleAttempts: number;
  p1DoubleThrows: number[];
  p2DoubleThrows: number[];
}

interface MatchStore {
  matches: Record<string, MatchData>;
  saveMatch: (matchId: string, data: MatchData) => void;
  clearMatch: (matchId: string) => void;
  clearMultipleMatches: (matchIds: string[]) => void;
}

export const useMatchStore = create<MatchStore>()(
  persist(
    (set) => ({
      matches: {},
      saveMatch: (matchId, data) =>
        set((state) => ({
          matches: { ...state.matches, [matchId]: data },
        })),
      clearMatch: (matchId) =>
        set((state) => {
          const newMatches = { ...state.matches };
          delete newMatches[matchId];
          return { matches: newMatches };
        }),
      clearMultipleMatches: (matchIds) =>
        set((state) => {
          const newMatches = { ...state.matches };
          matchIds.forEach((id) => delete newMatches[id]);
          return { matches: newMatches };
        }),
    }),
    {
      name: "dart-match-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
