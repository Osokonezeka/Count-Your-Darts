import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomAlert from "../../components/modals/CustomAlert";
import GroupsAndKnockout from "../../components/tournament/GroupsAndKnockout";
import RoundRobin from "../../components/tournament/RoundRobin";
import SingleKnockout from "../../components/tournament/SingleKnockout";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

export default function TournamentBracketScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { tournamentData, playersData, bracketData, isHistoryView } =
    useLocalSearchParams();

  const settings = useMemo(
    () => (tournamentData ? JSON.parse(tournamentData as string) : null),
    [tournamentData],
  );
  const players = useMemo(
    () => (playersData ? JSON.parse(playersData as string) : []),
    [playersData],
  );
  const initialBracket = useMemo(
    () => (bracketData ? JSON.parse(bracketData as string) : null),
    [bracketData],
  );

  const [viewMode, setViewMode] = useState<"list" | "tree">("tree");
  const [isDeleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [isFinishedPromptVisible, setFinishedPromptVisible] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isStatsModalVisible, setStatsModalVisible] = useState(false);

  const [isSaved, setIsSaved] = useState(false);
  const [rrViewMode, setRrViewMode] = useState<"matches" | "standings">(
    "matches",
  );
  const [phaseView, setPhaseView] = useState<"group" | "knockout">("group");

  useFocusEffect(
    useCallback(() => {
      const checkFinished = async () => {
        if (!settings || isHistoryView === "true" || isSaved) return;
        try {
          const bracketStorageKey = `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`;
          const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
          if (savedBracketStr) {
            const bracket = JSON.parse(savedBracketStr);
            if (Array.isArray(bracket)) {
              let isFinished = false;
              if (settings.format === "round_robin") {
                isFinished =
                  bracket.length > 0 &&
                  bracket.every((m: any) => m.winner !== null || m.isBye);
              } else if (
                settings.format === "groups_and_knockout" ||
                settings.format === "groups_and_double_knockout"
              ) {
                const koMatches = bracket.filter(
                  (m: any) => m.phase === "knockout",
                );
                if (koMatches.length > 0) {
                  const totalR = Math.max(
                    ...koMatches.map((m: any) => m.round),
                  );
                  const finalRoundMatches = koMatches.filter(
                    (m: any) => m.round === totalR,
                  );
                  isFinished =
                    finalRoundMatches.length > 0 &&
                    finalRoundMatches.every(
                      (m: any) => m.winner !== null || m.isBye,
                    );
                }
              } else {
                const totalR = Math.max(...bracket.map((m: any) => m.round));
                const finalRoundMatches = bracket.filter(
                  (m: any) => m.round === totalR,
                );
                isFinished =
                  finalRoundMatches.length > 0 &&
                  finalRoundMatches.every(
                    (m: any) => m.winner !== null || m.isBye,
                  );
              }
              if (isFinished) {
                setFinishedPromptVisible(true);
              }
            }
          }
        } catch (error) {
          console.error(error);
        }
      };
      checkFinished();
    }, [settings, isHistoryView, isSaved]),
  );

  const handleSaveAndStay = async () => {
    setFinishedPromptVisible(false);
    setIsSaved(true);
    if (!settings) return;
    try {
      const bracketStorageKey = `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`;
      const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
      const bracket = savedBracketStr ? JSON.parse(savedBracketStr) : [];

      const historyItem = {
        id: Date.now().toString(),
        finishedAt: new Date().toISOString(),
        settings,
        players,
        bracket,
      };

      const historyStr = await AsyncStorage.getItem("@tournament_history");
      const historyArr = historyStr ? JSON.parse(historyStr) : [];
      historyArr.unshift(historyItem);
      await AsyncStorage.setItem(
        "@tournament_history",
        JSON.stringify(historyArr),
      );

      const selectedPlayersKey = `@dart_selected_players_${String(settings.name || "").replace(/\s/g, "_")}`;
      const keysToRemove = [bracketStorageKey, selectedPlayersKey];
      if (Array.isArray(bracket)) {
        bracket.forEach((match: any) => {
          keysToRemove.push(`match_save_${match.id}`);
        });
      }
      await AsyncStorage.multiRemove(keysToRemove);

      const savedArrStr = await AsyncStorage.getItem("@active_tournaments");
      if (savedArrStr) {
        let savedArr = JSON.parse(savedArrStr);
        savedArr = savedArr.filter(
          (t: any) => t.settings.name !== settings.name,
        );
        await AsyncStorage.setItem(
          "@active_tournaments",
          JSON.stringify(savedArr),
        );
      }
    } catch (e) {
      console.error("Błąd podczas zapisywania do historii:", e);
    }
  };

  const handleDeleteTournament = async () => {
    if (!settings) return;
    try {
      const bracketStorageKey = `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`;
      const selectedPlayersKey = `@dart_selected_players_${String(settings.name || "").replace(/\s/g, "_")}`;
      const keysToRemove = [bracketStorageKey, selectedPlayersKey];

      const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
      if (savedBracketStr) {
        const savedBracket = JSON.parse(savedBracketStr);
        if (Array.isArray(savedBracket)) {
          savedBracket.forEach((match: any) => {
            keysToRemove.push(`match_save_${match.id}`);
          });
        }
      }
      await AsyncStorage.multiRemove(keysToRemove);

      const savedArrStr = await AsyncStorage.getItem("@active_tournaments");
      if (savedArrStr) {
        let savedArr = JSON.parse(savedArrStr);
        savedArr = savedArr.filter(
          (t: any) => t.settings.name !== settings.name,
        );
        await AsyncStorage.setItem(
          "@active_tournaments",
          JSON.stringify(savedArr),
        );
      }
    } catch (e) {
      console.error("Błąd podczas usuwania danych turnieju:", e);
    }
    setDeleteAlertVisible(false);

    router.back();
  };

  const handleMatchPress = (match: any) => {
    setSelectedMatch(match);
    setStatsModalVisible(true);
  };

  if (!settings || !players || players.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: theme.colors.textMain }}>
          {t(language, "tournamentLoadError") ||
            "Error loading tournament data."}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: theme.colors.primary }}>
            {t(language, "goBack") || "Go back"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {settings.name ||
            t(language, "tournamentBracket") ||
            "Tournament Bracket"}
        </Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setDeleteAlertVisible(true)}
            style={styles.headerBtn}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={theme.colors.danger || "#dc3545"}
            />
          </TouchableOpacity>

          {(settings.format === "single_knockout" ||
            settings.format === "double_knockout" ||
            ((settings.format === "groups_and_knockout" ||
              settings.format === "groups_and_double_knockout") &&
              phaseView === "knockout")) && (
            <TouchableOpacity
              onPress={() =>
                setViewMode((v: "list" | "tree") =>
                  v === "list" ? "tree" : "list",
                )
              }
              style={styles.headerBtn}
            >
              <Ionicons
                name={viewMode === "list" ? "git-network-outline" : "list"}
                size={26}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}

          {(settings.format === "round_robin" ||
            ((settings.format === "groups_and_knockout" ||
              settings.format === "groups_and_double_knockout") &&
              phaseView === "group")) && (
            <TouchableOpacity
              onPress={() =>
                setRrViewMode((v: "matches" | "standings") =>
                  v === "matches" ? "standings" : "matches",
                )
              }
              style={styles.headerBtn}
            >
              <Ionicons
                name={rrViewMode === "matches" ? "podium-outline" : "list"}
                size={26}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {settings.format === "groups_and_knockout" ||
      settings.format === "groups_and_double_knockout" ? (
        <GroupsAndKnockout
          players={players}
          settings={settings}
          onMatchPress={handleMatchPress}
          initialBracket={initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
          activeTab={rrViewMode}
          viewMode={viewMode}
          phaseView={phaseView}
          setPhaseView={setPhaseView}
        />
      ) : settings.format === "round_robin" ? (
        <RoundRobin
          players={players}
          settings={settings}
          onMatchPress={handleMatchPress}
          initialBracket={initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
          activeTab={rrViewMode}
        />
      ) : (
        <SingleKnockout
          players={players}
          settings={settings}
          viewMode={viewMode}
          onMatchPress={handleMatchPress}
          initialBracket={initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
        />
      )}

      <Modal
        visible={isStatsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setStatsModalVisible(false)}
          />

          {selectedMatch && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t(language, "matchStatsTitle") || "Match Statistics"}
                </Text>
                <TouchableOpacity
                  onPress={() => setStatsModalVisible(false)}
                  style={styles.closeModalBtn}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.playersTitleRow}>
                <Text
                  style={[
                    styles.playerHeaderName,
                    selectedMatch.winner?.id === selectedMatch.player1?.id &&
                      styles.winnerName,
                  ]}
                >
                  {selectedMatch.player1?.name}
                </Text>
                <Text style={styles.vsText}>VS</Text>
                <Text
                  style={[
                    styles.playerHeaderName,
                    selectedMatch.winner?.id === selectedMatch.player2?.id &&
                      styles.winnerName,
                  ]}
                >
                  {selectedMatch.player2?.name}
                </Text>
              </View>

              <ScrollView
                style={styles.statsScroll}
                showsVerticalScrollIndicator={false}
              >
                {selectedMatch.stats && selectedMatch.stats.length > 0 ? (
                  selectedMatch.stats.map((stat: any, idx: number) => (
                    <View
                      key={idx}
                      style={[
                        styles.statRow,
                        idx % 2 === 0 && styles.statRowAlternate,
                      ]}
                    >
                      <Text style={styles.statValueLeft}>{stat.p1}</Text>
                      <Text style={styles.statLabelCenter}>{stat.label}</Text>
                      <Text style={styles.statValueRight}>{stat.p2}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 30, alignItems: "center" }}>
                    <Ionicons
                      name="analytics-outline"
                      size={40}
                      color={theme.colors.textMuted}
                    />
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        marginTop: 10,
                        textAlign: "center",
                      }}
                    >
                      {t(language, "noStatsData") ||
                        "No statistical data available for this match."}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {selectedMatch.logs && selectedMatch.logs.length > 0 ? (
                <TouchableOpacity
                  style={styles.showLogsBtn}
                  onPress={() => {
                    setStatsModalVisible(false);
                    router.push({
                      pathname: "/tournament/match-logs",
                      params: {
                        matchData: JSON.stringify(selectedMatch),
                        settingsData: JSON.stringify(settings),
                      },
                    });
                  }}
                >
                  <Ionicons name="list-outline" size={18} color="#fff" />
                  <Text style={styles.showLogsBtnText}>
                    {t(language, "showPlayedLegs") || "Show played legs"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.disclaimerText}>
                  {t(language, "statsDisclaimer") ||
                    "Statistics are generated automatically after the match ends."}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>

      <CustomAlert
        visible={isFinishedPromptVisible}
        title={
          t(language, "tournamentFinishedTitle") || "Tournament Finished 🏆"
        }
        message={
          t(language, "tournamentFinishedMsg") ||
          "All matches have been played! Do you want to save this tournament to history and remove it from the active list?"
        }
        onRequestClose={() => setFinishedPromptVisible(false)}
        buttons={[
          {
            text: t(language, "ok") || "OK",
            onPress: handleSaveAndStay,
          },
        ]}
      />

      <CustomAlert
        visible={isDeleteAlertVisible}
        title={t(language, "deleteTournament") || "Delete tournament"}
        message={
          t(language, "deleteTournamentConfirmName")?.replace(
            "{{name}}",
            settings?.name,
          ) ||
          `Are you sure you want to delete '${settings?.name}'? Results WILL NOT be saved in history.`
        }
        onRequestClose={() => setDeleteAlertVisible(false)}
        buttons={[
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: () => setDeleteAlertVisible(false),
          },
          {
            text: t(language, "deletePermanently") || "Delete permanently",
            style: "destructive",
            onPress: handleDeleteTournament,
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
    headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerBtn: { padding: 4 },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      textAlign: "center",
      marginHorizontal: 10,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 16,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 20,
      maxHeight: "90%",
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    closeModalBtn: {
      padding: 4,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
    },
    playersTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary,
      paddingBottom: 16,
      marginBottom: 8,
    },
    playerHeaderName: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    winnerName: { color: theme.colors.success || "#28a745" },
    vsText: {
      width: 40,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    statsScroll: { flexGrow: 0 },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    statRowAlternate: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
    },
    statValueLeft: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    statLabelCenter: {
      flex: 1.5,
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    statValueRight: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    disclaimerText: {
      textAlign: "center",
      fontSize: 11,
      color: theme.colors.textLight,
      marginTop: 16,
      fontStyle: "italic",
    },
    showLogsBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 16,
      gap: 8,
    },
    showLogsBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
