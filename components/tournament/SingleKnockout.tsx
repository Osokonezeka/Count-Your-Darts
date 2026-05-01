import { Ionicons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import CustomAlert from "../modals/CustomAlert";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

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
  isThirdPlace?: boolean;
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

    let p1ScoreDisplay: string | null = null;
    let p2ScoreDisplay: string | null = null;

    if (match.score) {
      if (
        settings?.targetSets > 1 ||
        match.score.p1Sets > 0 ||
        match.score.p2Sets > 0
      ) {
        p1ScoreDisplay = `${match.score.p1Sets}S ${match.score.p1Legs}L`;
        p2ScoreDisplay = `${match.score.p2Sets}S ${match.score.p2Legs}L`;
      } else {
        p1ScoreDisplay = `${match.score.p1Legs}`;
        p2ScoreDisplay = `${match.score.p2Legs}`;
      }
    } else if (match.stats) {
      const legsStat = match.stats.find((s: any) => s.label === "Legs");
      if (legsStat) {
        p1ScoreDisplay = `${legsStat.p1}`;
        p2ScoreDisplay = `${legsStat.p2}`;
      }
    }

    return (
      <TouchableOpacity
        style={[
          styles.matchCard,
          match.isBye && styles.byeCard,
          match.isThirdPlace && styles.thirdPlaceCard,
        ]}
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

        {match.isThirdPlace && (
          <Text style={styles.thirdPlaceLabel}>
            {t(language, "thirdPlaceMatchLabel") || "3rd Place Match 🥉"}
          </Text>
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

            {p1IsWinner && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success || "#28a745"}
              />
            )}
            {p1IsLoser && (
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.danger || "#dc3545"}
              />
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

            {p2IsWinner && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success || "#28a745"}
              />
            )}
            {p2IsLoser && (
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.danger || "#dc3545"}
              />
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

export default function SingleKnockout({
  players,
  settings,
  viewMode = "list",
  onMatchPress,
  initialBracket = null,
  isReadOnly = false,
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
    let playersList = [...players];
    if (settings.bracketOrder === "random" || !settings.bracketOrder) {
      playersList = playersList.sort(() => 0.5 - Math.random());
    } else if (settings.bracketOrder === "bottom_to_top") {
      playersList = playersList.reverse();
    }
    const N = playersList.length;
    const S = Math.pow(2, Math.ceil(Math.log2(N)));
    const totalRounds = Math.log2(S);
    const newMatches: Match[] = [];
    const generationPrefix = Date.now().toString(36);

    const getStandardSeeding = (numPlayers: number) => {
      let rounds = Math.log2(numPlayers);
      let pls = [1, 2];
      for (let i = 1; i < rounds; i++) {
        let out: number[] = [];
        let length = pls.length * 2 + 1;
        pls.forEach((d) => {
          out.push(d);
          out.push(length - d);
        });
        pls = out;
      }
      return pls;
    };

    const round1Slots = new Array(S / 2)
      .fill(null)
      .map(() => ({ p1: null as Player | null, p2: null as Player | null }));

    if (
      settings.bracketOrder === "top_to_bottom" ||
      settings.bracketOrder === "bottom_to_top"
    ) {
      const seedPattern = getStandardSeeding(S);
      for (let i = 0; i < S / 2; i++) {
        const p1Index = seedPattern[i * 2] - 1;
        const p2Index = seedPattern[i * 2 + 1] - 1;
        round1Slots[i].p1 = playersList[p1Index] || null;
        round1Slots[i].p2 = playersList[p2Index] || null;
      }
    } else {
      let pIdx = 0;
      for (let i = 0; i < S / 2 && pIdx < N; i++)
        round1Slots[i].p1 = playersList[pIdx++];
      for (let i = 0; i < S / 2 && pIdx < N; i++)
        round1Slots[i].p2 = playersList[pIdx++];
    }

    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = S / Math.pow(2, r);
      for (let m = 0; m < matchesInRound; m++) {
        const matchId = `match_${generationPrefix}_r${r}_m${m}`;
        const nextMatchId =
          r < totalRounds
            ? `match_${generationPrefix}_r${r + 1}_m${Math.floor(m / 2)}`
            : null;

        if (r === 1) {
          const isBye = round1Slots[m].p2 === null;
          newMatches.push({
            id: matchId,
            round: r,
            matchIndex: m,
            player1: round1Slots[m].p1,
            player2: round1Slots[m].p2,
            winner: isBye ? round1Slots[m].p1 : null,
            nextMatchId,
            isBye,
          });
        } else {
          newMatches.push({
            id: matchId,
            round: r,
            matchIndex: m,
            player1: null,
            player2: null,
            winner: null,
            nextMatchId,
            isBye: false,
          });
        }
      }
    }

    newMatches
      .filter((m) => m.round === 1 && m.isBye)
      .forEach((byeMatch) => {
        const nextMatch = newMatches.find((m) => m.id === byeMatch.nextMatchId);
        if (nextMatch) {
          if (byeMatch.matchIndex % 2 === 0)
            nextMatch.player1 = byeMatch.winner;
          else nextMatch.player2 = byeMatch.winner;
        }
      });

    if (settings.thirdPlaceMatch && totalRounds > 1) {
      newMatches.push({
        id: `match_${generationPrefix}_third_place`,
        round: totalRounds,
        matchIndex: 1,
        player1: null,
        player2: null,
        winner: null,
        nextMatchId: null,
        isBye: false,
        isThirdPlace: true,
      });
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

  const totalR = useMemo(
    () => Math.max(...matches.map((m) => m.round), 1),
    [matches],
  );

  const getRoundName = useCallback(
    (roundNum: number) => {
      const diff = totalR - roundNum;
      if (diff === 0) return t(language, "finals") || "Finals";
      if (diff === 1) return t(language, "semifinals") || "Semifinals";
      if (diff === 2) return t(language, "quarterfinals") || "Quarterfinals";
      return `${t(language, "round") || "Round"} ${roundNum}`;
    },
    [totalR, language],
  );

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
      let matchSettings = { ...settings };
      if (
        settings.customFinals &&
        match.round === totalR &&
        !match.isThirdPlace
      ) {
        matchSettings.targetSets = settings.finalSets;
        matchSettings.targetLegs = settings.finalLegs;
      } else if (
        settings.customSemis &&
        match.round === totalR - 1 &&
        !match.isThirdPlace
      ) {
        matchSettings.targetSets = settings.semiSets;
        matchSettings.targetLegs = settings.semiLegs;
      }
      router.push({
        pathname: "/tournament/match",
        params: {
          matchData: JSON.stringify(match),
          settingsData: JSON.stringify(matchSettings),
        },
      });
    },
    [settings, totalR, router],
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
        onMatchPress={() => onMatchPress(match)}
      />
    ),
    [
      settings,
      inProgressMatches,
      theme,
      isReadOnly,
      handleResetRequest,
      handlePlayMatch,
      onMatchPress,
    ],
  );

  return (
    <>
      {viewMode === "tree" ? (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ReactNativeZoomableView
            maxZoom={1.5}
            minZoom={0.2}
            zoomStep={0.5}
            initialZoom={1}
            bindToBorders={true}
            contentWidth={Math.max(
              screenWidth,
              Object.keys(matchesByRound).length * 290 + 100,
            )}
            contentHeight={Math.max(
              screenHeight,
              (matchesByRound[1]?.length || 1) * 170 + 100,
            )}
            panBoundaryPadding={50}
            style={{ flex: 1 }}
          >
            <View
              style={{
                width: Math.max(
                  screenWidth,
                  Object.keys(matchesByRound).length * 290 + 100,
                ),
                height: Math.max(
                  screenHeight,
                  (matchesByRound[1]?.length || 1) * 170 + 100,
                ),
                flexDirection: "row",
                gap: 30,
                padding: 24,
              }}
            >
              {Object.keys(matchesByRound).map((roundKey) => {
                const roundNum = parseInt(roundKey);
                return (
                  <View key={`column-${roundKey}`} style={styles.treeColumn}>
                    <Text style={styles.treeRoundTitle}>
                      {getRoundName(roundNum)}
                    </Text>
                    <View style={styles.treeMatchesWrapper}>
                      {matchesByRound[roundNum].map((match, idx) => (
                        <React.Fragment key={match.id}>
                          <View style={styles.treeMatchContainer}>
                            {renderCard(match)}
                          </View>
                          {idx % 2 === 1 &&
                          idx !== matchesByRound[roundNum].length - 1 &&
                          !match.isThirdPlace ? (
                            <View style={styles.treeSeparator} />
                          ) : null}
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </ReactNativeZoomableView>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {Object.keys(matchesByRound).map((roundKey) => (
            <View key={roundKey} style={styles.roundSection}>
              <View style={styles.roundHeader}>
                <Text style={styles.roundTitle}>
                  {getRoundName(parseInt(roundKey))}
                </Text>
              </View>
              {matchesByRound[parseInt(roundKey)].map(renderCard)}
            </View>
          ))}
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
    </>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, paddingTop: 10, paddingHorizontal: 16 },
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
    treeColumn: { width: 260, height: "100%" },
    treeRoundTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMuted,
      textAlign: "center",
      textTransform: "uppercase",
      marginBottom: 16,
    },
    treeMatchesWrapper: { flex: 1, justifyContent: "space-around" },
    treeMatchContainer: { paddingVertical: 8 },
    treeSeparator: {
      height: 1,
      backgroundColor: theme.colors.cardBorder,
      width: "60%",
      alignSelf: "center",
      marginVertical: 15,
      opacity: 0.5,
      borderStyle: "dashed",
      borderWidth: 0.5,
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
    thirdPlaceCard: {
      borderColor: "#cd7f32",
      borderWidth: 2,
      borderStyle: "dashed",
    },
    thirdPlaceLabel: {
      fontSize: 12,
      color: "#cd7f32",
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 4,
    },
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
  });
