import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomAlert, { AlertButton } from "../../components/modals/CustomAlert";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { HeatmapBoard } from "../../components/statistics/StatisticsComponents";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { t } from "../../lib/i18n";

const HISTORY_KEY = "@dart_match_history";

export type MatchHistory = {
  id: string;
  date: string;
  duration?: string;
  mode: string;
  settings?: any;
  players: any[];
  isUnfinished?: boolean;
  gameState?: any;
};

const MODE_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    X01: { bg: "#e6f4ea", text: "#10b981", label: "X01" },
    Cricket: { bg: "#f5f3ff", text: "#8b5cf6", label: "CRICKET" },
    "Bob's 27": { bg: "#fffbeb", text: "#f59e0b", label: "BOB'S" },
    "100 Darts": { bg: "#f0f9ff", text: "#0ea5e9", label: "100" },
    "Around the Clock": { bg: "#fdf2f8", text: "#ec4899", label: "CLOCK" },
  };

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
  }: any) => {
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
        let valA: any = 0;
        let valB: any = 0;
        switch (sortConfig.col) {
          case "name":
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case "avg":
            valA =
              a.totalDarts > 0
                ? (a.totalPoints / a.totalDarts) * 3
                : parseFloat(a.avg || 0);
            valB =
              b.totalDarts > 0
                ? (b.totalPoints / b.totalDarts) * 3
                : parseFloat(b.avg || 0);
            break;
          case "first9":
            valA =
              a.first9DartsCount > 0
                ? (a.first9DartsPoints / a.first9DartsCount) * 3
                : 0;
            valB =
              b.first9DartsCount > 0
                ? (b.first9DartsPoints / b.first9DartsCount) * 3
                : 0;
            break;
          case "checkoutDarts":
            valA = a.checkoutDarts;
            valB = b.checkoutDarts;
            break;
          case "checkoutPct":
            valA = a.checkoutDarts > 0 ? a.checkoutHits / a.checkoutDarts : 0;
            valB = b.checkoutDarts > 0 ? b.checkoutHits / b.checkoutDarts : 0;
            break;
          case "s60":
            valA = a.s60;
            valB = b.s60;
            break;
          case "s100":
            valA = a.s100;
            valB = b.s100;
            break;
          case "s140":
            valA = a.s140;
            valB = b.s140;
            break;
          case "s180":
            valA = a.s180;
            valB = b.s180;
            break;
          case "score":
            valA = a.score;
            valB = b.score;
            break;
          case "darts":
            valA = a.darts;
            valB = b.darts;
            break;
          case "closed":
            valA = a.closed;
            valB = b.closed;
            break;
          case "mpr":
            valA = parseFloat(a.mpr);
            valB = parseFloat(b.mpr);
            break;
          case "status":
            valA = a.status;
            valB = b.status;
            break;
        }

        if (valA === valB) return 0;
        return sortConfig.asc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
    }, [stats, sortConfig, item.id]);

    const SortableHeader = ({
      label,
      colKey,
      isName = false,
    }: {
      label: string;
      colKey: string;
      isName?: boolean;
    }) => {
      const isActive = sortConfig?.col === colKey;
      return (
        <Pressable
          style={isName ? styles.colNameWrap : styles.colWrap}
          onPress={() => handleSort(colKey)}
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
      <View style={{ paddingBottom: 16 }}>
        <View style={styles.statCard}>
          <Pressable style={styles.sectionHeader} onPress={onToggle}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {isOpen && (
            <View style={styles.table}>
              {item.id === "performance" && (
                <>
                  <View style={styles.rowHeader}>
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader label="First 9" colKey="first9" />
                    <SortableHeader label="Average" colKey="avg" />
                  </View>
                  {sortedStats.map((s: any) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>
                        {(
                          (s.first9DartsPoints / s.first9DartsCount) * 3 || 0
                        ).toFixed(1)}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          { color: theme.colors.success, fontWeight: "bold" },
                        ]}
                      >
                        {((s.totalPoints / s.totalDarts) * 3 || 0).toFixed(1)}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "checkouts" && (
                <>
                  <View style={styles.rowHeader}>
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader
                      label={t(language, "gameDarts") || "Game darts"}
                      colKey="checkoutDarts"
                    />
                    <SortableHeader
                      label={t(language, "hitPercent") || "Hit %"}
                      colKey="checkoutPct"
                    />
                  </View>
                  {sortedStats.map((s: any) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={styles.cell}>{s.checkoutDarts}</Text>
                      <Text
                        style={[styles.cell, { color: theme.colors.success }]}
                      >
                        {s.checkoutDarts > 0
                          ? ((s.checkoutHits / s.checkoutDarts) * 100).toFixed(
                              1,
                            ) + "%"
                          : "0%"}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {item.id === "scoring" && (
                <>
                  <View style={styles.rowHeader}>
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader label="60+" colKey="s60" />
                    <SortableHeader label="100+" colKey="s100" />
                    <SortableHeader label="140+" colKey="s140" />
                    <SortableHeader label="180" colKey="s180" />
                  </View>
                  {sortedStats.map((s: any) => (
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
                  {sortedStats.map((s: any) => {
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
                    const isCollapsed = collapsedPlayers[s.name];
                    let targets = [...defaultTargets];
                    if (sortConfig && !isCollapsed) {
                      targets.sort((a, b) => {
                        const hitsA = s.hits[a][sortConfig.col];
                        const hitsB = s.hits[b][sortConfig.col];
                        if (hitsA === hitsB)
                          return (
                            defaultTargets.indexOf(a) -
                            defaultTargets.indexOf(b)
                          );
                        return sortConfig.asc ? hitsA - hitsB : hitsB - hitsA;
                      });
                    }
                    return (
                      <View key={s.name} style={{ marginBottom: 20 }}>
                        <Pressable
                          style={styles.hitPlayerHeader}
                          onPress={() => onTogglePlayer(s.name)}
                        >
                          <Text style={styles.hitPlayerName}>{s.name}</Text>
                          <Ionicons
                            name={isCollapsed ? "chevron-down" : "chevron-up"}
                            size={18}
                            color={theme.colors.primary}
                          />
                        </Pressable>
                        {!isCollapsed && (
                          <>
                            <View style={styles.rowHeader}>
                              <View style={styles.colNameWrap}>
                                <Text style={styles.colText}>Cel</Text>
                              </View>
                              <SortableHeader label="Single" colKey="S" />
                              <SortableHeader label="Double" colKey="D" />
                              <SortableHeader label={tripleTerm} colKey="T" />
                            </View>
                            {targets.map((target) => {
                              const h = s.hits[target];
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
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
              {item.id === "heatmap" && (
                <View style={{ paddingTop: 10 }}>
                  {sortedStats.map((s: any) => {
                    if (!s.coords || s.coords.length === 0) return null;
                    const isCollapsed =
                      collapsedPlayers && collapsedPlayers[s.name];
                    return (
                      <View key={s.name} style={{ marginBottom: 20 }}>
                        <Pressable
                          style={styles.hitPlayerHeader}
                          onPress={() => onTogglePlayer(s.name)}
                        >
                          <Text style={styles.hitPlayerName}>{s.name}</Text>
                          <Ionicons
                            name={isCollapsed ? "chevron-down" : "chevron-up"}
                            size={18}
                            color={theme.colors.primary}
                          />
                        </Pressable>
                        {!isCollapsed && (
                          <HeatmapBoard
                            coords={s.coords}
                            theme={theme}
                            size={Dimensions.get("window").width - 100}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
              {item.id === "cricket_summary" && (
                <>
                  <View style={styles.rowHeader}>
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader
                      label={t(language, "points") || "Points"}
                      colKey="score"
                    />
                    <SortableHeader
                      label={t(language, "darts") || "Darts"}
                      colKey="darts"
                    />
                    <SortableHeader
                      label={t(language, "closed") || "Closed"}
                      colKey="closed"
                    />
                    <SortableHeader label="MPR" colKey="mpr" />
                  </View>
                  {sortedStats.map((s: any) => (
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
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader
                      label={t(language, "darts") || "Darts"}
                      colKey="darts"
                    />
                    <SortableHeader label="Accuracy" colKey="avg" />
                  </View>
                  {sortedStats.map((s: any) => (
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
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader label="Score" colKey="score" />
                    <SortableHeader label="Status" colKey="status" />
                  </View>
                  {sortedStats.map((s: any) => (
                    <View key={s.name} style={styles.row}>
                      <Text style={styles.cellName}>{s.name}</Text>
                      <Text style={[styles.cell, { fontWeight: "bold" }]}>
                        {s.score}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          {
                            color:
                              s.status === "BUST"
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
                    <SortableHeader
                      label={t(language, "player") || "Player"}
                      colKey="name"
                      isName
                    />
                    <SortableHeader label="Score" colKey="score" />
                    <SortableHeader label="Average" colKey="avg" />
                    <SortableHeader label="140+" colKey="s140" />
                  </View>
                  {sortedStats.map((s: any) => (
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
            </View>
          )}
        </View>
      </View>
    );
  },
);

export default function History() {
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const navigation = useNavigation();
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [filterMode, setFilterMode] = useState<
    "All" | "X01" | "Cricket" | "Around the Clock" | "Bob's 27" | "100 Darts"
  >("All");
  const [scrollLayout, setScrollLayout] = useState({
    width: 0,
    contentWidth: 0,
    offset: 0,
  });
  const [selectedMatch, setSelectedMatch] = useState<MatchHistory | null>(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    performance: true,
    checkouts: true,
    scoring: true,
    hit_chart: true,
    cricket_summary: true,
    aroundtheclock_summary: true,
    bob27_summary: true,
    hundreddarts_summary: true,
    heatmap: true,
  });
  const [collapsedPlayers, setCollapsedPlayers] = useState<
    Record<string, boolean>
  >({});

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitle: t(language, "history") || "Historia",
        headerShadowVisible: false,
      });
    }, [navigation, language]),
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
    setAlertConfig({
      title: t(language, "deleteMatch") || "Delete match",
      message:
        t(language, "deleteMatchConfirm") ||
        "Are you sure you want to remove this match from the history?",
      buttons: [
        { text: t(language, "cancel") || "Cancel", style: "cancel" },
        {
          text: t(language, "delete") || "Delete",
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
    });
    setAlertVisible(true);
  };

  const handleLoadMore = () => {
    if (visibleCount < filteredHistory.length) {
      setVisibleCount((prev) => prev + 10);
    }
  };

  const toggleSection = useCallback(
    (key: string) =>
      setOpenSections((prev) => ({ ...prev, [key]: !prev[key] })),
    [],
  );
  const togglePlayerCollapse = useCallback(
    (playerName: string) =>
      setCollapsedPlayers((prev) => ({
        ...prev,
        [playerName]: !prev[playerName],
      })),
    [],
  );

  const filteredHistory = useMemo(() => {
    if (filterMode === "All") return history;
    return history.filter((h) => h.mode === filterMode);
  }, [history, filterMode]);

  const canScrollLeft = scrollLayout.offset > 0;
  const canScrollRight =
    scrollLayout.width > 0 &&
    scrollLayout.contentWidth > 0 &&
    scrollLayout.offset + scrollLayout.width < scrollLayout.contentWidth - 5;

  const singleMatchStats = useMemo(() => {
    if (!selectedMatch) return [];

    if (selectedMatch.mode === "Cricket") {
      return selectedMatch.players.map((p) => {
        const closedCount = Object.values(p.marks || {}).filter(
          (m: any) => m >= 3,
        ).length;
        const totalMarks = Object.values(p.marks || {}).reduce(
          (a: any, b: any) => a + b,
          0,
        ) as number;
        return {
          name: p.name,
          score: p.score,
          darts: p.darts || 0,
          closed: closedCount,
          mpr: p.darts > 0 ? ((totalMarks / p.darts) * 3).toFixed(2) : "0.00",
        };
      });
    }

    if (selectedMatch.mode === "Around the Clock") {
      return selectedMatch.players.map((p) => ({
        name: p.name,
        score: p.score || 0,
        darts: p.darts || 0,
        avg: p.accuracy || "0%",
      }));
    }

    if (selectedMatch.mode === "Bob's 27") {
      return selectedMatch.players.map((p) => ({
        name: p.name,
        score: p.score || 0,
        darts: p.darts || 0,
        status: p.status || (p.isBust ? "BUST" : "CLEARED"),
      }));
    }

    if (selectedMatch.mode === "100 Darts") {
      return selectedMatch.players.map((p) => {
        const hits: Record<string, any> = {};
        [...Array(20)].forEach((_, i) => (hits[i + 1] = { S: 0, D: 0, T: 0 }));
        hits[25] = { S: 0, D: 0, T: 0 };
        hits[0] = { S: 0, D: 0, T: 0 };

        if (p.allTurns) {
          p.allTurns.forEach((turn: any[]) => {
            turn.forEach((dart) => {
              if (
                dart &&
                typeof dart === "object" &&
                dart.v !== undefined &&
                hits[dart.v]
              ) {
                if (dart.m === 1) hits[dart.v].S++;
                if (dart.m === 2) hits[dart.v].D++;
                if (dart.m === 3) hits[dart.v].T++;
              }
            });
          });
        }

        return {
          name: p.name,
          score: p.score || 0,
          darts: p.darts || 0,
          avg: p.avg || "0.0",
          s140: p.s140 || 0,
          s180: p.s180 || 0,
          hits,
        };
      });
    }

    const playerMap: Record<string, any> = {};
    const winner = [...selectedMatch.players].sort(
      (a, b) =>
        (b.sets || 0) - (a.sets || 0) ||
        (b.legs || 0) - (a.legs || 0) ||
        (a.score || 0) - (b.score || 0),
    )[0];

    selectedMatch.players.forEach((p: any) => {
      playerMap[p.name] = {
        name: p.name,
        mPlayed: 1,
        mWon: winner && p.name === winner.name ? 1 : 0,
        totalPoints: 0,
        totalDarts: 0,
        first9DartsPoints: 0,
        first9DartsCount: 0,
        checkoutDarts: p.checkoutDarts || 0,
        checkoutHits: p.checkoutHits || 0,
        s180: 0,
        s140: 0,
        s100: 0,
        s60: 0,
        hits: {},
        coords: [],
      };
      [...Array(20)].forEach(
        (_, i) => (playerMap[p.name].hits[i + 1] = { S: 0, D: 0, T: 0 }),
      );
      playerMap[p.name].hits[25] = { S: 0, D: 0, T: 0 };
      playerMap[p.name].hits[0] = { S: 0, D: 0, T: 0 };

      if (p.allTurns) {
        const sumOfLengths = p.allTurns.reduce(
          (acc: number, t: any[]) => acc + t.length,
          0,
        );
        const isBuggyCompressed =
          p.totalMatchDarts &&
          p.totalMatchDarts > sumOfLengths &&
          !p.allTurns.some((t: any[]) => t.some((d: any) => d.d !== undefined));

        p.allTurns.forEach((turn: any[], index: number) => {
          const turnSum = turn.reduce(
            (a, b) => a + (typeof b === "number" ? b : b.v * b.m),
            0,
          );

          let turnDarts = turn.reduce(
            (a: any, b: any) =>
              a + (typeof b === "number" ? 1 : b.d !== undefined ? b.d : 1),
            0,
          );
          if (isBuggyCompressed) {
            turnDarts =
              index === p.allTurns.length - 1
                ? p.totalMatchDarts - index * 3
                : 3;
          }

          playerMap[p.name].totalPoints += turnSum;
          playerMap[p.name].totalDarts += turnDarts;
          if (index < 3) {
            playerMap[p.name].first9DartsPoints += turnSum;
            playerMap[p.name].first9DartsCount += turnDarts;
          }
          if (turnSum >= 180) playerMap[p.name].s180++;
          else if (turnSum >= 140) playerMap[p.name].s140++;
          else if (turnSum >= 100) playerMap[p.name].s100++;
          else if (turnSum >= 60) playerMap[p.name].s60++;
          turn.forEach((dart) => {
            const isScoreInput = dart.i === true || isBuggyCompressed;
            if (isScoreInput) return;
            if (dart.c) playerMap[p.name].coords.push(dart.c);

            if (
              typeof dart === "object" &&
              dart.v !== undefined &&
              playerMap[p.name].hits[dart.v]
            ) {
              if (dart.m === 1) playerMap[p.name].hits[dart.v].S++;
              if (dart.m === 2) playerMap[p.name].hits[dart.v].D++;
              if (dart.m === 3) playerMap[p.name].hits[dart.v].T++;
            }
          });
        });
      }
    });
    return Object.values(playerMap);
  }, [selectedMatch]);

  const renderGameCard = ({ item }: { item: MatchHistory }) => {
    const isCricket = item.mode === "Cricket";
    const isAroundTheClock = item.mode === "Around the Clock";
    const isBob27 = item.mode === "Bob's 27";
    const isHundredDarts = item.mode === "100 Darts";
    const isSpecialMode =
      isCricket || isAroundTheClock || isBob27 || isHundredDarts;

    let displayDate = item.date;
    if (isCricket && displayDate && !displayDate.includes(",")) {
      displayDate = displayDate.replace(
        /(\d{4}|\d{2}) (\d{2}:\d{2})/,
        "$1, $2",
      );
    }

    const isUnfinished = item.isUnfinished;

    const sortedPlayers = [...item.players].sort((a, b) => {
      if (isCricket)
        return (
          (b.sets || 0) - (a.sets || 0) ||
          (b.legs || 0) - (a.legs || 0) ||
          (b.score || 0) - (a.score || 0)
        );
      return (
        (b.sets || 0) - (a.sets || 0) ||
        (b.legs || 0) - (a.legs || 0) ||
        (a.score || 0) - (b.score || 0)
      );
    });

    let badgeBg = isCricket
      ? theme.colors.dangerLight
      : theme.colors.primaryLight;
    let badgeText = isCricket ? theme.colors.danger : theme.colors.primary;
    let badgeLabel = item.mode;
    if (item.mode === "Bob's 27") {
      badgeBg = "#fffbeb";
      badgeText = "#f59e0b";
      badgeLabel = "BOB'S";
    }
    if (item.mode === "100 Darts") {
      badgeBg = "#f0f9ff";
      badgeText = "#0ea5e9";
      badgeLabel = "100";
    }
    if (item.mode === "Around the Clock") {
      badgeBg = "#fdf2f8";
      badgeText = "#ec4899";
      badgeLabel = "CLOCK";
    }

    let settingsStr = "";
    if (item.mode === "X01")
      settingsStr = `${item.settings?.startPoints || 501} • ${(item.settings?.inRule || "straight").toUpperCase()} IN • ${(item.settings?.outRule || "double").toUpperCase()} OUT`;
    else if (item.mode === "Cricket")
      settingsStr = `CRICKET • ${(item.settings?.cricketMode === "no-score" ? "No Score" : "Standard").toUpperCase()}`;
    else settingsStr = item.mode.toUpperCase();

    return (
      <Pressable
        onPress={() => setSelectedMatch(item)}
        style={[styles.card, isUnfinished && styles.unfinishedCard]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={theme.colors.textMuted}
            />
            <Text style={styles.dateText}>{displayDate}</Text>
            {item.duration && (
              <>
                <Text
                  style={{
                    color: theme.colors.cardBorder,
                    marginHorizontal: 4,
                  }}
                >
                  •
                </Text>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.dateText}>{item.duration}</Text>
              </>
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
          {!isSpecialMode && (
            <Text style={styles.settingsTextBold}>
              {item.settings?.legs || 1} Leg / {item.settings?.sets || 1} Set
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
                    <Text style={styles.playerScore}>
                      {item.mode === "Around the Clock" ||
                      (item.mode === "Cricket" &&
                        item.settings?.cricketMode === "no-score")
                        ? `${p.darts || 0} darts`
                        : `${p.score || 0} pkt`}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.playerLegsSets}>
                        L:{p.legs || 0} S:{p.sets || 0}
                      </Text>
                      <Text style={styles.playerScore}>
                        {p.score === 0 ? "CHECKOUT" : `${p.score} pkt`}
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

  const activeSections = useMemo(() => {
    if (!selectedMatch) return [];

    const hasAnyHits = singleMatchStats.some((s: any) => {
      if (!s.hits) return false;
      return Object.values(s.hits).some(
        (h: any) => h.S > 0 || h.D > 0 || h.T > 0,
      );
    });

    if (selectedMatch.mode === "Cricket") {
      return [
        {
          id: "cricket_summary",
          title: t(language, "cricketSummary") || "Cricket summary",
        },
      ];
    }

    if (selectedMatch.mode === "Around the Clock") {
      return [{ id: "aroundtheclock_summary", title: "Around the Clock" }];
    }

    if (selectedMatch.mode === "Bob's 27") {
      return [{ id: "bob27_summary", title: "Bob's 27" }];
    }

    if (selectedMatch.mode === "100 Darts") {
      const sections = [{ id: "hundreddarts_summary", title: "100 Darts" }];
      if (hasAnyHits) {
        sections.push({
          id: "hit_chart",
          title: t(language, "sectorsHeader") || "Targets hitted",
        });
      }
      const hasAnyCoords = singleMatchStats.some(
        (s: any) => s.coords && s.coords.length > 0,
      );
      if (hasAnyCoords) {
        sections.push({
          id: "heatmap",
          title: t(language, "heatmap") || "Heatmap",
        });
      }
      return sections;
    }

    const sections = [
      {
        id: "performance",
        title: t(language, "avgHeader") || "First 9 / Average",
      },
      {
        id: "checkouts",
        title: t(language, "gameDartsHeader") || "Game Darts / Hit %",
      },
      {
        id: "scoring",
        title:
          t(language, "scoringHeader") || "Scoring (60+ / 100+ / 140+ / 180)",
      },
    ];

    if (hasAnyHits)
      sections.push({
        id: "hit_chart",
        title: t(language, "sectorsHeader") || "Targets hitted",
      });

    const hasAnyCoords = singleMatchStats.some(
      (s: any) => s.coords && s.coords.length > 0,
    );
    if (hasAnyCoords)
      sections.push({
        id: "heatmap",
        title: t(language, "heatmap") || "Heatmap",
      });

    return sections;
  }, [selectedMatch, singleMatchStats, language]);

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
            onSelect={setFilterMode}
            style={[styles.filterContainer, { width: 580 }]}
            options={[
              { id: "All", label: t(language, "all") || "All" },
              { id: "X01", label: "X01" },
              { id: "Cricket", label: "Cricket" },
              { id: "Bob's 27", label: "Bob's" },
              { id: "100 Darts", label: "100" },
              { id: "Around the Clock", label: "Clock" },
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
        data={filteredHistory.slice(0, visibleCount)}
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
              {t(language, "noGamesPlayed") || "No games played yet"}
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
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.modalHeaderTitle}>Statystyki Meczu</Text>
              <Text style={styles.modalHeaderSubtitle}>
                {selectedMatch?.date}{" "}
                {selectedMatch?.duration && `• ⏱ ${selectedMatch.duration}`}
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              {selectedMatch?.isUnfinished && (
                <Pressable
                  onPress={() => {
                    setSelectedMatch(null);
                    router.push({
                      pathname: "/gamemodes/dart",
                      params: { resumeData: JSON.stringify(selectedMatch) },
                    });
                  }}
                  style={styles.resumeBtnModal}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.resumeBtnText}>
                    {t(language, "resume") || "Resume"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setSelectedMatch(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMain}
                />
              </Pressable>
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
                mode={selectedMatch?.mode}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onRequestClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
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
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: theme.colors.card,
      elevation: 2,
    },
    unfinishedCard: {
      borderColor: theme.colors.warning,
      borderWidth: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    dateText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    cardHeaderActions: { flexDirection: "row", alignItems: "center", gap: 10 },
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
      backgroundColor: theme.colors.warning || "#f0ad4e",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    resumeBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.warning || "#f0ad4e",
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
