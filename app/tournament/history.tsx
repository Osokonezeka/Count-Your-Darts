import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomAlert from "../../components/modals/CustomAlert";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { t } from "../../lib/i18n";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";

export default function TournamentHistoryScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const formatLabels: Record<string, string> = {
    single_knockout: t(language, "singleKnockout") || "Single Knockout",
    double_knockout: t(language, "doubleKnockout") || "Double Knockout",
    round_robin: t(language, "roundRobin") || "Round Robin",
    groups_and_knockout:
      t(language, "groupsAndKnockout") || "Groups + Knockout",
    groups_and_double_knockout:
      t(language, "groupsAndDoubleKnockout") || "Groups + Double Knockout",
  };

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteAlert, setDeleteAlert] = useState({ visible: false, id: "" });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem("@tournament_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error(
        t(language, "tournamentHistoryLoadError") || "Error loading history:",
        e,
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteAlert({ visible: true, id });
  };

  const deleteHistoryItem = async () => {
    try {
      const updatedHistory = history.filter(
        (item) => item.id !== deleteAlert.id,
      );
      setHistory(updatedHistory);
      await AsyncStorage.setItem(
        "@tournament_history",
        JSON.stringify(updatedHistory),
      );
    } catch (e) {
      console.error(e);
    }
    setDeleteAlert({ visible: false, id: "" });
  };

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.finishedAt).toLocaleDateString(
      language === "pl" ? "pl-PL" : "en-US",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    let winnerName = t(language, "unknown") || "Unknown";
    let secondPlaceName = "";

    if (item.settings?.format === "round_robin") {
      const stats: Record<string, any> = {};
      item.players?.forEach((p: any) => {
        stats[p.name] = { won: 0, legsFor: 0, legsAgainst: 0 };
      });
      item.bracket?.forEach((m: any) => {
        if (m.isBye || !m.winner || !m.player1 || !m.player2) return;
        if (m.winner.id === m.player1.id) stats[m.player1.name].won++;
        else stats[m.player2.name].won++;
        if (m.score) {
          if (item.settings && item.settings.targetSets > 1) {
            stats[m.player1.name].legsFor += m.score.p1Sets;
            stats[m.player1.name].legsAgainst += m.score.p2Sets;
            stats[m.player2.name].legsFor += m.score.p2Sets;
            stats[m.player2.name].legsAgainst += m.score.p1Sets;
          } else {
            stats[m.player1.name].legsFor += m.score.p1Legs;
            stats[m.player1.name].legsAgainst += m.score.p2Legs;
            stats[m.player2.name].legsFor += m.score.p2Legs;
            stats[m.player2.name].legsAgainst += m.score.p1Legs;
          }
        }
      });
      const sorted = Object.keys(stats).sort((a, b) => {
        if (stats[b].won !== stats[a].won) return stats[b].won - stats[a].won;
        const diffA = stats[a].legsFor - stats[a].legsAgainst;
        const diffB = stats[b].legsFor - stats[b].legsAgainst;
        return diffB - diffA;
      });
      if (sorted.length > 0) winnerName = sorted[0];
      if (sorted.length > 1) secondPlaceName = sorted[1];
    } else {
      const koMatches = item.bracket?.filter(
        (b: any) => b.phase === "knockout" || !b.phase,
      );
      if (koMatches && koMatches.length > 0) {
        const totalR = Math.max(...koMatches.map((b: any) => b.round));
        const finalMatch = koMatches.find(
          (m: any) => m.round === totalR && !m.isThirdPlace,
        );
        if (finalMatch && finalMatch.winner) {
          winnerName = finalMatch.winner.name;
          secondPlaceName =
            finalMatch.player1?.id === finalMatch.winner.id
              ? finalMatch.player2?.name
              : finalMatch.player1?.name;
        }
      }
    }

    const formatName = item.settings?.format
      ? formatLabels[item.settings.format]
      : "";
    const pts = item.settings?.startingPoints || item.settings?.points || 501;
    const sets = item.settings?.targetSets || item.settings?.sets || 1;
    const legs = item.settings?.targetLegs || item.settings?.legs || 1;
    const isTeam = item.settings?.teamSize === "team";

    return (
      <TouchableOpacity
        style={styles.historyCard}
        onPress={() =>
          router.push({
            pathname: "/tournament/bracket",
            params: {
              tournamentData: JSON.stringify(item.settings),
              playersData: JSON.stringify(item.players),
              bracketData: JSON.stringify(item.bracket),
              isHistoryView: "true",
            },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{date}</Text>
          <TouchableOpacity onPress={() => confirmDelete(item.id)}>
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.danger}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.tournamentName}>{item.settings.name}</Text>

        <View style={styles.tagsContainer}>
          {formatName && (
            <View style={styles.tag}>
              <Ionicons
                name="git-network-outline"
                size={12}
                color={theme.colors.textMuted}
              />
              <Text style={styles.tagText}>{formatName}</Text>
            </View>
          )}
          <View style={styles.tag}>
            <Ionicons
              name="options-outline"
              size={12}
              color={theme.colors.textMuted}
            />
            <Text style={styles.tagText}>
              {sets}S / {legs}L / {pts}
            </Text>
          </View>
          <View style={styles.tag}>
            <Ionicons
              name={isTeam ? "people" : "person"}
              size={12}
              color={theme.colors.textMuted}
            />
            <Text style={styles.tagText}>{isTeam ? "2v2" : "1v1"}</Text>
          </View>
          <View style={styles.tag}>
            <Ionicons name="list" size={12} color={theme.colors.textMuted} />
            <Text style={styles.tagText}>
              {item.players?.length || 0}{" "}
              {isTeam
                ? t(language, "teamsCount") || "teams"
                : t(language, "playersShort") || "players"}
            </Text>
          </View>
        </View>

        <View style={styles.podiumContainer}>
          <View style={styles.podiumRow}>
            <Ionicons name="trophy" size={16} color={theme.colors.warning} />
            <Text style={styles.winnerText}>{winnerName}</Text>
          </View>
          {!!secondPlaceName && (
            <View style={[styles.podiumRow, { marginTop: 6 }]}>
              <Ionicons name="medal" size={14} color="#C0C0C0" />
              <Text style={styles.secondPlaceText}>{secondPlaceName}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>
          {t(language, "tournamentHistory") || "Tournament History"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={{ flex: 1 }}
        />
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="journal-outline"
            size={80}
            color={theme.colors.cardBorder}
          />
          <Text style={styles.emptyText}>
            {t(language, "noSavedTournaments") || "No saved tournaments."}
          </Text>
          <Text style={styles.emptySubText}>
            {t(language, "noSavedTournamentsSub") ||
              "Your finished tournaments will appear here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.scrollContent}
        />
      )}

      <CustomAlert
        visible={deleteAlert.visible}
        title={t(language, "deleteFromHistory") || "Delete from history"}
        message={
          t(language, "deleteFromHistoryConfirm") ||
          "Are you sure you want to permanently delete this tournament from history?"
        }
        onRequestClose={() => setDeleteAlert({ visible: false, id: "" })}
        buttons={[
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: () => setDeleteAlert({ visible: false, id: "" }),
          },
          {
            text: t(language, "delete") || "Delete",
            style: "destructive",
            onPress: deleteHistoryItem,
          },
        ]}
      />
    </View>
  );
}

const getSpecificStyles = (theme: any) =>
  StyleSheet.create({
    historyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    dateText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    tournamentName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 4,
    },
    tagText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: "700",
    },
    podiumContainer: {
      backgroundColor: "rgba(240, 173, 78, 0.05)",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(240, 173, 78, 0.2)",
    },
    podiumRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    winnerText: {
      fontSize: 15,
      color: theme.colors.textMain,
      fontWeight: "900",
    },
    secondPlaceText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMuted,
      marginTop: 16,
    },
    emptySubText: {
      fontSize: 14,
      color: theme.colors.textLight,
      textAlign: "center",
      marginTop: 8,
    },
  });
