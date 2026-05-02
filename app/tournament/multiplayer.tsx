import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";

export default function MultiplayerScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );

  const [isJoinModalVisible, setJoinModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top > 0 ? insets.top + 16 : 16 },
        ]}
      >
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textMain} />
          <Text style={styles.backButtonText}>
            {t(language, "changeMode") || "Change mode"}
          </Text>
        </AnimatedPressable>
        <Text style={styles.sectionTitleMain}>
          {t(language, "multiplayerOptions") || "Multiplayer options"}
        </Text>
        <AnimatedPressable
          style={styles.modeCard}
          onPress={() =>
            router.push({
              pathname: "/tournament/create",
              params: { isHost: "true" },
            })
          }
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name="add-circle"
              size={48}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.modeTitle}>
            {t(language, "hostGame") || "Host game"}
          </Text>
          <Text style={styles.modeDesc}>
            {t(language, "hostGameDesc") ||
              "Create a new room, set rules and share the code with friends."}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.modeCard}
          onPress={() => setJoinModalVisible(true)}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="log-in" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.modeTitle}>
            {t(language, "joinGame") || "Join game"}
          </Text>
          <Text style={styles.modeDesc}>
            {t(language, "joinGameDesc") ||
              "Already have a code from a friend? Enter it here to join the lobby."}
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const getSpecificStyles = (theme: any) =>
  StyleSheet.create({
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 8,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textMain,
    },
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
  });
