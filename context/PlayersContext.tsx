import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PLAYERS_STORAGE_KEY = "@dart_players_db";

type PlayersContextType = {
  players: string[];
  addPlayer: (name: string) => void;
  removePlayer: (name: string) => void;
  updatePlayer: (oldName: string, newName: string) => void;
};

const PlayersContext = createContext<PlayersContextType | undefined>(undefined);

export const PlayersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const saved = await AsyncStorage.getItem(PLAYERS_STORAGE_KEY);
        if (saved !== null) {
          setPlayers(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Błąd ładowania graczy:", error);
      }
    };
    loadPlayers();
  }, []);

  const addPlayer = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || players.includes(trimmedName)) return;

    const newPlayers = [...players, trimmedName];
    setPlayers(newPlayers);
    try {
      await AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(newPlayers),
      );
    } catch (error) {
      console.error("Błąd zapisu gracza:", error);
    }
  };

  const removePlayer = async (name: string) => {
    const newPlayers = players.filter((p) => p !== name);
    setPlayers(newPlayers);
    try {
      await AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(newPlayers),
      );
    } catch (error) {
      console.error("Błąd usuwania gracza:", error);
    }
  };

  const updatePlayer = async (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (
      !trimmedNewName ||
      players.includes(trimmedNewName) ||
      oldName === trimmedNewName
    )
      return;

    const newPlayers = players.map((p) => (p === oldName ? trimmedNewName : p));
    setPlayers(newPlayers);
    try {
      await AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(newPlayers),
      );
    } catch (error) {
      console.error("Błąd aktualizacji gracza:", error);
    }
  };

  return (
    <PlayersContext.Provider
      value={{ players, addPlayer, removePlayer, updatePlayer }}
    >
      {children}
    </PlayersContext.Provider>
  );
};

export const usePlayers = () => {
  const context = useContext(PlayersContext);
  if (!context)
    throw new Error("usePlayers must be used within PlayersProvider");
  return context;
};
