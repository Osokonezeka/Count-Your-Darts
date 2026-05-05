import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const updatePlayerName = async (name: string) => {
    setPlayerName(name);
    await AsyncStorage.setItem("playerName", name);
  };

  return (
    <AppContext.Provider value={{ playerName, updatePlayerName }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
