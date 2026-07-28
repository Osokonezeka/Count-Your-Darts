import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useTournamentBracket } from "../../hooks/useTournamentBracket";
import { t } from "../../lib/i18n";
import { TournamentSettings } from "../../lib/statsUtils";
import { AnimatedPressable } from "../common/AnimatedPressable";
import CustomAlert from "../modals/CustomAlert";
import { StandingsTable } from "./common/StandingsTable";
import { WalkoverAlert } from "./common/WalkoverAlert";
import {
  SharedMatch as Match,
  MatchCard,
  SharedPlayer as Player,
} from "./MatchCard";

export interface RoundRobinProps {
  players: Player[];
  settings: TournamentSettings;
  onMatchPress: (match: Match) => void;
  initialBracket?: Match[] | null;
  isReadOnly?: boolean;
  activeTab?: "matches" | "standings";
  isHost?: boolean;
  onBracketGenerated?: (bracket: Match[]) => void | Promise<void>;
}

export default function RoundRobin({
  players,
  settings,
  onMatchPress,
  initialBracket = null,
  isReadOnly = false,
  activeTab = "matches",
  isHost = true,
  onBracketGenerated,
}: RoundRobinProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { language } = useLanguage();
  const [selectedPlayerMatches, setSelectedPlayerMatches] = useState<{
    player: Player;
    matches: Match[];
  } | null>(null);

  const generateBracket = useCallback(
    async (persistMatches: (newMatches: Match[]) => Promise<void>) => {
      let pls = [...players];

      if (settings.bracketOrder === "random" || !settings.bracketOrder) {
        pls = pls.sort(() => 0.5 - Math.random());
      }

      if (pls.length % 2 !== 0) {
        pls.push({ id: "bye", name: t(language, "byePlayer") });
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

      await persistMatches(newMatches);
    },
    [players, settings, language],
  );

  const {
    matches,
    inProgressMatches,
    resetAlert,
    requestReset,
    cancelReset,
    performResetMatch,
    walkoverAlert,
    requestWalkover,
    cancelWalkover,
    performWalkover,
    markMatchInProgress,
  } = useTournamentBracket({
    settings,
    players,
    language,
    initialBracket,
    isReadOnly,
    isHost,
    onBracketGenerated,
    generateBracket,
  });

  const standings = useMemo(() => {
    const stats: Record<
      string,
      {
        player: Player;
        played: number;
        won: number;
        lost: number;
        legsFor: number;
        legsAgainst: number;
        points: number;
      }
    > = {};
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
        if ((settings?.targetSets || 1) > 1) {
          stats[p1].legsFor += m.score.p1Sets || 0;
          stats[p1].legsAgainst += m.score.p2Sets || 0;
          stats[p2].legsFor += m.score.p2Sets || 0;
          stats[p2].legsAgainst += m.score.p1Sets || 0;
        } else {
          stats[p1].legsFor += m.score.p1Legs || 0;
          stats[p1].legsAgainst += m.score.p2Legs || 0;
          stats[p2].legsFor += m.score.p2Legs || 0;
          stats[p2].legsAgainst += m.score.p1Legs || 0;
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

  const handlePlayMatch = useCallback(
    async (match: Match) => {
      await markMatchInProgress(match.id);

      setSelectedPlayerMatches(null);
      router.push({
        pathname: "/tournament/match",
        params: {
          matchData: JSON.stringify(match),
          settingsData: JSON.stringify(settings),
        },
      });
    },
    [markMatchInProgress, settings, router],
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
        onResetMatch={requestReset}
        onWalkover={requestWalkover}
        onPlay={handlePlayMatch}
        onMatchPress={handlePressMatch}
      />
    ),
    [
      settings,
      inProgressMatches,
      theme,
      isReadOnly,
      requestReset,
      requestWalkover,
      handlePlayMatch,
      handlePressMatch,
    ],
  );

  const walkoverMatch = useMemo(
    () => matches.find((m) => m.id === walkoverAlert.matchId) || null,
    [matches, walkoverAlert.matchId],
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
                  {t(language, "round")} {roundKey}
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
          <StandingsTable
            theme={theme}
            language={language}
            standings={standings}
            onPressPlayer={(player) => {
              const pMatches = matches.filter(
                (m) => m.player1?.id === player.id || m.player2?.id === player.id,
              );
              setSelectedPlayerMatches({ player, matches: pMatches });
            }}
          />
        </ScrollView>
      )}

      <CustomAlert
        visible={resetAlert.visible}
        title={t(language, "resetMatch")}
        message={
          t(language, "resetMatchConfirm")
        }
        onRequestClose={cancelReset}
        buttons={[
          {
            text: t(language, "cancel"),
            style: "cancel",
            onPress: cancelReset,
          },
          {
            text: t(language, "reset"),
            style: "destructive",
            onPress: performResetMatch,
          },
        ]}
      />

      <WalkoverAlert
        visible={walkoverAlert.visible}
        match={walkoverMatch}
        language={language}
        onCancel={cancelWalkover}
        onSelectForfeiter={performWalkover}
      />

      <Modal
        visible={!!selectedPlayerMatches}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
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
              <AnimatedPressable
                onPress={() => setSelectedPlayerMatches(null)}
                style={styles.closeModalBtn}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMuted}
                />
              </AnimatedPressable>
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

const getStyles = (theme: { colors: Record<string, string> }) =>
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
