import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AppContext = createContext<any>(null);

export function AppProvider({ children }: any) {
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

export const useApp = () => useContext(AppContext);
