import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";

export default function TournamentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.sectionTitleMain}>
        {t(language, "selectTournamentMode") || "Select tournament mode"}
      </Text>

      <AnimatedPressable
        style={styles.modeCard}
        onPress={() => router.push("/tournament/create")}
      >
        <View style={styles.iconWrapper}>
          <Ionicons name="people" size={48} color={theme.colors.primary} />
        </View>
        <Text style={styles.modeTitle}>
          {t(language, "localGame") || "Local game"}
        </Text>
        <Text style={styles.modeDesc}>
          {t(language, "localGameDesc") ||
            "Play on the same device. Perfect for playing at one board."}
        </Text>
      </AnimatedPressable>
      <AnimatedPressable
        style={styles.modeCard}
        onPress={() => router.push("/tournament/multiplayer")}
      >
        <View style={styles.iconWrapper}>
          <Ionicons
            name="phone-portrait-outline"
            size={48}
            color={theme.colors.primary}
          />
          <View style={styles.wifiIconSub}>
            <Ionicons name="wifi" size={20} color={theme.colors.card} />
          </View>
        </View>
        <Text style={styles.modeTitle}>
          {t(language, "multiGame") || "Multiplayer game"}
        </Text>
        <Text style={styles.modeDesc}>
          {t(language, "multiGameDesc") ||
            "Each player uses their own phone. Create a room and invite friends."}
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        style={styles.historyBtn}
        onPress={() => router.push("/tournament/history")}
      >
        <Ionicons
          name="archive-outline"
          size={24}
          color={theme.colors.primary}
        />
        <Text style={styles.historyBtnText}>
          {t(language, "tournamentHistory") || "Tournament History"}
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        style={styles.historyBtn}
        onPress={() => router.push("/tournament/statistics")}
      >
        <Ionicons name="stats-chart" size={24} color={theme.colors.primary} />
        <Text style={styles.historyBtnText}>
          {t(language, "tournamentStatistics") || "Tournament Statistics"}
        </Text>
      </AnimatedPressable>
    </ScrollView>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    sectionTitleMain: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 24,
      marginTop: 8,
      textAlign: "center",
    },
    modeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    iconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    wifiIconSub: {
      position: "absolute",
      bottom: -4,
      right: -4,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 4,
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
    modeTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 8,
      textAlign: "center",
    },
    modeDesc: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "500",
      textAlign: "center",
      lineHeight: 20,
    },
    historyBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    historyBtnText: {
      color: theme.colors.textMain,
      fontSize: 16,
      fontWeight: "800",
      textTransform: "uppercase",
    },
  });
