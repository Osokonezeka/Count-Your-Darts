import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, useColorScheme, View } from "react-native";
import { darkTheme, lightTheme, sizes } from "../lib/theme";

const THEME_KEY = "@settings_theme";
type ThemeMode = "light" | "dark" | "auto";

type ThemeContextType = {
  themeMode: ThemeMode;
  theme: { colors: typeof lightTheme; sizes: typeof sizes };
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeState] = useState<ThemeMode>("auto");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [prevBgColor, setPrevBgColor] = useState<string | null>(null);

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (
        savedTheme === "dark" ||
        savedTheme === "light" ||
        savedTheme === "auto"
      ) {
        setThemeState(savedTheme as ThemeMode);
      }
    };
    loadTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    const currentResolved =
      themeMode === "auto" ? systemColorScheme || "light" : themeMode;
    setPrevBgColor(
      currentResolved === "dark" ? darkTheme.background : lightTheme.background,
    );

    setThemeState(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
  };

  const resolvedTheme =
    themeMode === "auto" ? systemColorScheme || "light" : themeMode;
  const theme = {
    colors: resolvedTheme === "dark" ? darkTheme : lightTheme,
    sizes,
  };

  useEffect(() => {
    fadeAnim.setValue(1);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      setPrevBgColor(null);
    });
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ themeMode, theme, setThemeMode }}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {children}

        {prevBgColor && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: prevBgColor,
                opacity: fadeAnim,
              },
            ]}
          />
        )}
      </View>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
