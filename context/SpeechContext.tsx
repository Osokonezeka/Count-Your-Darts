import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useLanguage } from "./LanguageContext";

const SPEECH_KEY = "@settings_speech";

type SpeechContextType = {
  isSpeechEnabled: boolean;
  toggleSpeech: () => void;
  speak: (text: string) => void;
};

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

export const SpeechProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedState = await AsyncStorage.getItem(SPEECH_KEY);
        if (savedState !== null) setIsSpeechEnabled(savedState === "true");
      } catch (error) {
        console.error("Błąd podczas ładowania ustawień lektora:", error);
      }
    };
    loadSettings();
  }, []);

  const toggleSpeech = async () => {
    try {
      const newValue = !isSpeechEnabled;
      setIsSpeechEnabled(newValue);
      await AsyncStorage.setItem(SPEECH_KEY, String(newValue));

      if (newValue) {
        Speech.speak(
          language === "pl" ? "Lektor włączony" : "Announcer enabled",
          {
            language: language === "pl" ? "pl-PL" : "en-US",
            pitch: 1.0,
            rate: 1.0,
          },
        );
      } else {
        Speech.stop();
      }
    } catch (error) {}
  };

  const speak = (text: string) => {
    if (!isSpeechEnabled) return;
    Speech.stop();
    Speech.speak(text.toString(), {
      language: language === "pl" ? "pl-PL" : "en-US",
      pitch: 1.0,
      rate: 1.0,
    });
  };

  return (
    <SpeechContext.Provider value={{ isSpeechEnabled, toggleSpeech, speak }}>
      {children}
    </SpeechContext.Provider>
  );
};

export const useSpeech = () => {
  const context = useContext(SpeechContext);
  if (!context) throw new Error("useSpeech must be used within SpeechProvider");
  return context;
};
