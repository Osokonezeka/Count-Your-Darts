import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const PLAYERS_STORAGE_KEY = "@dart_players_db";

type PlayersContextType = {
  players: string[];
  isPlayersLoaded: boolean;
  addPlayer: (name: string) => void;
  removePlayer: (name: string) => void;
  updatePlayer: (oldName: string, newName: string) => void;
};

const PlayersContext = createContext<PlayersContextType | undefined>(undefined);

export const PlayersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [players, setPlayers] = useState<string[]>([]);
  const [isPlayersLoaded, setIsPlayersLoaded] = useState(false);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const saved = await AsyncStorage.getItem(PLAYERS_STORAGE_KEY);
        if (saved !== null) {
          setPlayers(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Błąd ładowania graczy:", error);
      } finally {
        setIsPlayersLoaded(true);
      }
    };
    loadPlayers();
  }, []);

  const addPlayer = useCallback((name: string) => {
    setPlayers((prev) => {
      const trimmedName = name.trim();
      if (!trimmedName || prev.includes(trimmedName)) return prev;
      const newPlayers = [...prev, trimmedName];
      AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(newPlayers),
      ).catch((e) => console.error("Błąd zapisu gracza:", e));
      return newPlayers;
    });
  }, []);

  const removePlayer = useCallback((name: string) => {
    setPlayers((prev) => {
      const newPlayers = prev.filter((p) => p !== name);
      AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(newPlayers),
      ).catch((e) => console.error("Błąd usuwania gracza:", e));
      return newPlayers;
    });
  }, []);

  const updatePlayer = useCallback((oldName: string, newName: string) => {
    setPlayers((prev) => {
      const trimmedNewName = newName.trim();
      if (
        !trimmedNewName ||
        prev.includes(trimmedNewName) ||
        oldName === trimmedNewName
      )
        return prev;
      const newPlayers = prev.map((p) => (p === oldName ? trimmedNewName : p));
      AsyncStorage.setItem(
        PLAYERS_STORAGE_KEY,
        JSON.stringify(newPlayers),
      ).catch((e) => console.error("Błąd aktualizacji gracza:", e));
      return newPlayers;
    });
  }, []);

  const value = useMemo(
    () => ({
      players,
      isPlayersLoaded,
      addPlayer,
      removePlayer,
      updatePlayer,
    }),
    [players, isPlayersLoaded, addPlayer, removePlayer, updatePlayer],
  );

  return (
    <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>
  );
};

export const usePlayers = () => {
  const context = useContext(PlayersContext);
  if (!context)
    throw new Error("usePlayers must be used within PlayersProvider");
  return context;
};
