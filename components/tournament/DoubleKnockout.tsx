import { useRouter } from "expo-router";
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

export const resolveAutoMatches = (currentMatches: Match[]) => {
  let changed = false;
  const newMatches = [...currentMatches];
  let loop = true;

  while (loop) {
    let updated = false;
    newMatches.forEach((m) => {
      if (!m.winner && m.player1 && m.player2) {
        let win = null;
        let los = null;
        if (m.player1.id === "bye" && m.player2.id === "bye") {
          win = m.player1;
          los = m.player2;
        } else if (m.player1.id === "bye") {
          win = m.player2;
          los = m.player1;
        } else if (m.player2.id === "bye") {
          win = m.player1;
          los = m.player2;
        }

        if (win && los) {
          m.winner = win;
          m.isBye = true;
          updated = true;
          changed = true;

          if (m.nextMatchId) {
            const nextM = newMatches.find((x) => x.id === m.nextMatchId);
            if (nextM) {
              if (m.nextMatchSlot === "p1") nextM.player1 = win;
              else if (m.nextMatchSlot === "p2") nextM.player2 = win;
              else {
                if (m.matchIndex % 2 === 0) nextM.player1 = win;
                else nextM.player2 = win;
              }
            }
          }
          if (m.loserDropMatchId) {
            const dropM = newMatches.find((x) => x.id === m.loserDropMatchId);
            if (dropM) {
              if (m.loserDropSlot === "p1") dropM.player1 = los;
              else dropM.player2 = los;
            }
          }
        }
      }
    });
    loop = updated;
  }
  return newMatches;
};

export interface DoubleKnockoutProps {
  players: Player[];
  settings: TournamentSettings;
  viewMode?: "list" | "tree";
  onMatchPress: (match: Match) => void;
  initialBracket?: Match[] | null;
  isReadOnly?: boolean;
  isHost?: boolean;
  onBracketGenerated?: (bracket: Match[]) => void | Promise<void>;
}

export default function DoubleKnockout({
  players,
  settings,
  viewMode = "list",
  onMatchPress,
  initialBracket = null,
  isReadOnly = false,
  isHost = true,
  onBracketGenerated,
}: DoubleKnockoutProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { language } = useLanguage();
  const [dkView, setDkView] = useState<"wb" | "lb" | "gf">("wb");

  const generateBracket = useCallback(
    async (persistMatches: (newMatches: Match[]) => Promise<void>) => {
      const bracketOrder = settings.bracketOrder as string | undefined;
      let playersList = orderPlayersBySeed(players, bracketOrder);
      const N = playersList.length;
      const S = Math.max(2, Math.pow(2, Math.ceil(Math.log2(N))));
      const W = Math.log2(S);

      while (playersList.length < S) {
        playersList.push({ id: "bye", name: t(language, "byePlayer") });
      }

      const newMatches: Match[] = [];
      const prefix = Date.now().toString(36);

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
        for (let i = 0; i < S / 2 && pIdx < S; i++)
          round1Slots[i].p1 = playersList[pIdx++];
        for (let i = 0; i < S / 2 && pIdx < S; i++)
          round1Slots[i].p2 = playersList[pIdx++];
      }

      for (let r = 1; r <= W; r++) {
        const matchesInRound = S / Math.pow(2, r);
        for (let m = 0; m < matchesInRound; m++) {
          const isGF = r === W;
          const matchId = `match_${prefix}_wb_r${r}_m${m}`;
          const nextMatchId = isGF
            ? `match_${prefix}_gf_m0`
            : `match_${prefix}_wb_r${r + 1}_m${Math.floor(m / 2)}`;
          const nextMatchSlot = isGF ? "p1" : m % 2 === 0 ? "p1" : "p2";

          let loserDropMatchId = null;
          let loserDropSlot: "p1" | "p2" | null = null;

          if (r === 1) {
            loserDropMatchId = `match_${prefix}_lb_r1_m${Math.floor(m / 2)}`;
            loserDropSlot = m % 2 === 0 ? "p1" : "p2";
          } else {
            const dropRound = 2 * r - 2;
            const dropMatches = S / Math.pow(2, r);
            const targetM = dropMatches - 1 - m;
            loserDropMatchId = `match_${prefix}_lb_r${dropRound}_m${targetM}`;
            loserDropSlot = "p2";
          }

          newMatches.push({
            id: matchId,
            bracket: "wb",
            round: r,
            matchIndex: m,
            player1: r === 1 ? round1Slots[m].p1 : null,
            player2: r === 1 ? round1Slots[m].p2 : null,
            winner: null,
            nextMatchId,
            nextMatchSlot,
            loserDropMatchId,
            loserDropSlot,
            isBye: false,
          });
        }
      }

      let lbSizes: number[] = [];
      let currentSize = S / 4;
      for (let r = 1; r <= 2 * W - 2; r++) {
        lbSizes.push(currentSize);
        if (r % 2 === 0) currentSize /= 2;
      }

      for (let r = 1; r <= 2 * W - 2; r++) {
        const matchesInRound = lbSizes[r - 1];
        for (let m = 0; m < matchesInRound; m++) {
          let nextMatchId = `match_${prefix}_gf_m0`;
          let nextMatchSlot: "p1" | "p2" = "p2";

          if (r < 2 * W - 2) {
            if (r % 2 === 1) {
              nextMatchId = `match_${prefix}_lb_r${r + 1}_m${m}`;
              nextMatchSlot = "p1";
            } else {
              nextMatchId = `match_${prefix}_lb_r${r + 1}_m${Math.floor(m / 2)}`;
              nextMatchSlot = m % 2 === 0 ? "p1" : "p2";
            }
          }

          newMatches.push({
            id: `match_${prefix}_lb_r${r}_m${m}`,
            bracket: "lb",
            round: r,
            matchIndex: m,
            player1: null,
            player2: null,
            winner: null,
            nextMatchId,
            nextMatchSlot,
            loserDropMatchId: null,
            loserDropSlot: null,
            isBye: false,
          });
        }
      }

      newMatches.push({
        id: `match_${prefix}_gf_m0`,
        bracket: "gf",
        round: 1,
        matchIndex: 0,
        player1: null,
        player2: null,
        winner: null,
        nextMatchId: `match_${prefix}_gf_m1`,
        nextMatchSlot: "p1",
        loserDropMatchId: null,
        loserDropSlot: null,
        isBye: false,
      });
      newMatches.push({
        id: `match_${prefix}_gf_m1`,
        bracket: "gf",
        round: 2,
        matchIndex: 1,
        player1: null,
        player2: null,
        winner: null,
        nextMatchId: null,
        nextMatchSlot: null,
        loserDropMatchId: null,
        loserDropSlot: null,
        isBye: false,
      });

      const resolvedMatches = resolveAutoMatches(newMatches);
      await persistMatches(resolvedMatches);
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
      if (settings.customFinals && match.bracket === "gf") {
        matchSettings.targetSets = Number(settings.finalSets);
        matchSettings.targetLegs = Number(settings.finalLegs);
      } else if (settings.customSemis) {
        const totalWBRounds = Math.max(
          ...matches.filter((m) => m.bracket === "wb").map((m) => m.round),
          1,
        );
        const totalLBRounds = Math.max(
          ...matches.filter((m) => m.bracket === "lb").map((m) => m.round),
          1,
        );
        if (
          (match.bracket === "wb" && match.round === totalWBRounds) ||
          (match.bracket === "lb" && match.round === totalLBRounds)
        ) {
          matchSettings.targetSets = Number(settings.semiSets);
          matchSettings.targetLegs = Number(settings.semiLegs);
        }
      }
      router.push({
        pathname: "/tournament/match",
        params: {
          matchData: JSON.stringify(match),
          settingsData: JSON.stringify(matchSettings),
        },
      });
    },
    [markMatchInProgress, matches, settings, router],
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

  const wbRounds = Math.max(
    ...matches.filter((m) => m.bracket === "wb").map((m) => m.round),
    0,
  );
  const lbRounds = Math.max(
    ...matches.filter((m) => m.bracket === "lb").map((m) => m.round),
    0,
  );
  const totalColumns = wbRounds + lbRounds + 1;
  const calculatedWidth = Math.max(screenWidth, totalColumns * 290 + 150);
  const maxMatchesInColumn = Math.max(
    matches.filter((m) => m.bracket === "wb" && m.round === 1).length,
    1,
  );
  const calculatedHeight = Math.max(
    screenHeight,
    maxMatchesInColumn * 200 + 100,
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
              flexDirection: "row",
              gap: 30,
              padding: 24,
              width: calculatedWidth,
              height: calculatedHeight,
            }}
          >
            {Object.keys(matchesByRound).map((roundKey) => {
              const ms = matchesByRound[parseInt(roundKey)].filter(
                (m) => m.bracket === "wb",
              );
              if (ms.length === 0) return null;
              return (
                <View key={`wb-col-${roundKey}`} style={styles.treeColumn}>
                  <Text style={styles.treeRoundTitle}>
                    {t(language, "wbRound")?.replace("{{round}}", roundKey)}
                  </Text>
                  <View style={styles.treeMatchesWrapper}>
                    {ms.map((match, idx) => (
                      <React.Fragment key={match.id}>
                        <View style={styles.treeMatchContainer}>
                          {renderCard(match)}
                        </View>
                        {idx % 2 === 1 && idx !== ms.length - 1 ? (
                          <View style={styles.treeSeparator} />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              );
            })}
            <View
              style={{
                width: 2,
                backgroundColor: theme.colors.cardBorder,
                marginHorizontal: 20,
              }}
            />
            {Object.keys(matchesByRound).map((roundKey) => {
              const ms = matchesByRound[parseInt(roundKey)].filter(
                (m) => m.bracket === "lb",
              );
              if (ms.length === 0) return null;
              return (
                <View key={`lb-col-${roundKey}`} style={styles.treeColumn}>
                  <Text style={styles.treeRoundTitle}>
                    {t(language, "lbRound")?.replace("{{round}}", roundKey)}
                  </Text>
                  <View style={styles.treeMatchesWrapper}>
                    {ms.map((match, idx) => (
                      <React.Fragment key={match.id}>
                        <View style={styles.treeMatchContainer}>
                          {renderCard(match)}
                        </View>
                        {idx % 2 === 1 && idx !== ms.length - 1 ? (
                          <View style={styles.treeSeparator} />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              );
            })}
            <View
              style={{
                width: 2,
                backgroundColor: theme.colors.cardBorder,
                marginHorizontal: 20,
              }}
            />
            <View style={styles.treeColumn}>
              <Text style={styles.treeRoundTitle}>
                {t(language, "grandFinals")}
              </Text>
              <View style={styles.treeMatchesWrapper}>
                {matches
                  .filter((m) => m.bracket === "gf")
                  .map((match) => (
                    <View key={match.id} style={styles.treeMatchContainer}>
                      {renderCard(match)}
                    </View>
                  ))}
              </View>
            </View>
          </View>
        </BracketTreeShell>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.phaseTabsContainer}>
            <TouchableOpacity
              style={[
                styles.phaseTab,
                dkView === "wb" && styles.phaseTabActive,
              ]}
              onPress={() => setDkView("wb")}
            >
              <Text
                style={[
                  styles.phaseTabText,
                  dkView === "wb" && styles.phaseTabTextActive,
                ]}
              >
                {t(language, "winnersBracket")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.phaseTab,
                dkView === "lb" && styles.phaseTabActive,
              ]}
              onPress={() => setDkView("lb")}
            >
              <Text
                style={[
                  styles.phaseTabText,
                  dkView === "lb" && styles.phaseTabTextActive,
                ]}
              >
                {t(language, "losersBracket")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.phaseTab,
                dkView === "gf" && styles.phaseTabActive,
              ]}
              onPress={() => setDkView("gf")}
            >
              <Text
                style={[
                  styles.phaseTabText,
                  dkView === "gf" && styles.phaseTabTextActive,
                ]}
              >
                {t(language, "finals")?.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {Object.keys(matchesByRound).map((roundKey) => {
              const ms = matchesByRound[parseInt(roundKey)].filter(
                (m) => m.bracket === dkView,
              );
              if (ms.length === 0) return null;
              return (
                <View key={roundKey} style={styles.roundSection}>
                  <View style={styles.roundHeader}>
                    <Text style={styles.roundTitle}>
                      {dkView === "wb"
                        ? t(language, "wbRound")?.replace(
                            "{{round}}",
                            roundKey,
                          )
                        : dkView === "lb"
                          ? t(language, "lbRound")?.replace(
                              "{{round}}",
                              roundKey,
                            )
                          : t(language, "grandFinals")}
                    </Text>
                  </View>
                  {ms.map(renderCard)}
                </View>
              );
            })}
          </ScrollView>
        </View>
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
    container: {
      flex: 1,
      paddingTop: 10,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.background,
    },
    phaseTabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    phaseTab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
      borderBottomWidth: 3,
      borderBottomColor: "transparent",
    },
    phaseTabActive: { borderBottomColor: theme.colors.primary },
    phaseTabText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.textMuted,
      letterSpacing: 0.5,
    },
    phaseTabTextActive: { color: theme.colors.primary },
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
