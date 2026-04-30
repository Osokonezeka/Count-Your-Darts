import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { t } from "../lib/i18n";
import CustomAlert from "./CustomAlert";

type Player = { id: string; name: string };
type Match = {
  id: string;
  round: number;
  matchIndex: number;
  player1: Player | null;
  player2: Player | null;
  winner: Player | null;
  nextMatchId: string | null;
  isBye: boolean;
  stats?: any[];
  score?: { p1Sets: number; p1Legs: number; p2Sets: number; p2Legs: number };
};

const MatchCard = React.memo(
  ({
    match,
    isMatchInProgress,
    theme,
    onPlay,
    onMatchPress,
    isReadOnly,
    onResetMatch,
    settings,
  }: {
    match: Match;
    isMatchInProgress: boolean;
    theme: any;
    onPlay: (match: Match) => void;
    onMatchPress?: (match: Match) => void;
    isReadOnly: boolean;
    onResetMatch?: (matchId: string) => void;
    settings: any;
  }) => {
    const { language } = useLanguage();
    const styles = useMemo(() => getStyles(theme), [theme]);
    const isWaiting = !match.player1 || !match.player2;
    const hasWinner = match.winner !== null;
    const p1IsWinner = hasWinner && match.winner?.id === match.player1?.id;
    const p2IsWinner = hasWinner && match.winner?.id === match.player2?.id;
    const p1IsLoser = hasWinner && !p1IsWinner && match.player1 !== null;
    const p2IsLoser =
      hasWinner && !p2IsWinner && match.player2 !== null && !match.isBye;

    const isClickable = hasWinner && !match.isBye && onMatchPress;

    return (
      <TouchableOpacity
        style={[styles.matchCard, match.isBye && styles.byeCard]}
        activeOpacity={isClickable ? 0.8 : 1}
        onPress={isClickable ? () => onMatchPress(match) : undefined}
      >
        {isMatchInProgress && !hasWinner && !isReadOnly && onResetMatch && (
          <TouchableOpacity
            style={styles.resetMatchBtn}
            onPress={() => onResetMatch(match.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={theme.colors.danger || "#dc3545"}
            />
          </TouchableOpacity>
        )}

        <View>
          <View
            style={[
              styles.playerRow,
              p1IsWinner && styles.winnerRow,
              p1IsLoser && styles.loserRow,
            ]}
          >
            <Text
              style={[
                styles.playerName,
                !match.player1 && styles.pendingText,
                p1IsWinner && styles.winnerText,
                p1IsLoser && styles.loserText,
              ]}
              numberOfLines={1}
            >
              {match.player1
                ? match.player1.name
                : t(language, "awaiting") || "Awaiting..."}
            </Text>

            {match.score && match.player1 && (
              <Text
                style={[
                  styles.scoreText,
                  p1IsWinner && styles.winnerText,
                  p1IsLoser && styles.loserText,
                ]}
              >
                {match.score.p1Sets > 0 ? `${match.score.p1Sets}S ` : ""}
                {match.score.p1Legs}L
              </Text>
            )}
          </View>
          <View style={styles.divider} />
          <View
            style={[
              styles.playerRow,
              p2IsWinner && styles.winnerRow,
              p2IsLoser && styles.loserRow,
            ]}
          >
            <Text
              style={[
                styles.playerName,
                !match.player2 && styles.pendingText,
                p2IsWinner && styles.winnerText,
                p2IsLoser && styles.loserText,
              ]}
              numberOfLines={1}
            >
              {match.player2
                ? match.player2.name
                : match.isBye
                  ? t(language, "byePlayer") || "Bye"
                  : t(language, "awaiting") || "Awaiting..."}
            </Text>

            {match.score && match.player2 && !match.isBye && (
              <Text
                style={[
                  styles.scoreText,
                  p2IsWinner && styles.winnerText,
                  p2IsLoser && styles.loserText,
                ]}
              >
                {match.score.p2Sets > 0 ? `${match.score.p2Sets}S ` : ""}
                {match.score.p2Legs}L
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionContainer}>
          {!match.isBye && hasWinner ? (
            <TouchableOpacity
              style={styles.statsButton}
              activeOpacity={0.8}
              onPress={() => onMatchPress?.(match)}
            >
              <Ionicons name="stats-chart" size={16} color="#fff" />
              <Text style={styles.playButtonText}>
                {t(language, "stats") || "Statistics"}
              </Text>
            </TouchableOpacity>
          ) : !isReadOnly && !match.isBye && !isWaiting ? (
            <TouchableOpacity
              style={[
                styles.playButton,
                isMatchInProgress && styles.resumeButton,
              ]}
              activeOpacity={0.8}
              onPress={() => onPlay(match)}
            >
              <Ionicons
                name={isMatchInProgress ? "play-forward" : "play"}
                size={16}
                color="#fff"
              />
              <Text style={styles.playButtonText}>
                {isMatchInProgress
                  ? t(language, "resume") || "Resume"
                  : t(language, "start") || "Play"}
              </Text>
            </TouchableOpacity>
          ) : match.isBye ? (
            <Text style={styles.infoText}>
              {t(language, "byePlayer") || "Bye"}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  },
);

export default function RoundRobin({
  players,
  settings,
  onMatchPress,
  initialBracket = null,
  isReadOnly = false,
  activeTab = "matches",
}: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { language } = useLanguage();
  const [matches, setMatches] = useState<Match[]>([]);
  const [inProgressMatches, setInProgressMatches] = useState<
    Record<string, boolean>
  >({});
  const [resetAlert, setResetAlert] = useState({ visible: false, matchId: "" });
  const [selectedPlayerMatches, setSelectedPlayerMatches] = useState<{
    player: Player;
    matches: Match[];
  } | null>(null);

  const bracketStorageKey = `bracket_structure_${String(settings?.name || "").replace(/\s/g, "_")}`;

  useFocusEffect(
    useCallback(() => {
      const loadTournamentState = async () => {
        if (initialBracket) {
          setMatches(initialBracket);
          return;
        }

        try {
          const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
          if (savedBracketStr) {
            const currentMatches = JSON.parse(savedBracketStr) as Match[];
            setMatches(currentMatches);

            const progressObj: Record<string, boolean> = {};
            for (const m of currentMatches) {
              const savedScore = await AsyncStorage.getItem(
                `match_save_${m.id}`,
              );
              if (savedScore) progressObj[m.id] = true;
            }
            setInProgressMatches(progressObj);
          } else if (players.length > 0 && !isReadOnly) {
            generateBracket();
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadTournamentState();
    }, [players, initialBracket, isReadOnly]),
  );

  const generateBracket = async () => {
    let pls = [...players];

    if (settings.bracketOrder === "random" || !settings.bracketOrder) {
      pls = pls.sort(() => 0.5 - Math.random());
    }

    if (pls.length % 2 !== 0) {
      pls.push({ id: "bye", name: "Bye" });
    }

    const N = pls.length;
    const rounds = N - 1;
    const matchesPerRound = N / 2;
    const newMatches: Match[] = [];
    const generationPrefix = Date.now().toString(36);

    for (let r = 0; r < rounds; r++) {
      for (let m = 0; m < matchesPerRound; m++) {
        const p1 = pls[m];
        const p2 = pls[N - 1 - m];
        const isBye = p1.id === "bye" || p2.id === "bye";

        newMatches.push({
          id: `match_${generationPrefix}_r${r + 1}_m${m}`,
          round: r + 1,
          matchIndex: m,
          player1: p1.id === "bye" ? null : p1,
          player2: p2.id === "bye" ? null : p2,
          winner: isBye ? (p1.id === "bye" ? p2 : p1) : null,
          nextMatchId: null,
          isBye,
        });
      }
      pls = [pls[0], pls[N - 1], ...pls.slice(1, N - 1)];
    }

    setMatches(newMatches);
    await AsyncStorage.setItem(bracketStorageKey, JSON.stringify(newMatches));
  };

  const performResetMatch = async () => {
    if (!resetAlert.matchId) return;
    try {
      await AsyncStorage.removeItem(`match_save_${resetAlert.matchId}`);
      setInProgressMatches((prev: Record<string, boolean>) => {
        const updated = { ...prev };
        delete updated[resetAlert.matchId];
        return updated;
      });
    } catch (e) {
      console.error(
        t(language, "resetMatchError") || "Error resetting match:",
        e,
      );
    }
    setResetAlert({ visible: false, matchId: "" });
  };

  const standings = useMemo(() => {
    const stats: Record<string, any> = {};
    players.forEach((p: Player) => {
      stats[p.id] = {
        player: p,
        played: 0,
        won: 0,
        lost: 0,
        legsFor: 0,
        legsAgainst: 0,
        points: 0,
      };
    });

    matches.forEach((m) => {
      if (m.isBye || !m.winner || !m.player1 || !m.player2) return;
      const p1 = m.player1.id;
      const p2 = m.player2.id;
      if (!stats[p1] || !stats[p2]) return;

      stats[p1].played++;
      stats[p2].played++;

      if (m.winner.id === p1) {
        stats[p1].won++;
        stats[p2].lost++;
        stats[p1].points++;
      } else {
        stats[p2].won++;
        stats[p1].lost++;
        stats[p2].points++;
      }

      if (m.score) {
        if (settings && settings.targetSets > 1) {
          stats[p1].legsFor += m.score.p1Sets;
          stats[p1].legsAgainst += m.score.p2Sets;
          stats[p2].legsFor += m.score.p2Sets;
          stats[p2].legsAgainst += m.score.p1Sets;
        } else {
          stats[p1].legsFor += m.score.p1Legs;
          stats[p1].legsAgainst += m.score.p2Legs;
          stats[p2].legsFor += m.score.p2Legs;
          stats[p2].legsAgainst += m.score.p1Legs;
        }
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.legsFor - a.legsAgainst;
      const diffB = b.legsFor - b.legsAgainst;
      if (diffA !== diffB) return diffB - diffA;
      return b.legsFor - a.legsFor;
    });
  }, [matches, players]);

  const matchesByRound = useMemo(() => {
    return matches.reduce(
      (acc: Record<number, Match[]>, match: Match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      },
      {} as Record<number, Match[]>,
    );
  }, [matches]);

  const handleResetRequest = useCallback((matchId: string) => {
    setResetAlert({ visible: true, matchId });
  }, []);

  const handlePlayMatch = useCallback(
    (match: Match) => {
      setSelectedPlayerMatches(null);
      router.push({
        pathname: "/tournament/match",
        params: {
          matchData: JSON.stringify(match),
          settingsData: JSON.stringify(settings),
        },
      });
    },
    [settings, router],
  );

  const handlePressMatch = useCallback(
    (match: Match) => {
      setSelectedPlayerMatches(null);
      onMatchPress(match);
    },
    [onMatchPress],
  );

  const renderCard = useCallback(
    (match: Match) => (
      <MatchCard
        key={match.id}
        match={match}
        settings={settings}
        isMatchInProgress={inProgressMatches[match.id]}
        theme={theme}
        isReadOnly={isReadOnly}
        onResetMatch={handleResetRequest}
        onPlay={handlePlayMatch}
        onMatchPress={handlePressMatch}
      />
    ),
    [
      settings,
      inProgressMatches,
      theme,
      isReadOnly,
      handleResetRequest,
      handlePlayMatch,
      handlePressMatch,
    ],
  );

  return (
    <View style={styles.container}>
      {activeTab === "matches" ? (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {Object.keys(matchesByRound).map((roundKey) => (
            <View key={roundKey} style={styles.roundSection}>
              <View style={styles.roundHeader}>
                <Text style={styles.roundTitle}>
                  {t(language, "round") || "Round"} {roundKey}
                </Text>
              </View>
              {matchesByRound[parseInt(roundKey)].map(renderCard)}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.cellRank]}>#</Text>
              <Text style={[styles.tableCell, styles.cellName]}>
                {t(language, "player") || "Player"}
              </Text>
              <Text style={styles.tableCell}>M</Text>
              <Text style={styles.tableCell}>W</Text>
              <Text style={styles.tableCell}>L</Text>
              <Text style={styles.tableCell}>+/-</Text>
              <Text style={[styles.tableCell, styles.cellPoints]}>Pts</Text>
            </View>
            {standings.map((s: any, idx) => {
              const diff = s.legsFor - s.legsAgainst;
              return (
                <TouchableOpacity
                  key={s.player.id}
                  style={styles.tableRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    const pMatches = matches.filter(
                      (m) =>
                        m.player1?.id === s.player.id ||
                        m.player2?.id === s.player.id,
                    );
                    setSelectedPlayerMatches({
                      player: s.player,
                      matches: pMatches,
                    });
                  }}
                >
                  <Text style={[styles.tableCellData, styles.cellRank]}>
                    {idx + 1}.
                  </Text>
                  <Text
                    style={[
                      styles.tableCellData,
                      styles.cellName,
                      { fontWeight: "800", color: theme.colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {s.player.name}
                  </Text>
                  <Text style={styles.tableCellData}>{s.played}</Text>
                  <Text
                    style={[
                      styles.tableCellData,
                      { color: theme.colors.success },
                    ]}
                  >
                    {s.won}
                  </Text>
                  <Text style={styles.tableCellData}>{s.lost}</Text>
                  <Text
                    style={[
                      styles.tableCellData,
                      {
                        color:
                          diff > 0
                            ? theme.colors.success
                            : diff < 0
                              ? theme.colors.danger
                              : theme.colors.textMuted,
                      },
                    ]}
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </Text>
                  <Text style={[styles.tableCellData, styles.cellPoints]}>
                    {s.points}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <CustomAlert
        visible={resetAlert.visible}
        title={t(language, "resetMatch") || "Restart match"}
        message={
          t(language, "resetMatchConfirm") ||
          "Restart this match? All progress will be lost."
        }
        onRequestClose={() => setResetAlert({ visible: false, matchId: "" })}
        buttons={[
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: () => setResetAlert({ visible: false, matchId: "" }),
          },
          {
            text: t(language, "reset") || "Reset",
            style: "destructive",
            onPress: performResetMatch,
          },
        ]}
      />

      <Modal
        visible={!!selectedPlayerMatches}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPlayerMatches(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedPlayerMatches(null)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedPlayerMatches?.player.name}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedPlayerMatches(null)}
                style={styles.closeModalBtn}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: Dimensions.get("window").height * 0.7 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedPlayerMatches?.matches.map(renderCard)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    listContainer: { paddingHorizontal: 16, paddingTop: 10 },

    roundSection: { marginBottom: 24 },
    roundHeader: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignSelf: "flex-start",
      marginBottom: 12,
    },
    roundTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: "#fff",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    resetMatchBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 10,
      padding: 2,
    },
    matchCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      padding: 12,
      marginBottom: 10,
      elevation: 2,
      height: 148,
      justifyContent: "space-between",
      position: "relative",
    },
    byeCard: { opacity: 0.6, backgroundColor: theme.colors.background },
    playerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
      overflow: "hidden",
    },
    winnerRow: {
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.05)",
      borderRadius: 6,
      paddingHorizontal: 6,
      marginHorizontal: -6,
    },
    winnerText: { color: theme.colors.success || "#28a745", fontWeight: "900" },
    loserRow: {
      backgroundColor: "rgba(220, 53, 69, 0.08)",
      borderRadius: 6,
      paddingHorizontal: 6,
      marginHorizontal: -6,
    },
    loserText: {
      color: theme.colors.textMuted,
      textDecorationLine: "line-through",
    },
    playerName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textMain,
      flexShrink: 1,
      marginRight: 8,
    },
    scoreText: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginRight: 8,
    },
    pendingText: {
      color: theme.colors.textLight,
      fontStyle: "italic",
      fontWeight: "500",
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.background,
      marginVertical: 4,
    },
    actionContainer: { height: 40, justifyContent: "flex-end", marginTop: 8 },
    playButton: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    resumeButton: { backgroundColor: theme.colors.warning || "#f0ad4e" },
    statsButton: {
      flexDirection: "row",
      backgroundColor: "#4b5563",
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    playButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    infoText: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textLight,
      textTransform: "uppercase",
      paddingBottom: 6,
    },

    tableCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      overflow: "hidden",
    },
    tableHeaderRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.cardBorder,
      paddingVertical: 12,
      paddingHorizontal: 10,
    },
    tableRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.colors.background,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    tableCell: {
      flex: 1,
      fontSize: 11,
      fontWeight: "800",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    tableCellData: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    cellRank: { flex: 0.5, textAlign: "left" },
    cellName: { flex: 3, textAlign: "left" },
    cellPoints: {
      fontWeight: "900",
      color: theme.colors.textMain,
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.colors.textMain,
      flex: 1,
      marginRight: 10,
    },
    closeModalBtn: {
      padding: 4,
      backgroundColor: theme.colors.card,
      borderRadius: 20,
    },
  });
