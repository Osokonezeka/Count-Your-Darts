import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { t } from "../../lib/i18n";
import { MatchStatItem, TournamentSettings } from "../../lib/statsUtils";
import { AnimatedPressable } from "../common/AnimatedPressable";

export type SharedPlayer = { id: string; name: string };

export type SharedMatch = {
  id: string;
  phase?: "group" | "knockout";
  groupId?: string;
  bracket?: "wb" | "lb" | "gf";
  round: number;
  matchIndex: number;
  player1: SharedPlayer | null;
  player2: SharedPlayer | null;
  winner: SharedPlayer | null;
  nextMatchId: string | null;
  nextMatchSlot?: "p1" | "p2" | null;
  loserDropMatchId?: string | null;
  loserDropSlot?: "p1" | "p2" | null;
  isBye: boolean;
  isThirdPlace?: boolean;
  isInProgress?: boolean;
  inProgressDeviceName?: string | null;
  inProgressDeviceId?: string | null;
  hasProgress?: boolean;
  stats?: MatchStatItem[];
  score?: { p1Sets: number; p1Legs: number; p2Sets: number; p2Legs: number };
  [key: string]: unknown;
};

export const MatchCard = React.memo(
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
    match: SharedMatch;
    isMatchInProgress: boolean;
    theme: { colors: Record<string, string> };
    onPlay: (match: SharedMatch) => void;
    onMatchPress?: (match: SharedMatch) => void;
    isReadOnly: boolean;
    onResetMatch?: (matchId: string) => void;
    settings?: TournamentSettings;
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
    const showCheckmarks = match.phase !== "group";

    const isLocalOwner = isMatchInProgress;
    const hasScoreProgress =
      !!match.score &&
      (match.score.p1Sets > 0 ||
        match.score.p1Legs > 0 ||
        match.score.p2Sets > 0 ||
        match.score.p2Legs > 0);
    const isEffectivelyInProgress =
      isLocalOwner || hasScoreProgress || !!match.hasProgress;

    return (
      <AnimatedPressable
        style={[
          styles.matchCard,
          match.isBye && styles.byeCard,
          match.isThirdPlace && styles.thirdPlaceCard,
        ]}
        onPress={
          isClickable && onMatchPress ? () => onMatchPress(match) : undefined
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {match.isThirdPlace && (
              <View style={styles.thirdPlaceBadge}>
                <Text style={styles.thirdPlaceLabel}>
                  {t(language, "thirdPlaceMatchLabel") || "3rd Place 🥉"}
                </Text>
              </View>
            )}
            {match.phase === "group" && match.groupId && (
              <Text style={styles.groupBadgeLabel}>
                {(t(language, "groupNumber") || "Group {{number}}").replace(
                  "{{number}}",
                  match.groupId,
                )}
              </Text>
            )}
            {match.isInProgress && match.inProgressDeviceName && (
              <View style={styles.devicePlayingBadge}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={10}
                  color={theme.colors.warning}
                />
                <Text style={styles.deviceText} numberOfLines={1}>
                  {match.inProgressDeviceName}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardHeaderRight}>
            {isEffectivelyInProgress &&
              !match.isInProgress &&
              !hasWinner &&
              !isReadOnly &&
              onResetMatch && (
                <AnimatedPressable
                  style={styles.resetMatchBtn}
                  onPress={() => onResetMatch(match.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={14}
                    color={theme.colors.danger || "#dc3545"}
                  />
                </AnimatedPressable>
              )}
          </View>
        </View>

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

            {p1IsWinner && showCheckmarks && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success || "#28a745"}
              />
            )}
            {p1IsLoser && showCheckmarks && (
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

            {p2IsWinner && showCheckmarks && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success || "#28a745"}
              />
            )}
            {p2IsLoser && showCheckmarks && (
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
            <AnimatedPressable
              style={styles.statsButton}
              onPress={() => onMatchPress && onMatchPress(match)}
            >
              <Ionicons name="stats-chart" size={16} color="#fff" />
              <Text style={styles.playButtonText}>
                {t(language, "stats") || "Statistics"}
              </Text>
            </AnimatedPressable>
          ) : !isReadOnly && !match.isBye && !isWaiting ? (
            match.isInProgress ? (
              <View style={styles.inProgressBadge}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={theme.colors.warning}
                />
                <Text style={styles.inProgressText}>
                  {t(language, "inProgress") || "In progress"}
                </Text>
              </View>
            ) : (
              <AnimatedPressable
                style={[
                  styles.playButton,
                  isEffectivelyInProgress && styles.resumeButton,
                ]}
                onPress={() => onPlay(match)}
              >
                <Ionicons
                  name={isEffectivelyInProgress ? "play-forward" : "play"}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.playButtonText}>
                  {isEffectivelyInProgress
                    ? t(language, "resume") || "Resume"
                    : t(language, "start") || "Play"}
                </Text>
              </AnimatedPressable>
            )
          ) : match.isBye ? (
            <Text style={styles.infoText}>
              {t(language, "byePlayer") || "Bye"}
            </Text>
          ) : null}
        </View>
      </AnimatedPressable>
    );
  },
);

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    resetMatchBtn: {
      padding: 4,
      backgroundColor: theme.colors.dangerLight || "rgba(220, 53, 69, 0.1)",
      borderRadius: 6,
    },
    matchCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      padding: 12,
      marginBottom: 10,
      elevation: 2,
      height: 176,
      justifyContent: "space-between",
    },
    byeCard: { opacity: 0.6, backgroundColor: theme.colors.background },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
      paddingBottom: 8,
      marginBottom: 4,
      minHeight: 28,
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
      marginRight: 8,
    },
    cardHeaderRight: {
      justifyContent: "flex-start",
    },
    devicePlayingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.warning + "20",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.warning + "40",
    },
    deviceText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.colors.warning,
    },
    thirdPlaceCard: {
      borderColor: "#cd7f32",
      borderWidth: 2,
      borderStyle: "dashed",
    },
    thirdPlaceBadge: {
      backgroundColor: "rgba(205, 127, 50, 0.1)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    thirdPlaceLabel: {
      fontSize: 10,
      color: "#cd7f32",
      fontWeight: "bold",
    },
    groupBadgeLabel: {
      backgroundColor: theme.colors.cardBorder,
      color: theme.colors.textMain,
      paddingHorizontal: 8,
      paddingVertical: 2,
      fontSize: 10,
      fontWeight: "900",
      borderRadius: 6,
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
    inProgressBadge: {
      flexDirection: "row",
      backgroundColor: theme.colors.warning + "20",
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    inProgressText: {
      color: theme.colors.warning,
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
