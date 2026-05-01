import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import React from "react";
import { useTheme } from "../../context/ThemeContext";

export default function TournamentLayout() {
  const { theme, themeMode } = useTheme();
  const systemColorScheme = useColorScheme();
  const resolvedTheme =
    themeMode === "auto" ? systemColorScheme || "light" : themeMode;

  const statusBarStyle = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <>
      <StatusBar style={statusBarStyle} backgroundColor={theme.colors.card} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        }}
      />
    </>
  );
}
