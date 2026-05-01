import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import { View } from "react-native";

import { GameProvider } from "../context/GameContext";
import { HapticsProvider } from "../context/HapticsContext";
import { LanguageProvider } from "../context/LanguageContext";
import { PlayersProvider } from "../context/PlayersContext";
import { SpeechProvider } from "../context/SpeechContext";
import { TerminologyProvider } from "../context/TerminologyContext";
import { ThemeProvider } from "../context/ThemeContext";

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  return (
    <View style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <SpeechProvider>
            <TerminologyProvider>
              <PlayersProvider>
                <GameProvider>
                  <HapticsProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="tournament" />
                    </Stack>
                  </HapticsProvider>
                </GameProvider>
              </PlayersProvider>
            </TerminologyProvider>
          </SpeechProvider>
        </LanguageProvider>
      </ThemeProvider>
    </View>
  );
}
