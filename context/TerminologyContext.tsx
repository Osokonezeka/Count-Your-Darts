import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type TerminologyContextType = {
  tripleTerm: "Triple" | "Treble";
  missTerm: "0" | "Miss";
  bullTerm: "25" | "Bull";
  setTripleTerm: (val: "Triple" | "Treble") => void;
  setMissTerm: (val: "0" | "Miss") => void;
  setBullTerm: (val: "25" | "Bull") => void;
};

const TerminologyContext = createContext<TerminologyContextType | undefined>(
  undefined,
);

export const TerminologyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tripleTerm, setTripleState] = useState<"Triple" | "Treble">("Triple");
  const [missTerm, setMissState] = useState<"0" | "Miss">("0");
  const [bullTerm, setBullState] = useState<"25" | "Bull">("25");

  useEffect(() => {
    const loadSettings = async () => {
      const [savedTriple, savedMiss, savedBull] = await Promise.all([
        AsyncStorage.getItem("@settings_triple"),
        AsyncStorage.getItem("@settings_miss"),
        AsyncStorage.getItem("@settings_bull"),
      ]);
      if (savedTriple) setTripleState(savedTriple as "Triple" | "Treble");
      if (savedMiss) setMissState(savedMiss as "0" | "Miss");
      if (savedBull) setBullState(savedBull as "25" | "Bull");
    };
    loadSettings();
  }, []);

  const setTripleTerm = (val: "Triple" | "Treble") => {
    setTripleState(val);
    AsyncStorage.setItem("@settings_triple", val);
  };

  const setMissTerm = (val: "0" | "Miss") => {
    setMissState(val);
    AsyncStorage.setItem("@settings_miss", val);
  };

  const setBullTerm = (val: "25" | "Bull") => {
    setBullState(val);
    AsyncStorage.setItem("@settings_bull", val);
  };

  return (
    <TerminologyContext.Provider
      value={{
        tripleTerm,
        missTerm,
        bullTerm,
        setTripleTerm,
        setMissTerm,
        setBullTerm,
      }}
    >
      {children}
    </TerminologyContext.Provider>
  );
};

export const useTerminology = () => {
  const context = useContext(TerminologyContext);
  if (!context)
    throw new Error("useTerminology must be used within TerminologyProvider");
  return context;
};
