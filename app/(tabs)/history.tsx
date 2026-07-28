import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/pl";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { getSharedScreenStyles } from "../../components/common/SharedScreenStyles";
import CustomAlert from "../../components/modals/CustomAlert";
import { HeatmapBoard } from "../../components/statistics/StatisticsComponents";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../hooks/useAlert";
import { t } from "../../lib/i18n";
import {
  ActiveSection,
  getActiveSections,
  getSingleMatchStats,
  MatchHistory,
  ParsedMatchStat,
} from "../../lib/matchStatsMapper";
import { parseDateString } from "../../lib/statsUtils";

export type { MatchHistory } from "../../lib/matchStatsMapper";

const HISTORY_KEY = "@dart_match_history";

const MODE_CONFIG: Record<
  string,
  { bg?: string; text?: string; label: string; route: string }
> = {
  X01: { label: "X01", route: "/gamemodes/dart" },
  Cricket: { label: "CRICKET", route: "/gamemodes/cricket" },
  "Bob's 27": {
    bg: "#fffbeb",
    text: "#f59e0b",
    label: "BOB'S",
    route: "/gamemodes/bobstwentyseven",
  },
  "100 Darts": {
    bg: "#f0f9ff",
    text: "#0ea5e9",
    label: "100",
    route: "/gamemodes/hundreddarts",
  },
  "Around the Clock": {
    bg: "#fdf2f8",
    text: "#ec4899",
    label: "CLOCK",
    route: "/gamemodes/aroundtheclock",
  },
  "Catch 40": {
    bg: "#f5f3ff",
    text: "#8b5cf6",
    label: "C40",
    route: "/gamemodes/catchforty",
  },
  "JDC Challenge": {
    bg: "#e0e7ff",
    text: "#4f46e5",
    label: "JDC",
    route: "/gamemodes/jdcchallenge",
  },
  "Bermuda Triangle": {
    bg: "#ccfbf1",
    text: "#0d9488",
    label: "BERMUDA",
    route: "/gamemodes/bermudatriangle",
  },
  Shanghai: {
    bg: "#fff7ed",
    text: "#ea580c",
    label: "SHANGHAI",
    route: "/gamemodes/shanghai",
  },
  "Halve-It": {
    bg: "#cffafe",
    text: "#0891b2",
    label: "HALVE-IT",
    route: "/gamemodes/halveit",
  },
  Baseball: {
    bg: "#ecfccb",
    text: "#65a30d",
    label: "BASEBALL",
    route: "/gamemodes/baseball",
  },
  "Chase the Dragon": {
    bg: "#fae8ff",
    text: "#c026d3",
    label: "DRAGON",
    route: "/gamemodes/chasethedragon",
  },
  "121_checkout": {
    bg: "#dcfce7",
    text: "#0f766e",
    label: "121",
    route: "/gamemodes/onetwoone",
  },
  Killer: {
    bg: "#fee2e2",
    text: "#b91c1c",
    label: "KILLER",
    route: "/gamemodes/killer",
  },
  "Score Clash": {
    bg: "#ffedd5",
    text: "#c2410c",
    label: "CLASH",
    route: "/gamemodes/scoreclash",
  },
};

const ASCENDING_SCORE_MODES = ["Around the Clock"];

export type { ParsedMatchStat } from "../../lib/matchStatsMapper";

interface MatchStatCardProps {
  item: { id: string; title: string };
  stats: ParsedMatchStat[];
  isOpen: boolean;
  onToggle: () => void;
  collapsedPlayers: Record<string, boolean>;
  onTogglePlayer: (id: string) => void;
  tripleTerm: string;
  missTerm: string;
  bullTerm: string;
  language: Parameters<typeof t>[0];
  theme?: { colors: Record<string, string> };
  mode?: string;
}

const MatchStatCard = React.memo(
  ({
    item,
    stats,
    isOpen,
    onToggle,
    collapsedPlayers,
    onTogglePlayer,
    tripleTerm,
    missTerm,
    bullTerm,
    language,
  }: MatchStatCardProps) => {
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const [sortConfig, setSortConfig] = useState<{
      col: string;
      asc: boolean;
    } | null>(null);

    const handleSort = (col: string) => {
      if (sortConfig?.col === col) {
        if (!sortConfig.asc) setSortConfig({ col, asc: true });
        else setSortConfig(null);
      } else {
        setSortConfig({ col, asc: false });
      }
    };

    const sortedStats = useMemo(() => {
      if (!sortConfig || item.id === "hit_chart") return stats;

      return [...stats].sort((a, b) => {
        let valA: string | number = 0;
        let valB: string | number = 0;
        switch (sortConfig.col) {
          case "name":
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case "avg":
            valA =
              (a.totalDarts || 0) > 0
                ? ((a.totalPoints || 0) / (a.totalDarts || 1)) * 3
                : parseFloat(String(a.avg || 0));
            valB =
              (b.totalDarts || 0) > 0
                ? ((b.totalPoints || 0) / (b.totalDarts || 1)) * 3
                : parseFloat(String(b.avg || 0));
            break;
          case "first9":
            valA =
              (a.first9DartsCount || 0) > 0
                ? ((a.first9DartsPoints || 0) / (a.first9DartsCount || 1)) * 3
                : 0;
            valB =
              (b.first9DartsCount || 0) > 0
                ? ((b.first9DartsPoints || 0) / (b.first9DartsCount || 1)) * 3
                : 0;
            break;
          case "checkoutDarts":
            valA = a.checkoutDarts || 0;
            valB = b.checkoutDarts || 0;
            break;
          case "checkoutPct":
            valA =
              (a.checkoutDarts || 0) > 0
                ? (a.checkoutHits || 0) / (a.checkoutDarts || 1)
                : 0;
            valB =
              (b.checkoutDarts || 0) > 0
                ? (b.checkoutHits || 0) / (b.checkoutDarts || 1)
                : 0;
            break;
          case "s60":
            valA = a.s60 || 0;
            valB = b.s60 || 0;
            break;
          case "s100":
            valA = a.s100 || 0;
            valB = b.s100 || 0;
            break;
          case "s140":
            valA = a.s140 || 0;
            valB = b.s140 || 0;
            break;
          case "s180":
            valA = a.s180 || 0;
            valB = b.s180 || 0;
            break;
          case "score":
            valA = a.score || 0;
            valB = b.score || 0;
            break;
          case "darts":
            valA = a.darts || 0;
            valB = b.darts || 0;
            break;
          case "closed":
            valA = a.closed || 0;
            valB = b.closed || 0;
            break;
          case "mpr":
            valA = parseFloat(a.mpr || "0");
            valB = parseFloat(b.mpr || "0");
            break;
          case "status":
            valA = a.status || "";
            valB = b.status || "";
            break;
          case "targetAvg":
            valA = parseFloat(a.targetAvg || "0");
            valB = parseFloat(b.targetAvg || "0");
            break;
          case "c2":
            valA = a.c2 || 0;
            valB = b.c2 || 0;
            break;
          case "c3":
            valA = a.c3 || 0;
            valB = b.c3 || 0;
            break;
          case "c4_6":
            valA = a.c4_6 || 0;
            valB = b.c4_6 || 0;
            break;
          case "fails":
            valA = a.fails || 0;
            valB = b.fails || 0;
            break;
          case "phase1":
            valA = a.phase1 || 0;
            valB = b.phase1 || 0;
            break;
          case "phase2":
            valA = a.phase2 || 0;
            valB = b.phase2 || 0;
            break;
          case "phase3":
            valA = a.phase3 || 0;
            valB = b.phase3 || 0;
            break;
          case "halves":
            valA = a.halves || 0;
            valB = b.halves || 0;
            break;
          case "shanghais":
            valA = a.shanghais || 0;
            valB = b.shanghais || 0;
            break;
          case "sHits":
            valA = a.sHits || 0;
            valB = b.sHits || 0;
            break;
          case "dHits":
            valA = a.dHits || 0;
            valB = b.dHits || 0;
            break;
          case "tHits":
            valA = a.tHits || 0;
            valB = b.tHits || 0;
            break;
          case "accuracy":
            valA = parseFloat(a.accuracy || "0");
            valB = parseFloat(b.accuracy || "0");
            break;
          case "reached":
            valA = a.reached || 0;
            valB = b.reached || 0;
            break;
          case "scorelessInnings":
            valA = a.scorelessInnings || 0;
            valB = b.scorelessInnings || 0;
            break;
        }

        if (valA === valB) return 0;
        if (typeof valA === "string" && typeof valB === "string")
          return sortConfig.asc
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        return sortConfig.asc
          ? (valA as number) > (valB as number)
            ? 1
            : -1
          : (valA as number) < (valB as number)
            ? 1
            : -1;
      });
    }, [stats, sortConfig, item.id]);

    const renderSortableHeader = (
      label: string,
      colKey: string,
      isName = false,
    ) => {
      const isActive = sortConfig?.col === colKey;
      return (
        <Pressable
          key={colKey}
          style={isName ? styles.colNameWrap : styles.colWrap}
          onPress={() => handleSort(colKey)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: isActive }}
        >
          <Text style={styles.colText}>{label}</Text>
          {isActive && (
            <Ionicons
              name={sortConfig.asc ? "caret-up" : "caret-down"}
              size={12}
              color={theme.colors.success}
              style={{ marginLeft: 2 }}
            />
          )}
        </Pressable>
      );
    };

    return (
      <Animated.View
        style={{
          paddingBottom: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
        }}
        layout={LinearTransition.duration(250)}
      >
        <Animated.View
          style={[
            styles.statCard,
            {
              overflow: "hidden",
              elevation: 0,
              shadowOpacity: 0,
              marginBottom: 0,
            },
          ]}
          layout={LinearTransition.duration(250)}
        >
          <Pressable
            style={styles.sectionHeader}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityState={{ expanded: isOpen }}
          >
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {isOpen && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.table}>
              {item.id === "performance" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "firstNine"),
                      "first9",
                    )}
                    {renderSortableHeader(
                      t(language, "average"),
                      "avg",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>
                        {(
                          ((s.first9DartsPoints || 0) /
                            (s.first9DartsCount || 1)) *
                            3 || 0
                        ).toFixed(1)}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          { color: theme.colors.success, fontWeight: "bold" },
                        ]}
                      >
                        {(
                          ((s.totalPoints || 0) / (s.totalDarts || 1)) * 3 || 0
                        ).toFixed(1)}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "checkouts" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "gameDarts"),
                      "checkoutDarts",
                    )}
                    {renderSortableHeader(
                      t(language, "hitPercent"),
                      "checkoutPct",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>{s.checkoutDarts}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {(s.checkoutDarts || 0) > 0
                          ? (
                              ((s.checkoutHits || 0) / (s.checkoutDarts || 1)) *
                              100
                            ).toFixed(1) + "%"
                          : "0%"}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "scoring" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("60+", "s60")}
                    {renderSortableHeader("100+", "s100")}
                    {renderSortableHeader("140+", "s140")}
                    {renderSortableHeader("180", "s180")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>{s.s60}</Text>
                      <Text style={styles.cell}>{s.s100}</Text>
                      <Text style={styles.cell}>{s.s140}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { color: theme.colors.success, fontWeight: "bold" },
                        ]}
                      >
                        {s.s180}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "hit_chart" && (
                <View style={{ paddingTop: 10 }}>
                  {sortedStats.map((s: ParsedMatchStat) => {
                    const defaultTargets = [
                      20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
                      4, 3, 2, 1, 25, 0,
                    ];
                    const hasHits = defaultTargets.some(
                      (t) =>
                        s.hits &&
                        (s.hits[t]?.S > 0 ||
                          s.hits[t]?.D > 0 ||
                          s.hits[t]?.T > 0),
                    );
                    if (!hasHits) return null;
                    const isCollapsed =
                      collapsedPlayers[`${item.id}_${s.name}`];
                    let targets = [...defaultTargets];
                    if (sortConfig && !isCollapsed) {
                      targets.sort((a, b) => {
                        const colKey = sortConfig.col as "S" | "D" | "T";
                        const hitsA = s.hits?.[a]?.[colKey] || 0;
                        const hitsB = s.hits?.[b]?.[colKey] || 0;
                        if (hitsA === hitsB)
                          return (
                            defaultTargets.indexOf(a) -
                            defaultTargets.indexOf(b)
                          );
                        return sortConfig.asc
                          ? (hitsA as number) - (hitsB as number)
                          : (hitsB as number) - (hitsA as number);
                      });
                    }
                    return (
                      <Animated.View
                        key={s.name}
                        style={{ marginBottom: 20, overflow: "hidden" }}
                        layout={LinearTransition.duration(250)}
                      >
                        <Pressable
                          style={styles.hitPlayerHeader}
                          onPress={() => onTogglePlayer(`${item.id}_${s.name}`)}
                          accessibilityRole="button"
                          accessibilityLabel={s.name}
                          accessibilityState={{ expanded: !isCollapsed }}
                        >
                          <Text style={styles.hitPlayerName}>{s.name}</Text>
                          <Ionicons
                            name={isCollapsed ? "chevron-down" : "chevron-up"}
                            size={18}
                            color={theme.colors.primary}
                          />
                        </Pressable>
                        {!isCollapsed && (
                          <Animated.View entering={FadeIn.duration(200)}>
                            <View style={styles.rowHeader}>
                              <View style={styles.colNameWrap}>
                                <Text style={styles.colText}>
                                  {t(language, "target")}
                                </Text>
                              </View>
                              {renderSortableHeader(
                                t(language, "single"),
                                "S",
                              )}
                              {renderSortableHeader(
                                t(language, "double"),
                                "D",
                              )}
                              {renderSortableHeader(tripleTerm, "T")}
                            </View>
                            {targets.map((target: number) => {
                              const h = s.hits?.[target];
                              if (!h || (h.S === 0 && h.D === 0 && h.T === 0))
                                return null;
                              return (
                                <View key={target} style={styles.hitRow}>
                                  <Text style={styles.hitCellTarget}>
                                    {target === 25
                                      ? bullTerm
                                      : target === 0
                                        ? missTerm
                                        : target}
                                  </Text>
                                  <Text style={styles.hitCell}>
                                    {h.S > 0 ? h.S : "-"}
                                  </Text>
                                  <Text style={styles.hitCell}>
                                    {target !== 0 && h.D > 0 ? h.D : "-"}
                                  </Text>
                                  <Text style={styles.hitCell}>
                                    {target !== 0 && target !== 25 && h.T > 0
                                      ? h.T
                                      : "-"}
                                  </Text>
                                </View>
                              );
                            })}
                          </Animated.View>
                        )}
                      </Animated.View>
                    );
                  })}
                </View>
              )}
              {item.id === "heatmap" && (
                <View style={{ paddingTop: 10 }}>
                  {sortedStats.map((s: ParsedMatchStat) => {
                    if (!s.coords || s.coords.length === 0) return null;
                    const isCollapsed =
                      collapsedPlayers &&
                      collapsedPlayers[`${item.id}_${s.name}`];
                    return (
                      <Animated.View
                        key={s.name}
                        style={{ marginBottom: 20, overflow: "hidden" }}
                        layout={LinearTransition.duration(250)}
                      >
                        <Pressable
                          style={styles.hitPlayerHeader}
                          onPress={() => onTogglePlayer(`${item.id}_${s.name}`)}
                          accessibilityRole="button"
                          accessibilityLabel={s.name}
                          accessibilityState={{ expanded: !isCollapsed }}
                        >
                          <Text style={styles.hitPlayerName}>{s.name}</Text>
                          <Ionicons
                            name={isCollapsed ? "chevron-down" : "chevron-up"}
                            size={18}
                            color={theme.colors.primary}
                          />
                        </Pressable>
                        {!isCollapsed && (
                          <Animated.View entering={FadeIn.duration(200)}>
                            <HeatmapBoard
                              coords={s.coords}
                              theme={theme}
                              size={Dimensions.get("window").width - 100}
                            />
                          </Animated.View>
                        )}
                      </Animated.View>
                    );
                  })}
                </View>
              )}
              {item.id === "cricket_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "points"),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "darts"),
                      "darts",
                    )}
                    {renderSortableHeader(
                      t(language, "closed"),
                      "closed",
                    )}
                    {renderSortableHeader("MPR", "mpr")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { color: theme.colors.primary, fontWeight: "bold" },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.darts}</Text>
                      <Text style={styles.cell}>{s.closed} / 7</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.mpr}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "aroundtheclock_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "darts"),
                      "darts",
                    )}
                    {renderSortableHeader(
                      t(language, "accuracy"),
                      "avg",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>{s.darts}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { color: theme.colors.success, fontWeight: "bold" },
                        ]}
                      >
                        {s.avg}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "bob27_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "score"),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "status"),
                      "status",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={[styles.cell, { fontWeight: "bold" }]}>
                        {s.score}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          {
                            color: s.isBust
                              ? theme.colors.danger
                              : theme.colors.success,
                            fontSize: 11,
                            fontWeight: "bold",
                          },
                        ]}
                      >
                        {s.status}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "hundreddarts_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "score"),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "average"),
                      "avg",
                    )}
                    {renderSortableHeader("140+", "s140")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={[styles.cell, { fontWeight: "bold" }]}>
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.avg}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.s140}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "catch40_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("PTS", "score")}
                    {renderSortableHeader(
                      t(language, "avgShort"),
                      "targetAvg",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.targetAvg}</Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "catch40_details" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("3P", "c2")}
                    {renderSortableHeader("2P", "c3")}
                    {renderSortableHeader("1P", "c4_6")}
                    {renderSortableHeader("0P", "fails")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.c2}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.c3}
                      </Text>
                      <Text style={styles.cell}>{s.c4_6}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.danger }]}
                      >
                        {s.fails}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "jdc_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("PTS", "score")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "jdc_details" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("10-15", "phase1")}
                    {renderSortableHeader("DOUBLES", "phase2")}
                    {renderSortableHeader("15-20", "phase3")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>{s.phase1}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.phase2}
                      </Text>
                      <Text style={styles.cell}>{s.phase3}</Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "bermuda_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("PTS", "score")}
                    {renderSortableHeader("ERRORS", "halves")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          {
                            color:
                              s.halves && s.halves > 0
                                ? theme.colors.danger
                                : theme.colors.success,
                          },
                        ]}
                      >
                        {s.halves}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "halveit_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("PTS", "score")}
                    {renderSortableHeader("ERRORS", "halves")}
                    {renderSortableHeader(
                      t(language, "accuracyShort"),
                      "accuracy",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          {
                            color:
                              s.halves && s.halves > 0
                                ? theme.colors.danger
                                : theme.colors.success,
                          },
                        ]}
                      >
                        {s.halves}
                      </Text>
                      <Text style={[styles.cell, { fontWeight: "bold" }]}>
                        {s.accuracy}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "halveit_details" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("S", "sHits")}
                    {renderSortableHeader("D", "dHits")}
                    {renderSortableHeader("T", "tHits")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.sHits}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.dHits}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.tHits}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "shanghai_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("PTS", "score")}
                    {renderSortableHeader(
                      t(language, "target"),
                      "reached",
                    )}
                    {renderSortableHeader(
                      t(language, "accuracyShort"),
                      "accuracy",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>
                        {s.name} {s.shanghais && s.shanghais > 0 ? "🏆" : ""}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.reached}</Text>
                      <Text style={[styles.cell, { fontWeight: "bold" }]}>
                        {s.accuracy}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "shanghai_details" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("S", "sHits")}
                    {renderSortableHeader("D", "dHits")}
                    {renderSortableHeader("T", "tHits")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.sHits}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.dHits}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.tHits}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "dragon_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "darts"),
                      "darts",
                    )}
                    {renderSortableHeader(
                      t(language, "accuracyShort"),
                      "accuracy",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>{s.darts}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.success },
                        ]}
                      >
                        {s.accuracy}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "baseball_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "runs")?.toUpperCase(),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "scoreless")?.toUpperCase(),
                      "scorelessInnings",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          {
                            color:
                              s.scorelessInnings && s.scorelessInnings > 0
                                ? theme.colors.danger
                                : theme.colors.success,
                          },
                        ]}
                      >
                        {s.scorelessInnings}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "baseball_details" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader("S", "sHits")}
                    {renderSortableHeader("D", "dHits")}
                    {renderSortableHeader("T", "tHits")}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.sHits}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.dHits}
                      </Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.tHits}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "121_checkout_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "highestReached"),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "darts"),
                      "darts",
                    )}
                    {renderSortableHeader(
                      t(language, "hitPercent"),
                      "accuracy",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.darts}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.success },
                        ]}
                      >
                        {s.accuracy}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "killer_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "lives"),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "darts"),
                      "darts",
                    )}
                    {renderSortableHeader(
                      t(language, "status"),
                      "status",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "bold", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.darts}</Text>
                      <Text
                        style={[
                          styles.cell,
                          {
                            color:
                              s.status === "ELIMINATED"
                                ? theme.colors.danger
                                : theme.colors.success,
                            fontSize: 11,
                            fontWeight: "bold",
                          },
                        ]}
                      >
                        {s.status}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "score_clash_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    {renderSortableHeader(
                      t(language, "player"),
                      "name",
                      true,
                    )}
                    {renderSortableHeader(
                      t(language, "points"),
                      "score",
                    )}
                    {renderSortableHeader(
                      t(language, "score"),
                      "totalPoints",
                    )}
                    {renderSortableHeader(
                      t(language, "average"),
                      "avg",
                    )}
                  </View>
                  {sortedStats.map((s: ParsedMatchStat) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text
                        style={[
                          styles.cell,
                          { fontWeight: "900", color: theme.colors.primary },
                        ]}
                      >
                        {s.score}
                      </Text>
                      <Text style={styles.cell}>{s.totalPoints}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.avg}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    );
  },
);

export default function HistoryScreen() {
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const navigation = useNavigation();
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [filterMode, setFilterMode] = useState<
    | "All"
    | "X01"
    | "Cricket"
    | "Around the Clock"
    | "Bob's 27"
    | "100 Darts"
    | "Catch 40"
    | "JDC Challenge"
    | "Bermuda Triangle"
    | "Shanghai"
    | "Halve-It"
    | "Baseball"
    | "Chase the Dragon"
    | "121_checkout"
    | "Killer"
    | "Score Clash"
  >("All");
  const [scrollLayout, setScrollLayout] = useState({
    width: 0,
    contentWidth: 0,
    offset: 0,
  });
  const [selectedMatch, setSelectedMatch] = useState<MatchHistory | null>(null);

  const lastSelectedMatch = useRef<MatchHistory | null>(null);
  if (selectedMatch) lastSelectedMatch.current = selectedMatch;
  const matchToDisplay = selectedMatch || lastSelectedMatch.current;

  const { showAlert, alertProps } = useAlert(language);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    performance: true,
    checkouts: true,
    scoring: true,
    hit_chart: true,
    cricket_summary: true,
    aroundtheclock_summary: true,
    bob27_summary: true,
    hundreddarts_summary: true,
    catch40_summary: true,
    catch40_details: true,
    jdc_summary: true,
    jdc_details: true,
    bermuda_summary: true,
    shanghai_summary: true,
    shanghai_details: true,
    halveit_summary: true,
    halveit_details: true,
    baseball_summary: true,
    baseball_details: true,
    dragon_summary: true,
    "121_checkout_summary": true,
    killer_summary: true,
    score_clash_summary: true,
    heatmap: true,
  });
  const [collapsedPlayers, setCollapsedPlayers] = useState<
    Record<string, boolean>
  >({});

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitle: t(language, "history"),
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => {
              showAlert(
                t(language, "delete"),
                t(language, "deleteHistoryConfirm"),
                [
                  { text: t(language, "cancel"), style: "cancel" },
                  {
                    text:
                      t(language, "deletePermanently"),
                    style: "destructive",
                    onPress: async () => {
                      await AsyncStorage.multiRemove([
                        "@dart_match_history",
                        "@dart_overall_agg",
                      ]);
                      setHistory([]);
                    },
                  },
                ],
              );
            }}
            style={{ marginRight: 16, padding: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t(language, "deleteAllHistory")}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={theme.colors.danger}
            />
          </Pressable>
        ),
      });
    }, [navigation, language, theme, showAlert]),
  );

  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        try {
          const savedHistory = await AsyncStorage.getItem(HISTORY_KEY);
          if (savedHistory !== null) setHistory(JSON.parse(savedHistory));
          setVisibleCount(10);
        } catch (e) {
          console.error("Error loading", e);
        }
      };
      loadHistory();
    }, []),
  );

  const deleteMatch = (id: string) => {
    showAlert(
      t(language, "deleteMatch"),
      t(language, "deleteMatchConfirm"),
      [
        { text: t(language, "cancel"), style: "cancel" },
        {
          text: t(language, "delete"),
          style: "destructive",
          onPress: async () => {
            const updatedHistory = history.filter((match) => match.id !== id);
            setHistory(updatedHistory);
            await AsyncStorage.setItem(
              HISTORY_KEY,
              JSON.stringify(updatedHistory),
            );
          },
        },
      ],
    );
  };

  const handleLoadMore = () => {
    if (visibleCount < filteredHistory.length) {
      setVisibleCount((prev) => prev + 10);
    }
  };

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const togglePlayerCollapse = useCallback((key: string) => {
    setCollapsedPlayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const filteredHistory = useMemo(() => {
    if (filterMode === "All") return history;
    return history.filter((h) => h.mode === filterMode);
  }, [history, filterMode]);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(0, visibleCount);
  }, [filteredHistory, visibleCount]);

  const canScrollLeft = scrollLayout.offset > 0;
  const canScrollRight =
    scrollLayout.width > 0 &&
    scrollLayout.contentWidth > 0 &&
    scrollLayout.offset + scrollLayout.width < scrollLayout.contentWidth - 5;

  const singleMatchStats = useMemo(
    () => getSingleMatchStats(matchToDisplay, language),
    [matchToDisplay, language],
  );

  const renderGameCard = ({ item }: { item: MatchHistory }) => {
    const isCricket = item.mode === "Cricket";
    const isSpecialMode = item.mode !== "X01";

    let displayDate = item.date;
    const parsedDate = parseDateString(item.date || "");
    if (parsedDate.getTime() !== 0) {
      displayDate = dayjs(parsedDate)
        .locale(language === "pl" ? "pl" : "en")
        .format("DD MMM YYYY, HH:mm");
    }

    const isUnfinished = item.isUnfinished;

    const sortedPlayers = [...item.players].sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;

      if (isSpecialMode) {
        if (ASCENDING_SCORE_MODES.includes(item.mode))
          return (a.darts || 0) - (b.darts || 0);
        return (b.score || 0) - (a.score || 0);
      }
      return (
        (b.sets || 0) - (a.sets || 0) ||
        (b.legs || 0) - (a.legs || 0) ||
        (a.score || 0) - (b.score || 0)
      );
    });

    const modeConfig = MODE_CONFIG[item.mode] || {
      label: item.mode.toUpperCase(),
      route: "/gamemodes/dart",
    };
    let badgeBg =
      modeConfig.bg ||
      (isCricket ? theme.colors.dangerLight : theme.colors.primaryLight);
    let badgeText =
      modeConfig.text ||
      (isCricket ? theme.colors.danger : theme.colors.primary);
    let badgeLabel = modeConfig.label;

    let settingsStr = "";
    if (item.mode === "X01")
      settingsStr = `${item.settings?.startPoints || 501} • ${String(item.settings?.inRule || "straight").toUpperCase()} IN • ${String(item.settings?.outRule || "double").toUpperCase()} OUT`;
    else if (item.mode === "Cricket")
      settingsStr = `CRICKET • ${(item.settings?.cricketMode === "no-score" ? "No Score" : "Standard").toUpperCase()}`;
    else settingsStr = item.mode.toUpperCase();

    return (
      <Pressable
        onPress={() => setSelectedMatch(item)}
        style={[styles.card, isUnfinished && styles.unfinishedCard]}
        accessibilityRole="button"
        accessibilityLabel={`${badgeLabel} - ${displayDate}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 6,
                flexShrink: 1,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={theme.colors.textMuted}
                style={{ marginTop: 1 }}
              />
              <Text style={styles.dateText} numberOfLines={2}>
                {displayDate}
              </Text>
            </View>
            {item.duration && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.dateText}>{item.duration}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardHeaderActions}>
            <View style={[styles.modeBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.modeBadgeText, { color: badgeText }]}>
                {badgeLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => deleteMatch(item.id)}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel={t(language, "deleteMatch")}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={theme.colors.danger}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.settingsRow}>
          <Text style={styles.settingsText}>{settingsStr}</Text>
          {(!isSpecialMode || isCricket) && (
            <Text style={styles.settingsTextBold}>
              {item.settings?.legs || 1} {t(language, "leg")} /{" "}
              {item.settings?.sets || 1} {t(language, "set")}
            </Text>
          )}
        </View>

        <View style={styles.playersList}>
          {sortedPlayers.map((p, index) => {
            const isWinner = index === 0 && !isUnfinished;
            return (
              <View key={p.name} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <Text style={[styles.rank, isWinner && styles.rankWinner]}>
                    {index + 1}.
                  </Text>
                  <Text
                    style={[
                      styles.playerName,
                      isWinner && styles.playerNameWinner,
                    ]}
                  >
                    {p.name}
                  </Text>
                  {isWinner && (
                    <Ionicons
                      name="trophy"
                      size={16}
                      color={theme.colors.warning}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                  {isUnfinished && index === 0 && (
                    <Ionicons
                      name="time"
                      size={16}
                      color={theme.colors.textMuted}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>
                <View style={styles.playerScoreInfo}>
                  {isSpecialMode ? (
                    <>
                      {isCricket && (
                        <Text style={styles.playerLegsSets}>
                          L:{p.legs || 0} S:{p.sets || 0}
                        </Text>
                      )}
                      <Text style={styles.playerScore}>
                        {item.mode === "Around the Clock" ||
                        (item.mode === "Cricket" &&
                          item.settings?.cricketMode === "no-score")
                          ? `${p.darts || 0} ${t(language, "dartsShort")}`
                          : `${p.score || 0} ${t(language, "ptsShort")}`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.playerLegsSets}>
                        L:{p.legs || 0} S:{p.sets || 0}
                      </Text>
                      <Text style={styles.playerScore}>
                        {p.score === 0
                          ? t(language, "checkoutUpper")
                          : `${p.score} ${t(language, "ptsShort")}`}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Pressable>
    );
  };

  const activeSections: ActiveSection[] = useMemo(
    () => getActiveSections(matchToDisplay, singleMatchStats, language),
    [matchToDisplay, singleMatchStats, language],
  );

  return (
    <View style={styles.container}>
      <View style={{ position: "relative" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          onScroll={(e) => {
            const offset = e.nativeEvent.contentOffset.x;
            const width = e.nativeEvent.layoutMeasurement.width;
            setScrollLayout((prev) => ({
              ...prev,
              offset,
              width,
            }));
          }}
          onContentSizeChange={(w) =>
            setScrollLayout((prev) => ({ ...prev, contentWidth: w }))
          }
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            setScrollLayout((prev) => ({ ...prev, width }));
          }}
          scrollEventThrottle={16}
        >
          <AnimatedSegmentedControl
            theme={theme}
            activeOption={filterMode}
            onSelect={(val) =>
              setFilterMode(
                val as
                  | "All"
                  | "X01"
                  | "Cricket"
                  | "Around the Clock"
                  | "Bob's 27"
                  | "100 Darts"
                  | "Catch 40"
                  | "JDC Challenge"
                  | "Bermuda Triangle"
                  | "Shanghai"
                  | "Halve-It"
                  | "Baseball"
                  | "Chase the Dragon",
              )
            }
            style={[styles.filterContainer, { width: 1240 }]}
            options={[
              { id: "All", label: t(language, "all") },
              { id: "X01", label: "X01" },
              { id: "Cricket", label: t(language, "cricket") },
              { id: "Bob's 27", label: t(language, "bobsShort") },
              { id: "100 Darts", label: "100" },
              { id: "Catch 40", label: "C40" },
              { id: "JDC Challenge", label: "JDC" },
              { id: "Bermuda Triangle", label: "Bermuda" },
              { id: "Shanghai", label: "Shanghai" },
              { id: "Halve-It", label: "Halve-It" },
              { id: "Baseball", label: "Baseball" },
              { id: "Chase the Dragon", label: "Dragon" },
              { id: "121_checkout", label: "121" },
              { id: "Killer", label: t(language, "killer") },
              {
                id: "Score Clash",
                label: t(language, "scoreClash"),
              },
              {
                id: "Around the Clock",
                label: t(language, "clockShort"),
              },
            ]}
          />
        </ScrollView>

        {canScrollLeft && (
          <View style={styles.scrollArrowLeft} pointerEvents="none">
            <View style={styles.arrowIconBackground}>
              <Ionicons
                name="chevron-back"
                size={16}
                color={theme.colors.textMain}
              />
            </View>
          </View>
        )}
        {canScrollRight && (
          <View style={styles.scrollArrowRight} pointerEvents="none">
            <View style={styles.arrowIconBackground}>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textMain}
              />
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={paginatedHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons
              name="time-outline"
              size={48}
              color={theme.colors.textLight}
            />
            <Text style={styles.emptyStateText}>
              {t(language, "noGamesPlayed")}
            </Text>
          </View>
        )}
        renderItem={renderGameCard}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <Modal
        visible={!!selectedMatch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMatch(null)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.modalHeaderTitle}>
                {t(language, "matchStatsTitle")}
              </Text>
              <Text style={styles.modalHeaderSubtitle}>
                {matchToDisplay?.date}{" "}
                {matchToDisplay?.duration && `• ⏱ ${matchToDisplay.duration}`}
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              {matchToDisplay?.isUnfinished && (
                <AnimatedPressable
                  onPress={() => {
                    setSelectedMatch(null);

                    const targetPath =
                      MODE_CONFIG[matchToDisplay.mode]?.route ||
                      "/gamemodes/dart";

                    router.push({
                      pathname: targetPath as any,
                      params: { resumeData: JSON.stringify(matchToDisplay) },
                    });
                  }}
                  style={styles.resumeBtnModal}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, "resume")}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.resumeBtnText}>
                    {t(language, "resume")}
                  </Text>
                </AnimatedPressable>
              )}
              <AnimatedPressable
                onPress={() => setSelectedMatch(null)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel={t(language, "close")}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMain}
                />
              </AnimatedPressable>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            {activeSections.map((sec) => (
              <MatchStatCard
                key={sec.id}
                item={sec}
                stats={singleMatchStats}
                isOpen={openSections[sec.id]}
                onToggle={() => toggleSection(sec.id)}
                collapsedPlayers={collapsedPlayers}
                onTogglePlayer={togglePlayerCollapse}
                tripleTerm={tripleTerm}
                missTerm={missTerm}
                bullTerm={bullTerm}
                language={language}
                theme={theme}
                mode={matchToDisplay?.mode}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CustomAlert {...alertProps} />
    </View>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) => {
  const shared = getSharedScreenStyles(theme);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    filterContainer: {
      backgroundColor: theme.colors.cardBorder,
      borderRadius: 12,
      padding: 4,
    },
    scrollArrowLeft: {
      position: "absolute",
      left: 4,
      top: 12,
      bottom: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollArrowRight: {
      position: "absolute",
      right: 4,
      top: 12,
      bottom: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    arrowIconBackground: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    card: {
      ...shared.card,
      borderWidth: 2,
      borderColor: theme.colors.card,
      shadowOpacity: 0,
    },
    unfinishedCard: {
      borderColor: theme.colors.warning,
      borderWidth: 2,
    },
    cardHeader: {
      ...shared.cardHeader,
      alignItems: "flex-start",
    },
    dateRow: {
      flex: 1,
      marginRight: 10,
    },
    dateText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      flexShrink: 1,
    },
    cardHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    modeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    modeBadgeText: {
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    resumeBtnModal: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.warning,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    resumeBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.warning,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 6,
    },
    resumeBtnText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "900",
      marginLeft: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    deleteBtn: {
      padding: 4,
      backgroundColor: theme.colors.dangerLight,
      borderRadius: 8,
    },
    settingsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: theme.colors.background,
      padding: 10,
      borderRadius: 10,
      marginBottom: 16,
    },
    settingsText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    settingsTextBold: {
      color: theme.colors.textMain,
      fontSize: 12,
      fontWeight: "800",
    },
    playersList: { gap: 8 },
    playerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    playerInfo: { flexDirection: "row", alignItems: "center" },
    rank: {
      width: 20,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textLight,
    },
    rankWinner: { color: theme.colors.success, fontWeight: "900" },
    playerName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    playerNameWinner: { color: theme.colors.textMain, fontWeight: "800" },
    playerScoreInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
    playerLegsSets: {
      fontSize: 12,
      color: theme.colors.textLight,
      fontWeight: "700",
    },
    playerScore: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.textMain,
      minWidth: 60,
      textAlign: "right",
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 80,
      gap: 12,
    },
    emptyStateText: {
      color: theme.colors.textLight,
      fontSize: 16,
      fontWeight: "500",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.card,
    },
    modalHeaderTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    modalHeaderSubtitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    modalCloseBtn: {
      padding: 8,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
    },
    statCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.colors.cardBorder,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 18,
      alignItems: "center",
    },
    sectionTitle: {
      fontWeight: "900",
      color: theme.colors.textMain,
      fontSize: 13,
      textTransform: "uppercase",
    },
    table: {
      paddingHorizontal: 18,
      paddingBottom: 18,
      borderTopWidth: 2,
      borderTopColor: theme.colors.background,
    },
    rowHeader: { flexDirection: "row", paddingTop: 12, marginBottom: 8 },
    colNameWrap: { flex: 1.5, flexDirection: "row", alignItems: "center" },
    colWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    colText: { fontSize: 11, fontWeight: "700", color: theme.colors.textLight },
    row: {
      flexDirection: "row",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    cellName: {
      flex: 1.5,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textMain,
    },
    cell: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    hitPlayerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      marginBottom: 6,
    },
    hitPlayerName: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.primary,
      textTransform: "uppercase",
    },
    hitRow: {
      flexDirection: "row",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    hitCellTarget: {
      flex: 1.5,
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    hitCell: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
  });
};
