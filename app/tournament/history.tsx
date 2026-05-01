import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function TournamentHistoryScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
    } else {
      const koMatches = item.bracket?.filter(
        (b: any) => b.phase === "knockout" || !b.phase,
      );
      if (koMatches && koMatches.length > 0) {
        const totalR = Math.max(...koMatches.map((b: any) => b.round));
        const finalMatch = koMatches.find(
          (m: any) => m.round === totalR && !m.isThirdPlace,
        );
        winnerName = finalMatch?.winner?.name || winnerName;
      }
    }

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

        <View style={styles.cardFooter}>
          <View style={styles.infoBadge}>
            <Ionicons
              name="people-outline"
              size={14}
              color={theme.colors.textMuted}
            />
            <Text style={styles.infoText}>{item.players.length} graczy</Text>
            <Text style={styles.infoText}>
              {item.players.length} {t(language, "playersShort") || "players"}
            </Text>
          </View>
          <View style={styles.winnerBadge}>
            <Ionicons name="trophy" size={14} color={theme.colors.warning} />
            <Text style={styles.winnerName}>{winnerName}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn}>
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
          contentContainerStyle={styles.listContent}
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

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    backBtn: { padding: 4 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    listContent: { padding: 16, paddingBottom: 40 },
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
      marginBottom: 12,
    },
    cardFooter: { flexDirection: "row", gap: 12 },
    infoBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    winnerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(240, 173, 78, 0.1)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    infoText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: "700",
    },
    winnerName: {
      fontSize: 12,
      color: theme.colors.textMain,
      fontWeight: "800",
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
