import React, { createContext, useContext, useState } from "react";

export type Settings = {
  inRule: "straight" | "double" | "master";
  outRule: "straight" | "double" | "master";
  startPoints: number;
  legs: number;
  sets: number;
  gameMode: "X01" | "Cricket" | "Training";
  cricketMode?: "standard" | "no-score";
  trainingMode?: "around_the_clock" | "100_darts" | "bobs_27";
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
  });

  return (
    <GameContext.Provider
      value={{ players, setPlayers, settings, setSettings }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};
