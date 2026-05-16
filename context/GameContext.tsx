import React, { createContext, useContext, useMemo, useState } from "react";

export type Settings = {
  inRule: "straight" | "double" | "master";
  outRule: "straight" | "double" | "master";
  startPoints: number;
  legs: number;
  sets: number;
  gameMode: "X01" | "Cricket" | "Training";
  cricketMode?: "standard" | "no-score";
  lives?: number;
  killerAssignMode?: "random" | "throw";
  killerMode?: "double" | "treble" | "any";
  killerSelfPenalty?: boolean;
  scoreClashDartsPerRound?: number;
  scoreClashTargetPoints?: number;
  scoreClashTieRule?: "points" | "tiebreaker";
  trainingMode?:
    | "around_the_clock"
    | "100_darts"
    | "bobs_27"
    | "catch_40"
    | "jdc_challenge"
    | "bermuda_triangle"
    | "shanghai"
    | "halve_it"
    | "baseball"
    | "chase_the_dragon"
    | "121_checkout"
    | "killer"
    | "score_clash";
};

type GameContextType = {
  players: string[];
  setPlayers: (players: string[]) => void;
  settings: Settings;
  setSettings: (settings: Settings) => void;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [players, setPlayers] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>({
    inRule: "straight",
    outRule: "double",
    startPoints: 501,
    legs: 1,
    sets: 1,
    gameMode: "X01",
    cricketMode: "standard",
    lives: 3,
    killerAssignMode: "random",
    killerMode: "double",
    killerSelfPenalty: false,
    scoreClashDartsPerRound: 3,
    scoreClashTargetPoints: 3,
    scoreClashTieRule: "points",
  });

  const value = useMemo(
    () => ({ players, setPlayers, settings, setSettings }),
    [players, settings],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};
