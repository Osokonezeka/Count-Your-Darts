import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useTournamentBracket } from "../../hooks/useTournamentBracket";
import {
  getStandardSeeding,
  orderPlayersBySeed,
  usesExplicitSeedOrder,
} from "../../lib/bracketSeeding";
import { t } from "../../lib/i18n";
import { TournamentSettings } from "../../lib/statsUtils";
import CustomAlert from "../modals/CustomAlert";
import { BracketTreeShell } from "./common/BracketTreeShell";
import { WalkoverAlert } from "./common/WalkoverAlert";
import {
  MatchCard,
  SharedMatch as Match,
  SharedPlayer as Player,
} from "./MatchCard";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export interface SingleKnockoutProps {
  players: Player[];
  settings: TournamentSettings;
  viewMode?: "list" | "tree";
  onMatchPress: (match: Match) => void;
  initialBracket?: Match[] | null;
  isReadOnly?: boolean;
  isHost?: boolean;
  onBracketGenerated?: (bracket: Match[]) => void | Promise<void>;
}

export default function SingleKnockout({
  players,
  settings,
  viewMode = "list",
  onMatchPress,
  initialBracket = null,
  isReadOnly = false,
  isHost = true,
  onBracketGenerated,
}: SingleKnockoutProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { language } = useLanguage();

  const generateBracket = useCallback(
    async (persistMatches: (newMatches: Match[]) => Promise<void>) => {
      const bracketOrder = settings.bracketOrder as string | undefined;
      const playersList = orderPlayersBySeed(players, bracketOrder);
      const N = playersList.length;
      const S = Math.pow(2, Math.ceil(Math.log2(N)));
      const totalRounds = Math.log2(S);
      const newMatches: Match[] = [];
      const generationPrefix = Date.now().toString(36);

      const round1Slots = new Array(S / 2)
        .fill(null)
        .map(() => ({ p1: null as Player | null, p2: null as Player | null }));

      if (usesExplicitSeedOrder(bracketOrder)) {
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
          const nextMatch = newMatches.find(
            (m) => m.id === byeMatch.nextMatchId,
          );
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

      await persistMatches(newMatches);
    },
    [players, settings],
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

  const totalR = useMemo(
    () => Math.max(...matches.map((m) => m.round), 1),
    [matches],
  );

  const getRoundName = useCallback(
    (roundNum: number) => {
      const diff = totalR - roundNum;
      if (diff === 0) return t(language, "finals");
      if (diff === 1) return t(language, "semifinals");
      if (diff === 2) return t(language, "quarterfinals");
      return `${t(language, "round")} ${roundNum}`;
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

  const handlePlayMatch = useCallback(
    async (match: Match) => {
      await markMatchInProgress(match.id);

      let matchSettings = { ...settings };
      if (
        settings.customFinals &&
        match.round === totalR &&
        !match.isThirdPlace
      ) {
        matchSettings.targetSets = Number(settings.finalSets);
        matchSettings.targetLegs = Number(settings.finalLegs);
      } else if (
        settings.customSemis &&
        match.round === totalR - 1 &&
        !match.isThirdPlace
      ) {
        matchSettings.targetSets = Number(settings.semiSets);
        matchSettings.targetLegs = Number(settings.semiLegs);
      }
      router.push({
        pathname: "/tournament/match",
        params: {
          matchData: JSON.stringify(match),
          settingsData: JSON.stringify(matchSettings),
        },
      });
    },
    [markMatchInProgress, settings, totalR, router],
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
        onMatchPress={() => onMatchPress(match)}
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
      onMatchPress,
    ],
  );

  const walkoverMatch = useMemo(
    () => matches.find((m) => m.id === walkoverAlert.matchId) || null,
    [matches, walkoverAlert.matchId],
  );

  const calculatedWidth = Math.max(
    screenWidth,
    Object.keys(matchesByRound).length * 290 + 100,
  );
  const calculatedHeight = Math.max(
    screenHeight,
    (matchesByRound[1]?.length || 1) * 200 + 100,
  );

  return (
    <>
      {viewMode === "tree" ? (
        <BracketTreeShell
          theme={theme}
          contentWidth={calculatedWidth}
          contentHeight={calculatedHeight}
        >
          <View
            style={{
              width: calculatedWidth,
              height: calculatedHeight,
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
        </BracketTreeShell>
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
    </>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
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
  });
