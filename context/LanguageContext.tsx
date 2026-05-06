import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Lang, availableLanguages } from "../lib/i18n";

type LanguageContextType = {
  language: Lang;
  changeLanguage: (lang: Lang) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("lang");
      if (saved && availableLanguages.includes(saved as Lang)) {
        setLanguage(saved as Lang);
      }
    })();
  }, []);

  const changeLanguage = useCallback(async (lang: Lang) => {
    setLanguage(lang);
    await AsyncStorage.setItem("lang", lang).catch(console.error);
  }, []);

  const value = useMemo(
    () => ({ language, changeLanguage }),
    [language, changeLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
