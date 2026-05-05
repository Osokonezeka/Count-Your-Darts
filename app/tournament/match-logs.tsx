import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";
import { LegLog } from "../../lib/statsUtils";

export default function MatchLogsScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { matchData, settingsData } = useLocalSearchParams();

  const match = matchData ? JSON.parse(matchData as string) : null;
  const settings = settingsData ? JSON.parse(settingsData as string) : null;
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );

  if (!match || !match.logs) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: theme.colors.textMuted }}>
          {t(language, "noLogsAvailable") ||
            "No logs available for this match."}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: theme.colors.primary, fontWeight: "bold" }}>
            {t(language, "goBack") || "Go back"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderTableForLeg = (leg: LegLog, legIndex: number) => {
    const p1Throws = leg.p1Throws || [];
    const p2Throws = leg.p2Throws || [];
    const maxR = Math.max(p1Throws.length, p2Throws.length);

    let s1 = settings?.startingPoints || 501;
    let s2 = settings?.startingPoints || 501;

    const rows = [];
    const p1Started = leg.starterId === match.player1.id;
    const p2Started = leg.starterId === match.player2?.id;

    rows.push(
      <View key="start" style={styles.row}>
        <View style={[styles.colScored, styles.disabledScoredCell]}>
          <Text style={styles.disabledScoredText}>-</Text>
        </View>
        <View style={[styles.colToGo, p1Started && styles.starterCell]}>
          {p1Started && (
            <Ionicons
              name="caret-down"
              size={16}
              color={theme.colors.primary}
              style={styles.starterIcon}
            />
          )}
          <Text style={styles.txtToGo}>{settings?.startingPoints || 501}</Text>
        </View>
        <View style={styles.colCenter} />
        <View style={[styles.colToGo, p2Started && styles.starterCell]}>
          {p2Started && (
            <Ionicons
              name="caret-down"
              size={16}
              color={theme.colors.primary}
              style={styles.starterIcon}
            />
          )}
          <Text style={styles.txtToGo}>
            {match.player2 ? settings?.startingPoints || 501 : "-"}
          </Text>
        </View>
        <View style={[styles.colScored, styles.disabledScoredCell]}>
          <Text style={styles.disabledScoredText}>-</Text>
        </View>
      </View>,
    );

    for (let i = 0; i < maxR; i++) {
      const t1 = p1Throws[i];
      const t2 = p2Throws[i];

      if (t1 && t1 !== "BUST") s1 -= parseInt(t1);
      if (t2 && t2 !== "BUST") s2 -= parseInt(t2);

      rows.push(
        <View key={i} style={styles.row}>
          <View style={styles.colScored}>
            <Text style={[styles.txtScored, t1 === "BUST" && styles.txtBust]}>
              {t1 || ""}
            </Text>
          </View>
          <View style={styles.colToGo}>
            <Text
              style={[
                styles.txtToGo,
                t1 && s1 === 0 && { color: theme.colors.warning },
              ]}
            >
              {t1 ? s1 : ""}
            </Text>
          </View>
          <View style={styles.colCenter}>
            <Text style={styles.txtDarts}>{(i + 1) * 3}</Text>
          </View>
          <View style={styles.colToGo}>
            <Text
              style={[
                styles.txtToGo,
                t2 && s2 === 0 && { color: theme.colors.warning },
              ]}
            >
              {t2 ? s2 : ""}
            </Text>
          </View>
          <View style={styles.colScored}>
            <Text style={[styles.txtScored, t2 === "BUST" && styles.txtBust]}>
              {t2 || ""}
            </Text>
          </View>
        </View>,
      );
    }

    return (
      <View key={legIndex} style={styles.legContainer}>
        <Text style={styles.legTitle}>
          {(t(language, "legNumber") || "Leg {{number}}").replace(
            "{{number}}",
            (legIndex + 1).toString(),
          )}
        </Text>
        <View style={styles.tableHead}>
          <Text style={styles.headLabel}>
            {t(language, "scored") || "Scored"}
          </Text>
          <Text style={styles.headLabelToGo} numberOfLines={1}>
            {match.player1?.name}
          </Text>
          <View style={{ width: 40 }} />
          <Text style={styles.headLabelToGo} numberOfLines={1}>
            {match.player2?.name || t(language, "byePlayer") || "Bye"}
          </Text>
          <Text style={styles.headLabel}>
            {t(language, "scored") || "Scored"}
          </Text>
        </View>
        <View style={styles.tableBody}>{rows}</View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t(language, "matchLogsTitle") || "Match Logs"}
        </Text>
        <View style={{ width: 34 }} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {match.logs.map((leg: LegLog, i: number) => renderTableForLeg(leg, i))}
      </ScrollView>
    </View>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40, gap: 24 },
    legContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    legTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.colors.textMain,
      textAlign: "center",
      paddingVertical: 10,
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.1)",
    },
    tableHead: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    headLabelToGo: {
      flex: 1.3,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    tableBody: { backgroundColor: theme.colors.background },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      height: 44,
    },
    colScored: { flex: 1, justifyContent: "center", alignItems: "center" },
    colToGo: {
      flex: 1.3,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      flexDirection: "row",
    },
    colCenter: {
      width: 40,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.cardBorder,
    },
    starterCell: {
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.15)",
    },
    starterIcon: { position: "absolute", left: 10 },
    txtScored: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    txtToGo: { fontSize: 18, fontWeight: "900", color: theme.colors.textMain },
    txtDarts: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    txtBust: {
      color: theme.colors.danger || "red",
      fontSize: 14,
      fontWeight: "800",
    },
    disabledScoredCell: {
      backgroundColor: theme.colors.cardBorder,
      opacity: 0.5,
    },
    disabledScoredText: {
      color: theme.colors.textMuted,
      fontSize: 20,
      fontWeight: "600",
    },
  });
