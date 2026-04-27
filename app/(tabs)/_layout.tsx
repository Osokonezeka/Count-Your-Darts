import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

export default function TabsLayout() {
  const { language } = useLanguage();
  const { theme, themeMode } = useTheme();
  const systemColorScheme = useColorScheme();

  const resolvedTheme =
    themeMode === "auto" ? systemColorScheme || "light" : themeMode;

  const statusBarStyle = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <>
      <StatusBar style={statusBarStyle} backgroundColor={theme.colors.card} />

      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.card,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.cardBorder,
          },
          headerTintColor: theme.colors.textMain,
          headerTitleStyle: {
            fontWeight: "800",
          },
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.cardBorder,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: {
            fontWeight: "600",
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="play"
          options={{
            title: t(language, "start") || "Start",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="play" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="statistics"
          options={{
            title: t(language, "stats") || "Statystyki",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: t(language, "history") || "Historia",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: t(language, "settings") || "Ustawienia",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
