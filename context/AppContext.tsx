import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AppContextType = {
  playerName: string;
  updatePlayerName: (name: string) => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("playerName");
      if (saved) setPlayerName(saved);
    })();
  }, []);

  const updatePlayerName = useCallback(async (name: string) => {
    setPlayerName(name);
    await AsyncStorage.setItem("playerName", name).catch(console.error);
  }, []);

  const value = useMemo(
    () => ({ playerName, updatePlayerName }),
    [playerName, updatePlayerName],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
