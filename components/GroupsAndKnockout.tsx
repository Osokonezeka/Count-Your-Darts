import { Ionicons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
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

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

type Player = { id: string; name: string };
type Match = {
  id: string;
  phase: "group" | "knockout";
  groupId?: string;
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
        {match.phase === "group" && (
          <Text style={styles.groupBadgeLabel}>Group {match.groupId}</Text>
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
            {p1IsWinner && match.phase === "knockout" && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success || "#28a745"}
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
            {p2IsWinner && match.phase === "knockout" && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success || "#28a745"}
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

export default function GroupsAndKnockout({
  players,
  settings,
  viewMode = "list",
  activeTab = "matches",
  onMatchPress,
  initialBracket = null,
  isReadOnly = false,
  phaseView,
  setPhaseView,
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
          if (initialBracket.some((m: Match) => m.phase === "knockout")) {
            setPhaseView("knockout");
          }
          return;
        }
        try {
          const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
          if (savedBracketStr) {
            const currentMatches = JSON.parse(savedBracketStr) as Match[];
            setMatches(currentMatches);
            if (currentMatches.some((m: Match) => m.phase === "knockout")) {
              setPhaseView("knockout");
            } else {
              setPhaseView("group");
            }
            const progressObj: Record<string, boolean> = {};
            for (const m of currentMatches) {
              const savedScore = await AsyncStorage.getItem(
                `match_save_${m.id}`,
              );
              if (savedScore) progressObj[m.id] = true;
            }
            setInProgressMatches(progressObj);

            if (!isReadOnly) await checkAndGenerateKnockout(currentMatches);
          } else if (players.length > 0 && !isReadOnly) {
            generateGroupPhase();
            setPhaseView("group");
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadTournamentState();
    }, [players, initialBracket, isReadOnly]),
  );

  const checkAndGenerateKnockout = async (currentMatches: Match[]) => {
    const groupPhase = currentMatches.filter((m) => m.phase === "group");
    const koPhase = currentMatches.filter((m) => m.phase === "knockout");
    if (groupPhase.length === 0 || koPhase.length > 0) return;

    const isFinished = groupPhase.every((m) => m.winner !== null || m.isBye);
    if (!isFinished) return;

    const groupIds = Array.from(
      new Set(groupPhase.map((m) => m.groupId!)),
    ).sort();
    const standingsByGroup: Record<string, any[]> = {};

    groupIds.forEach((gId) => {
      const gMatches = groupPhase.filter((m) => m.groupId === gId);
      const gPlayersMap: Record<string, Player> = {};
      gMatches.forEach((m) => {
        if (m.player1) gPlayersMap[m.player1.id] = m.player1;
        if (m.player2) gPlayersMap[m.player2.id] = m.player2;
      });
      const gPlayers = Object.values(gPlayersMap).filter((p) => p.id !== "bye");

      const stats: any = {};
      gPlayers.forEach(
        (p) => (stats[p.id] = { player: p, pts: 0, diff: 0, legsFor: 0 }),
      );
      gMatches.forEach((m) => {
        if (m.isBye || !m.winner || !m.player1 || !m.player2) return;
        const p1 = m.player1.id;
        const p2 = m.player2.id;
        if (m.winner.id === p1) {
          stats[p1].pts++;
        } else {
          stats[p2].pts++;
        }
        if (m.score) {
          const l1 = settings.targetSets > 1 ? m.score.p1Sets : m.score.p1Legs;
          const l2 = settings.targetSets > 1 ? m.score.p2Sets : m.score.p2Legs;
          stats[p1].legsFor += l1;
          stats[p2].legsFor += l2;
          stats[p1].diff += l1 - l2;
          stats[p2].diff += l2 - l1;
        }
      });
      const sorted = Object.values(stats).sort((a: any, b: any) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.legsFor - a.legsFor;
      });
      standingsByGroup[gId] = sorted.map((s: any) => s.player);
    });

    const G = groupIds.length;
    const N = players.length;
    let A = 2;

    const round1Slots = [];
    if (G === 1) {
      round1Slots.push({
        p1: standingsByGroup[groupIds[0]][0],
        p2: standingsByGroup[groupIds[0]][1] || null,
      });
    } else {
      for (let i = 0; i < G; i++) {
        const g1 = groupIds[i];
        const g2 = groupIds[(i + Math.ceil(G / 2)) % G];
        round1Slots.push({
          p1: standingsByGroup[g1][0],
          p2: standingsByGroup[g2][1] || null,
        });
      }
    }

    const S = round1Slots.length * 2;
    const totalRounds = Math.log2(S);
    const koMatches: Match[] = [];
    const prefix = Date.now().toString(36);

    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = S / Math.pow(2, r);
      for (let m = 0; m < matchesInRound; m++) {
        const matchId = `match_${prefix}_ko_r${r}_m${m}`;
        const nextId =
          r < totalRounds
            ? `match_${prefix}_ko_r${r + 1}_m${Math.floor(m / 2)}`
            : null;

        if (r === 1) {
          const slot = round1Slots[m];
          const isBye = !slot.p2;
          koMatches.push({
            id: matchId,
            phase: "knockout",
            round: r,
            matchIndex: m,
            player1: slot.p1,
            player2: slot.p2,
            winner: isBye ? slot.p1 : null,
            nextMatchId: nextId,
            isBye,
          });
        } else {
          koMatches.push({
            id: matchId,
            phase: "knockout",
            round: r,
            matchIndex: m,
            player1: null,
            player2: null,
            winner: null,
            nextMatchId: nextId,
            isBye: false,
          });
        }
      }
    }

    koMatches
      .filter((m) => m.round === 1 && m.isBye)
      .forEach((byeMatch) => {
        const nextMatch = koMatches.find((m) => m.id === byeMatch.nextMatchId);
        if (nextMatch) {
          if (byeMatch.matchIndex % 2 === 0)
            nextMatch.player1 = byeMatch.winner;
          else nextMatch.player2 = byeMatch.winner;
        }
      });

    if (settings.thirdPlaceMatch && totalRounds > 1) {
      koMatches.push({
        id: `match_${prefix}_ko_third_place`,
        phase: "knockout",
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

    const updatedMatches = [...currentMatches, ...koMatches];
    setMatches(updatedMatches);
    await AsyncStorage.setItem(
      bracketStorageKey,
      JSON.stringify(updatedMatches),
    );
    setPhaseView("knockout");
  };

  const generateGroupPhase = async () => {
    const N = players.length;
    let G = 1;

    if (N <= 4) G = 1;
    else if (N <= 8) G = 2;
    else if (N <= 16) G = 4;
    else if (N <= 32) G = 8;
    else if (N <= 64) G = 16;
    else G = 32;

    const groups: Record<string, Player[]> = {};
    const groupNames = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (let i = 0; i < G; i++) groups[groupNames[i]] = [];

    let pls = [...players];
    if (settings.bracketOrder === "random" || !settings.bracketOrder) {
      pls = pls.sort(() => 0.5 - Math.random());
    }
    pls.forEach((p, idx) => {
      groups[groupNames[idx % G]].push(p);
    });

    const newMatches: Match[] = [];
    const prefix = Date.now().toString(36);

    Object.keys(groups).forEach((groupId) => {
      let gPls = [...groups[groupId]];
      if (gPls.length % 2 !== 0) gPls.push({ id: "bye", name: "Bye" });
      const numPls = gPls.length;
      const rounds = numPls - 1;
      const matchesPerRound = numPls / 2;

      for (let r = 0; r < rounds; r++) {
        for (let m = 0; m < matchesPerRound; m++) {
          const p1 = gPls[m];
          const p2 = gPls[numPls - 1 - m];
          const isBye = p1.id === "bye" || p2.id === "bye";

          newMatches.push({
            id: `match_${prefix}_g${groupId}_r${r + 1}_m${m}`,
            phase: "group",
            groupId: groupId,
            round: r + 1,
            matchIndex: m,
            player1: p1.id === "bye" ? null : p1,
            player2: p2.id === "bye" ? null : p2,
            winner: isBye ? (p1.id === "bye" ? p2 : p1) : null,
            nextMatchId: null,
            isBye,
          });
        }
        gPls = [gPls[0], gPls[numPls - 1], ...gPls.slice(1, numPls - 1)];
      }
    });

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
      console.error(e);
    }
    setResetAlert({ visible: false, matchId: "" });
  };

  const standingsByGroup = useMemo(() => {
    const result: Record<string, any[]> = {};
    const groupMatches = matches.filter((m) => m.phase === "group");
    const groupIds = Array.from(
      new Set(groupMatches.map((m) => m.groupId!)),
    ).sort();

    groupIds.forEach((gId) => {
      const gMatches = groupMatches.filter((m) => m.groupId === gId);
      const gPlayersMap: Record<string, Player> = {};
      gMatches.forEach((m) => {
        if (m.player1) gPlayersMap[m.player1.id] = m.player1;
        if (m.player2) gPlayersMap[m.player2.id] = m.player2;
      });
      const gPlayers = Object.values(gPlayersMap).filter((p) => p.id !== "bye");

      const stats: any = {};
      gPlayers.forEach(
        (p) =>
          (stats[p.id] = {
            player: p,
            played: 0,
            won: 0,
            lost: 0,
            legsFor: 0,
            legsAgainst: 0,
            points: 0,
          }),
      );
      gMatches.forEach((m) => {
        if (m.isBye || !m.winner || !m.player1 || !m.player2) return;
        const p1 = m.player1.id;
        const p2 = m.player2.id;
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
          const l1 = settings.targetSets > 1 ? m.score.p1Sets : m.score.p1Legs;
          const l2 = settings.targetSets > 1 ? m.score.p2Sets : m.score.p2Legs;
          stats[p1].legsFor += l1;
          stats[p1].legsAgainst += l2;
          stats[p2].legsFor += l2;
          stats[p2].legsAgainst += l1;
        }
      });
      result[gId] = Object.values(stats).sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.legsFor - a.legsAgainst;
        const diffB = b.legsFor - b.legsAgainst;
        if (diffA !== diffB) return diffB - diffA;
        return b.legsFor - a.legsFor;
      });
    });
    return result;
  }, [matches, settings]);

  const groupMatchesByRound = useMemo(() => {
    return matches
      .filter((m) => m.phase === "group")
      .reduce(
        (acc: Record<number, Match[]>, match: Match) => {
          if (!acc[match.round]) acc[match.round] = [];
          acc[match.round].push(match);
          return acc;
        },
        {} as Record<number, Match[]>,
      );
  }, [matches]);

  const koMatches = useMemo(
    () => matches.filter((m) => m.phase === "knockout"),
    [matches],
  );
  const koMatchesByRound = useMemo(() => {
    return koMatches.reduce(
      (acc: Record<number, Match[]>, match: Match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      },
      {} as Record<number, Match[]>,
    );
  }, [koMatches]);

  const totalKORounds = useMemo(
    () => Math.max(...koMatches.map((m) => m.round), 1),
    [koMatches],
  );

  const getRoundName = useCallback(
    (roundNum: number) => {
      const diff = totalKORounds - roundNum;
      if (diff === 0) return t(language, "finals") || "Finals";
      if (diff === 1) return t(language, "semifinals") || "Semifinals";
      if (diff === 2) return t(language, "quarterfinals") || "Quarterfinals";
      return `${t(language, "round") || "Round"} ${roundNum}`;
    },
    [totalKORounds, language],
  );

  const handleResetRequest = useCallback((matchId: string) => {
    setResetAlert({ visible: true, matchId });
  }, []);

  const handlePlayMatch = useCallback(
    (match: Match) => {
      setSelectedPlayerMatches(null);
      let matchSettings = { ...settings };
      if (match.phase === "group" && settings.customGroups) {
        matchSettings.targetSets = settings.groupSets;
        matchSettings.targetLegs = settings.groupLegs;
        matchSettings.startingPoints = settings.groupPoints;
      } else if (match.phase === "knockout") {
        if (
          settings.customFinals &&
          match.round === totalKORounds &&
          !match.isThirdPlace
        ) {
          matchSettings.targetSets = settings.finalSets;
          matchSettings.targetLegs = settings.finalLegs;
        } else if (
          settings.customSemis &&
          match.round === totalKORounds - 1 &&
          !match.isThirdPlace
        ) {
          matchSettings.targetSets = settings.semiSets;
          matchSettings.targetLegs = settings.semiLegs;
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
    [settings, totalKORounds, router],
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
      <View style={styles.phaseTabsContainer}>
        <TouchableOpacity
          style={[
            styles.phaseTab,
            phaseView === "group" && styles.phaseTabActive,
          ]}
          onPress={() => setPhaseView("group")}
        >
          <Text
            style={[
              styles.phaseTabText,
              phaseView === "group" && styles.phaseTabTextActive,
            ]}
          >
            GROUP STAGE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.phaseTab,
            phaseView === "knockout" && styles.phaseTabActive,
          ]}
          onPress={() => setPhaseView("knockout")}
        >
          <Text
            style={[
              styles.phaseTabText,
              phaseView === "knockout" && styles.phaseTabTextActive,
            ]}
          >
            KNOCKOUT
          </Text>
        </TouchableOpacity>
      </View>

      {phaseView === "group" ? (
        activeTab === "matches" ? (
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {Object.keys(groupMatchesByRound).map((roundKey) => {
              const roundMatches = groupMatchesByRound[parseInt(roundKey)].sort(
                (a, b) => a.groupId!.localeCompare(b.groupId!),
              );
              return (
                <View key={`g-round-${roundKey}`} style={styles.roundSection}>
                  <View style={styles.roundHeader}>
                    <Text style={styles.roundTitle}>
                      {t(language, "round") || "Round"} {roundKey}
                    </Text>
                  </View>
                  {roundMatches.map(renderCard)}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {Object.keys(standingsByGroup).map((gId) => (
              <View key={`table-${gId}`} style={{ marginBottom: 24 }}>
                <View
                  style={[
                    styles.roundHeader,
                    {
                      backgroundColor: theme.colors.cardBorder,
                      alignSelf: "stretch",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roundTitle,
                      { color: theme.colors.textMain },
                    ]}
                  >
                    Group {gId}
                  </Text>
                </View>
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableCell, styles.cellRank]}>#</Text>
                    <Text style={[styles.tableCell, styles.cellName]}>
                      {t(language, "player") || "Player"}
                    </Text>
                    <Text style={styles.tableCell}>M</Text>
                    <Text style={styles.tableCell}>W</Text>
                    <Text style={styles.tableCell}>+/-</Text>
                    <Text style={[styles.tableCell, styles.cellPoints]}>
                      Pts
                    </Text>
                  </View>
                  {standingsByGroup[gId].map((s: any, idx) => {
                    const diff = s.legsFor - s.legsAgainst;
                    let A = 2;
                    const isAdvancing = idx < A;
                    return (
                      <TouchableOpacity
                        key={s.player.id}
                        style={[
                          styles.tableRow,
                          isAdvancing && styles.advancingRow,
                        ]}
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
              </View>
            ))}
          </ScrollView>
        )
      ) : koMatches.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Ionicons
            name="lock-closed"
            size={48}
            color={theme.colors.cardBorder}
          />
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 16,
              marginTop: 10,
              textAlign: "center",
            }}
          >
            Finish all group stage matches to unlock the Knockout Bracket.
          </Text>
        </View>
      ) : viewMode === "tree" ? (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ReactNativeZoomableView
            maxZoom={1.5}
            minZoom={0.2}
            zoomStep={0.5}
            initialZoom={1}
            bindToBorders={true}
            contentWidth={Math.max(
              screenWidth,
              Object.keys(koMatchesByRound).length * 290 + 100,
            )}
            contentHeight={Math.max(
              screenHeight,
              (koMatchesByRound[1]?.length || 1) * 170 + 100,
            )}
            panBoundaryPadding={50}
            style={{ flex: 1 }}
          >
            <View
              style={{
                width: Math.max(
                  screenWidth,
                  Object.keys(koMatchesByRound).length * 290 + 100,
                ),
                height: Math.max(
                  screenHeight,
                  (koMatchesByRound[1]?.length || 1) * 170 + 100,
                ),
                flexDirection: "row",
                gap: 30,
                padding: 24,
              }}
            >
              {Object.keys(koMatchesByRound).map((roundKey) => {
                const roundNum = parseInt(roundKey);
                return (
                  <View key={`ko-col-${roundKey}`} style={styles.treeColumn}>
                    <Text style={styles.treeRoundTitle}>
                      {getRoundName(roundNum)}
                    </Text>
                    <View style={styles.treeMatchesWrapper}>
                      {koMatchesByRound[roundNum].map((match, idx) => (
                        <React.Fragment key={match.id}>
                          <View style={styles.treeMatchContainer}>
                            {renderCard(match)}
                          </View>
                          {idx % 2 === 1 &&
                          idx !== koMatchesByRound[roundNum].length - 1 &&
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
          style={styles.listContainer}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {Object.keys(koMatchesByRound).map((roundKey) => (
            <View key={`ko-list-${roundKey}`} style={styles.roundSection}>
              <View style={styles.roundHeader}>
                <Text style={styles.roundTitle}>
                  {getRoundName(parseInt(roundKey))}
                </Text>
              </View>
              {koMatchesByRound[parseInt(roundKey)].map(renderCard)}
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
    listContainer: { paddingHorizontal: 16, paddingTop: 16 },
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
    groupBadgeLabel: {
      position: "absolute",
      top: -8,
      left: 10,
      backgroundColor: theme.colors.cardBorder,
      color: theme.colors.textMain,
      paddingHorizontal: 8,
      paddingVertical: 2,
      fontSize: 10,
      fontWeight: "900",
      borderRadius: 8,
      overflow: "hidden",
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
    advancingRow: { backgroundColor: "rgba(40, 167, 69, 0.05)" },
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
