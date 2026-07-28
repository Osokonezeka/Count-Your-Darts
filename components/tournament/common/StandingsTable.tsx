import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { t } from "../../../lib/i18n";
import { AnimatedPressable } from "../../common/AnimatedPressable";
import { SharedPlayer as Player } from "../MatchCard";
import { AppTheme } from "./BracketTreeShell";

export interface StandingRow {
  player: Player;
  played: number;
  won: number;
  lost: number;
  legsFor: number;
  legsAgainst: number;
  points: number;
}

export interface StandingsTableProps {
  theme: AppTheme;
  language: Parameters<typeof t>[0];
  standings: StandingRow[];
  onPressPlayer?: (player: Player) => void;
  title?: string;
  showLostColumn?: boolean;
  advancingCount?: number;
}

export function StandingsTable({
  theme,
  language,
  standings,
  onPressPlayer,
  title,
  showLostColumn = true,
  advancingCount = 0,
}: StandingsTableProps) {
  const styles = getStyles(theme);

  return (
    <View style={title ? styles.groupWrapper : undefined}>
      {title && (
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>{title}</Text>
        </View>
      )}
      <View style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableCell, styles.cellRank]}>#</Text>
          <Text style={[styles.tableCell, styles.cellName]}>
            {t(language, "player")}
          </Text>
          <Text style={styles.tableCell}>
            {t(language, "matchesShort")}
          </Text>
          <Text style={styles.tableCell}>
            {t(language, "winsShort")}
          </Text>
          {showLostColumn && (
            <Text style={styles.tableCell}>
              {t(language, "lossesShort")}
            </Text>
          )}
          <Text style={styles.tableCell}>
            {t(language, "diffShort")}
          </Text>
          <Text style={[styles.tableCell, styles.cellPoints]}>
            {t(language, "pts")}
          </Text>
        </View>
        {standings.map((s, idx) => {
          const diff = s.legsFor - s.legsAgainst;
          const isAdvancing = idx < advancingCount;
          return (
            <AnimatedPressable
              key={s.player.id}
              style={[styles.tableRow, isAdvancing && styles.advancingRow]}
              onPress={() => onPressPlayer?.(s.player)}
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
                style={[styles.tableCellData, { color: theme.colors.success }]}
              >
                {s.won}
              </Text>
              {showLostColumn && (
                <Text style={styles.tableCellData}>{s.lost}</Text>
              )}
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
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    groupWrapper: { marginBottom: 24 },
    titleBar: {
      backgroundColor: theme.colors.cardBorder,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignSelf: "stretch",
      marginBottom: 12,
    },
    titleText: {
      fontSize: 14,
      fontWeight: "900",
      color: theme.colors.textMain,
      textTransform: "uppercase",
      letterSpacing: 1,
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
  });
