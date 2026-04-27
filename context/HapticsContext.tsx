import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { createContext, useContext, useEffect, useState } from "react";

const HAPTICS_KEY = "@settings_haptics";
const HAPTICS_INTENSITY_KEY = "@settings_haptics_intensity";

export type HapticIntensity = "light" | "medium" | "heavy";

type HapticsContextType = {
  isHapticsEnabled: boolean;
  toggleHaptics: () => void;
  intensity: HapticIntensity;
  setIntensity: (level: HapticIntensity) => void;
  triggerHaptic: (type: "tap" | "heavy" | "success") => void;
};

const HapticsContext = createContext<HapticsContextType | undefined>(undefined);

export const HapticsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [intensity, setIntensityState] = useState<HapticIntensity>("medium");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedState = await AsyncStorage.getItem(HAPTICS_KEY);
        const savedIntensity = await AsyncStorage.getItem(
          HAPTICS_INTENSITY_KEY,
        );

        if (savedState !== null) setIsHapticsEnabled(savedState === "true");
        if (savedIntensity !== null)
          setIntensityState(savedIntensity as HapticIntensity);
      } catch (error) {
        console.error("Błąd podczas ładowania ustawień haptyki:", error);
      }
    };
    loadSettings();
  }, []);

  const toggleHaptics = async () => {
    try {
      const newValue = !isHapticsEnabled;
      setIsHapticsEnabled(newValue);
      await AsyncStorage.setItem(HAPTICS_KEY, String(newValue));

      if (newValue) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error("Błąd podczas zapisywania włącznika haptyki:", error);
    }
  };

  const setIntensity = async (level: HapticIntensity) => {
    try {
      setIntensityState(level);
      await AsyncStorage.setItem(HAPTICS_INTENSITY_KEY, level);

      const style =
        level === "light"
          ? Haptics.ImpactFeedbackStyle.Light
          : level === "medium"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Heavy;
      Haptics.impactAsync(style);
    } catch (error) {
      console.error("Błąd podczas zapisywania intensywności haptyki:", error);
    }
  };

  const triggerHaptic = (type: "tap" | "heavy" | "success") => {
    if (!isHapticsEnabled) return;

    try {
      switch (type) {
        case "tap":
          const style =
            intensity === "light"
              ? Haptics.ImpactFeedbackStyle.Light
              : intensity === "medium"
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Heavy;
          Haptics.impactAsync(style);
          break;
        case "heavy":
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case "success":
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }
    } catch (error) {}
  };

  return (
    <HapticsContext.Provider
      value={{
        isHapticsEnabled,
        toggleHaptics,
        intensity,
        setIntensity,
        triggerHaptic,
      }}
    >
      {children}
    </HapticsContext.Provider>
  );
};

export const useHaptics = () => {
  const context = useContext(HapticsContext);
  if (!context)
    throw new Error("useHaptics must be used within HapticsProvider");
  return context;
};
