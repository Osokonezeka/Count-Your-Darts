import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Lang, availableLanguages } from "../lib/i18n";

const LanguageContext = createContext<any>(null);

export function LanguageProvider({ children }: any) {
  const [language, setLanguage] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("lang");
      if (saved && availableLanguages.includes(saved as Lang)) {
        setLanguage(saved as Lang);
      }
    })();
  }, []);

  const changeLanguage = async (lang: Lang) => {
    setLanguage(lang);
    await AsyncStorage.setItem("lang", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
