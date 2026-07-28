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
import { getStandardSeeding, orderPlayersBySeed } from "../../lib/bracketSeeding";
import { t } from "../../lib/i18n";
import { DEFAULT_ADVANCING_PER_GROUP, TournamentSettings } from "../../lib/statsUtils";
import { AnimatedPressable } from "../common/AnimatedPressable";
import CustomAlert from "../modals/CustomAlert";
import { BracketTreeShell } from "./common/BracketTreeShell";
import { StandingsTable } from "./common/StandingsTable";
import { WalkoverAlert } from "./common/WalkoverAlert";
import {
  SharedMatch as Match,
  MatchCard,
  SharedPlayer as Player,
} from "./MatchCard";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export interface GroupsAndKnockoutProps {
  players: Player[];
  settings: TournamentSettings;
  viewMode?: "list" | "tree";
  activeTab?: "matches" | "standings";
  onMatchPress: (match: Match) => void;
  initialBracket?: Match[] | null;
  isReadOnly?: boolean;
  phaseView: "group" | "knockout";
  setPhaseView: (phase: "group" | "knockout") => void;
  isHost?: boolean;
  onBracketGenerated?: (bracket: Match[]) => void | Promise<void>;
}

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
  isHost = true,
  onBracketGenerated,
}: GroupsAndKnockoutProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { language } = useLanguage();
  const [dkView, setDkView] = useState<"wb" | "lb" | "gf">("wb");
  const [selectedPlayerMatches, setSelectedPlayerMatches] = useState<{
    player: Player;
    matches: Match[];
  } | null>(null);

  const advancingPerGroup = Math.max(
    1,
    Number(settings.advancingPerGroup) || DEFAULT_ADVANCING_PER_GROUP,
  );

  const checkAndGenerateKnockout = useCallback(
    async (
      currentMatches: Match[],
      persistMatches: (newMatches: Match[]) => Promise<void>,
    ) => {
      const groupPhase = currentMatches.filter((m) => m.phase === "group");
      const koPhase = currentMatches.filter((m) => m.phase === "knockout");
      if (groupPhase.length === 0 || koPhase.length > 0) return;

      const isFinished = groupPhase.every((m) => m.winner !== null || m.isBye);
      if (!isFinished) return;

      const groupIds = Array.from(
        new Set(groupPhase.map((m) => m.groupId!)),
      ).sort();
      const standingsByGroup: Record<string, Player[]> = {};

      groupIds.forEach((gId) => {
        const gMatches = groupPhase.filter((m) => m.groupId === gId);
        const gPlayersMap: Record<string, Player> = {};
        gMatches.forEach((m) => {
          if (m.player1) gPlayersMap[m.player1.id] = m.player1;
          if (m.player2) gPlayersMap[m.player2.id] = m.player2;
        });
        const gPlayers = Object.values(gPlayersMap).filter(
          (p) => p.id !== "bye",
        );

        const stats: Record<
          string,
          { player: Player; pts: number; diff: number; legsFor: number }
        > = {};
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
            const l1 =
              (settings.targetSets || 1) > 1
                ? m.score.p1Sets || 0
                : m.score.p1Legs || 0;
            const l2 =
              (settings.targetSets || 1) > 1
                ? m.score.p2Sets || 0
                : m.score.p2Legs || 0;
            stats[p1].legsFor += l1;
            stats[p2].legsFor += l2;
            stats[p1].diff += l1 - l2;
            stats[p2].diff += l2 - l1;
          }
        });
        const sorted = Object.values(stats).sort((a, b) => {
          if (b.pts !== a.pts) return b.pts - a.pts;
          if (b.diff !== a.diff) return b.diff - a.diff;
          return b.legsFor - a.legsFor;
        });
        standingsByGroup[gId] = sorted.map((s) => s.player);
      });

      const G = groupIds.length;

      const round1Slots: { p1: Player; p2: Player | null }[] = [];
      if (advancingPerGroup === 2) {
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
      } else {
        const tiers: Player[][] = [];
        for (let rank = 0; rank < advancingPerGroup; rank++) {
          const tierPlayers = groupIds
            .map((gId) => standingsByGroup[gId][rank])
            .filter((p): p is Player => !!p);
          tiers.push(tierPlayers);
        }
        const qualifiers = tiers.flat();
        const Q = qualifiers.length;
        if (Q > 0) {
          const bracketSize = Q <= 1 ? 2 : Math.pow(2, Math.ceil(Math.log2(Q)));
          const seedPattern = getStandardSeeding(bracketSize);
          for (let i = 0; i < bracketSize / 2; i++) {
            const p1Index = seedPattern[i * 2] - 1;
            const p2Index = seedPattern[i * 2 + 1] - 1;
            const p1 = qualifiers[p1Index] || null;
            const p2 = qualifiers[p2Index] || null;
            if (p1) round1Slots.push({ p1, p2 });
            else if (p2) round1Slots.push({ p1: p2, p2: null });
          }
        }
      }

      const S = round1Slots.length * 2;
      const totalRounds = Math.log2(S);
      const koMatches: Match[] = [];
      const prefix = Date.now().toString(36);

      if (settings.format === "groups_and_double_knockout") {
        const W = totalRounds;
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
            koMatches.push({
              id: matchId,
              phase: "knockout",
              bracket: "wb",
              round: r,
              matchIndex: m,
              player1: r === 1 ? round1Slots[m].p1 : null,
              player2: r === 1 ? round1Slots[m].p2 : null,
              winner: r === 1 && !round1Slots[m].p2 ? round1Slots[m].p1 : null,
              nextMatchId,
              nextMatchSlot,
              loserDropMatchId,
              loserDropSlot,
              isBye: r === 1 && !round1Slots[m].p2,
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
            koMatches.push({
              id: `match_${prefix}_lb_r${r}_m${m}`,
              phase: "knockout",
              bracket: "lb",
              round: r,
              matchIndex: m,
              player1: null,
              player2: null,
              winner: null,
              nextMatchId,
              nextMatchSlot,
              isBye: false,
            });
          }
        }

        koMatches.push({
          id: `match_${prefix}_gf_m0`,
          phase: "knockout",
          bracket: "gf",
          round: 1,
          matchIndex: 0,
          player1: null,
          player2: null,
          winner: null,
          nextMatchId: `match_${prefix}_gf_m1`,
          nextMatchSlot: "p1",
          isBye: false,
        });
        koMatches.push({
          id: `match_${prefix}_gf_m1`,
          phase: "knockout",
          bracket: "gf",
          round: 2,
          matchIndex: 1,
          player1: null,
          player2: null,
          winner: null,
          nextMatchId: null,
          nextMatchSlot: null,
          isBye: false,
        });

        let loop = true;
        while (loop) {
          let updated = false;
          koMatches.forEach((m) => {
            if (m.winner) {
              if (m.nextMatchId) {
                const nextM = koMatches.find((x) => x.id === m.nextMatchId);
                if (nextM) {
                  if (
                    m.nextMatchSlot === "p1" &&
                    nextM.player1?.id !== m.winner.id
                  ) {
                    nextM.player1 = m.winner;
                    updated = true;
                  } else if (
                    m.nextMatchSlot === "p2" &&
                    nextM.player2?.id !== m.winner.id
                  ) {
                    nextM.player2 = m.winner;
                    updated = true;
                  }
                }
              }
            }
          });
          loop = updated;
        }
      } else {
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
            const nextMatch = koMatches.find(
              (m) => m.id === byeMatch.nextMatchId,
            );
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
      }

      const updatedMatches = [...currentMatches, ...koMatches];
      await persistMatches(updatedMatches);
      setPhaseView("knockout");
    },
    [settings, setPhaseView, advancingPerGroup],
  );

  const onMatchesLoaded = useCallback(
    async (
      currentMatches: Match[],
      persistMatches: (newMatches: Match[]) => Promise<void>,
      source: "initial" | "focus",
    ) => {
      if (currentMatches.some((m: Match) => m.phase === "knockout")) {
        setPhaseView("knockout");
      } else if (source === "focus") {
        setPhaseView("group");
      }
      if (isHost && !isReadOnly) {
        await checkAndGenerateKnockout(currentMatches, persistMatches);
      }
    },
    [isHost, isReadOnly, setPhaseView, checkAndGenerateKnockout],
  );

  const generateGroupPhase = useCallback(
    async (persistMatches: (newMatches: Match[]) => Promise<void>) => {
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

      const pls = orderPlayersBySeed(
        players,
        settings.bracketOrder as string | undefined,
      );
      pls.forEach((p, idx) => {
        groups[groupNames[idx % G]].push(p);
      });

      const newMatches: Match[] = [];
      const prefix = Date.now().toString(36);

      Object.keys(groups).forEach((groupId) => {
        let gPls = [...groups[groupId]];
        if (gPls.length % 2 !== 0)
          gPls.push({ id: "bye", name: t(language, "byePlayer") });
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

      await persistMatches(newMatches);
    },
    [players, settings, language],
  );

  const generateBracket = useCallback(
    async (persistMatches: (newMatches: Match[]) => Promise<void>) => {
      await generateGroupPhase(persistMatches);
      setPhaseView("group");
    },
    [generateGroupPhase, setPhaseView],
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
    onMatchesLoaded,
  });

  const standingsByGroup = useMemo(() => {
    const result: Record<
      string,
      {
        player: Player;
        played: number;
        won: number;
        lost: number;
        legsFor: number;
        legsAgainst: number;
        points: number;
      }[]
    > = {};
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
          const l1 =
            (settings.targetSets || 1) > 1
              ? m.score.p1Sets || 0
              : m.score.p1Legs || 0;
          const l2 =
            (settings.targetSets || 1) > 1
              ? m.score.p2Sets || 0
              : m.score.p2Legs || 0;
          stats[p1].legsFor += l1;
          stats[p1].legsAgainst += l2;
          stats[p2].legsFor += l2;
          stats[p2].legsAgainst += l1;
        }
      });
      result[gId] = Object.values(stats).sort((a, b) => {
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
      if (diff === 0) return t(language, "finals");
      if (diff === 1) return t(language, "semifinals");
      if (diff === 2) return t(language, "quarterfinals");
      return `${t(language, "round")} ${roundNum}`;
    },
    [totalKORounds, language],
  );

  const handlePlayMatch = useCallback(
    async (match: Match) => {
      await markMatchInProgress(match.id);

      setSelectedPlayerMatches(null);
      let matchSettings = { ...settings };
      if (match.phase === "group" && settings.customGroups) {
        matchSettings.targetSets = Number(settings.groupSets);
        matchSettings.targetLegs = Number(settings.groupLegs);
        matchSettings.startingPoints = Number(settings.groupPoints);
      } else if (match.phase === "knockout") {
        if (settings.format === "groups_and_double_knockout") {
          if (settings.customFinals && match.bracket === "gf") {
            matchSettings.targetSets = Number(settings.finalSets);
            matchSettings.targetLegs = Number(settings.finalLegs);
          } else if (settings.customSemis) {
            const totalWBRounds = Math.max(
              ...koMatches
                .filter((m) => m.bracket === "wb")
                .map((m) => m.round),
              1,
            );
            const totalLBRounds = Math.max(
              ...koMatches
                .filter((m) => m.bracket === "lb")
                .map((m) => m.round),
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
        } else {
          if (
            settings.customFinals &&
            match.round === totalKORounds &&
            !match.isThirdPlace
          ) {
            matchSettings.targetSets = Number(settings.finalSets);
            matchSettings.targetLegs = Number(settings.finalLegs);
          } else if (
            settings.customSemis &&
            match.round === totalKORounds - 1 &&
            !match.isThirdPlace
          ) {
            matchSettings.targetSets = Number(settings.semiSets);
            matchSettings.targetLegs = Number(settings.semiLegs);
          }
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
    [markMatchInProgress, koMatches, settings, totalKORounds, router],
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

  const wbRounds = Math.max(
    ...koMatches.filter((m) => m.bracket === "wb").map((m) => m.round),
    0,
  );
  const lbRounds = Math.max(
    ...koMatches.filter((m) => m.bracket === "lb").map((m) => m.round),
    0,
  );
  const totalColumns =
    settings.format === "groups_and_double_knockout"
      ? wbRounds + lbRounds + 1
      : Object.keys(koMatchesByRound).length;
  const calculatedWidth = Math.max(screenWidth, totalColumns * 290 + 150);
  const maxMatchesInColumn =
    settings.format === "groups_and_double_knockout"
      ? Math.max(
          koMatches.filter((m) => m.bracket === "wb" && m.round === 1).length,
          1,
        )
      : Math.max(koMatchesByRound[1]?.length || 1, 1);
  const calculatedHeight = Math.max(
    screenHeight,
    maxMatchesInColumn * 200 + 100,
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
            {t(language, "groupStage")}
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
            {t(language, "knockout")}
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
                      {t(language, "round")} {roundKey}
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
              <StandingsTable
                key={`table-${gId}`}
                theme={theme}
                language={language}
                title={t(language, "groupNumber")?.replace("{{number}}", gId)}
                showLostColumn={false}
                advancingCount={advancingPerGroup}
                standings={standingsByGroup[gId]}
                onPressPlayer={(player) => {
                  const pMatches = matches.filter(
                    (m) =>
                      m.player1?.id === player.id || m.player2?.id === player.id,
                  );
                  setSelectedPlayerMatches({ player, matches: pMatches });
                }}
              />
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
            {t(language, "finishGroupsToUnlock")}
          </Text>
        </View>
      ) : viewMode === "tree" ? (
        <BracketTreeShell
          theme={theme}
          contentWidth={calculatedWidth}
          contentHeight={calculatedHeight}
        >
          {settings.format === "groups_and_double_knockout" ? (
            <View
              style={{
                flexDirection: "row",
                gap: 30,
                padding: 24,
                width: calculatedWidth,
                height: calculatedHeight,
              }}
            >
              {Object.keys(koMatchesByRound).map((roundKey) => {
                const ms = koMatchesByRound[parseInt(roundKey)].filter(
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
              {Object.keys(koMatchesByRound).map((roundKey) => {
                const ms = koMatchesByRound[parseInt(roundKey)].filter(
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
                  {koMatches
                    .filter((m) => m.bracket === "gf")
                    .map((match) => (
                      <View key={match.id} style={styles.treeMatchContainer}>
                        {renderCard(match)}
                      </View>
                    ))}
                </View>
              </View>
            </View>
          ) : (
            <View
              style={{
                width: calculatedWidth,
                height: calculatedHeight,
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
          )}
        </BracketTreeShell>
      ) : (
        <View style={{ flex: 1 }}>
          {settings.format === "groups_and_double_knockout" && (
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
          )}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {Object.keys(koMatchesByRound).map((roundKey) => {
              const rNum = parseInt(roundKey);
              let ms = koMatchesByRound[rNum];
              if (settings.format === "groups_and_double_knockout") {
                ms = ms.filter((m) => m.bracket === dkView);
              }
              if (ms.length === 0) return null;
              return (
                <View key={`ko-list-${roundKey}`} style={styles.roundSection}>
                  <View style={styles.roundHeader}>
                    <Text style={styles.roundTitle}>
                      {settings.format === "groups_and_double_knockout"
                        ? dkView === "wb"
                          ? t(language, "wbRound")?.replace(
                              "{{round}}",
                              roundKey,
                            )
                          : dkView === "lb"
                            ? t(language, "lbRound")?.replace(
                                "{{round}}",
                                roundKey,
                              )
                            : t(language, "grandFinals")
                        : getRoundName(rNum)}
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
