import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "expo-router";
import * as Sharing from "expo-sharing";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ViewShot from "react-native-view-shot";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

const HISTORY_KEY = "@dart_match_history";
const SECTIONS_KEY = "@dart_stats_sections_order";
const OPEN_SECTIONS_KEY = "@dart_stats_sections_open";
const COLLAPSED_PLAYERS_KEY = "@dart_stats_collapsed_players";

type Section = { id: string };
type TimeFilter = "today" | "7d" | "30d" | "all";

const parseDateString = (dateStr: string) => {
  try {
    const [datePart, timePart] = dateStr.split(", ");
    const [day, month, year] = datePart.split(".");
    const [hour, minute] = timePart.split(":");
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
  } catch (e) {
    return new Date(0);
  }
};

const ShareStatBox = ({ label, value, theme }: any) => (
  <View
    style={{
      width: "48%",
      backgroundColor: theme.colors.card,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      minHeight: 75,
      justifyContent: "center",
      marginBottom: 12,
    }}
  >
    <Text
      style={{
        fontSize: 10,
        fontWeight: "800",
        color: theme.colors.textMuted,
        marginBottom: 6,
      }}
    >
      {label}
    </Text>
    <Text
      style={{
        fontSize: 16,
        fontWeight: "900",
        color: theme.colors.textMain,
      }}
      adjustsFontSizeToFit
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const ShareCard = ({ playerName, stats, trendData, theme, language }: any) => {
  if (!stats)
    return (
      <View
        style={{
          width: 400,
          height: 400,
          backgroundColor: theme.colors.background,
        }}
      />
    );

  const winPct =
    stats.mPlayed > 0 ? ((stats.mWon / stats.mPlayed) * 100).toFixed(0) : "0";
  const hitPct =
    stats.checkoutDarts > 0
      ? ((stats.checkoutHits / stats.checkoutDarts) * 100).toFixed(1)
      : "0";
  const avg =
    stats.totalDarts > 0
      ? ((stats.totalPoints / stats.totalDarts) * 3).toFixed(1)
      : "0.0";
  const first9 =
    stats.first9Count > 0
      ? ((stats.first9Points / stats.first9Count) * 3).toFixed(1)
      : "0.0";

  return (
    <View
      collapsable={false}
      style={{
        width: 400,
        backgroundColor: theme.colors.background,
        padding: 24,
        paddingBottom: 30,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 12,
          marginTop: 10,
        }}
      >
        <View style={{ width: "48%", paddingBottom: 12 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: theme.colors.primary,
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            {t(language, "sharePlayerStats") || "PLAYER STATS"} • X01
          </Text>
          <Text
            style={{
              fontSize: 32,
              fontWeight: "900",
              color: theme.colors.textMain,
              textTransform: "uppercase",
            }}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {playerName}
          </Text>
        </View>

        <ShareStatBox
          label={t(language, "shareDartsThrown") || "DARTS THROWN"}
          value={stats.totalDarts.toString()}
          theme={theme}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <ShareStatBox
          label={t(language, "shareGamesWon") || "GAMES / WON"}
          value={`${stats.mPlayed} / ${stats.mWon} (${winPct}%)`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareFirst9Avg") || "FIRST 9 / AVG"}
          value={`${first9} / ${avg}`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareGameDartsHit") || "GAME DARTS / HIT %"}
          value={`${stats.checkoutDarts} / ${hitPct}%`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareScoring") || "100+ / 140+ / 180"}
          value={`${stats.s100} / ${stats.s140} / ${stats.s180}`}
          theme={theme}
        />
      </View>

      {trendData &&
        trendData.datasets &&
        trendData.datasets[0].data.length > 0 && (
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 16,
              padding: 16,
              paddingLeft: 4,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: theme.colors.textMuted,
                marginBottom: 12,
                textAlign: "center",
                paddingLeft: 12,
              }}
            >
              {t(language, "shareAvgLast10") || "AVERAGE OVER LAST 10 GAMES"}
            </Text>
            <LineChart
              data={trendData}
              width={340}
              height={160}
              formatYLabel={(yValue) =>
                " " + Math.round(Number(yValue)).toString()
              }
              chartConfig={{
                backgroundColor: theme.colors.card,
                backgroundGradientFrom: theme.colors.card,
                backgroundGradientTo: theme.colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => theme.colors.primary,
                labelColor: (opacity = 1) => theme.colors.textMuted,
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: theme.colors.primaryDark,
                },
                propsForLabels: {
                  fontSize: 10,
                  fontWeight: "bold",
                },
              }}
              bezier
              withVerticalLines={false}
              style={{
                borderRadius: 8,
                paddingRight: 35,
              }}
            />
          </View>
        )}

      <View
        style={{
          alignItems: "center",
          marginTop: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.cardBorder,
          paddingTop: 20,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "900",
            color: theme.colors.textMain,
          }}
        >
          🎯 Count Your Darts
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: theme.colors.textMuted,
            marginTop: 4,
          }}
        >
          {t(language, "shareGeneratedOn") || "Generated on"}{" "}
          {new Date().toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
};

const TrendCard = ({ data, theme, language, isOpen, onToggle, drag }: any) => {
  const styles = getStyles(theme);
  const [openPlayers, setOpenPlayers] = useState<Record<string, boolean>>({});

  const togglePlayer = (name: string) => {
    setOpenPlayers((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const playerNames = Object.keys(data || {});

  return (
    <ScaleDecorator activeScale={1.03}>
      <View style={{ paddingBottom: 16 }} collapsable={false}>
        <View style={styles.card}>
          <Pressable
            style={styles.sectionHeader}
            onPress={onToggle}
            onLongPress={!isOpen ? drag : undefined}
            delayLongPress={150}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="reorder-two"
                size={24}
                color={theme.colors.textLight}
                style={{ marginRight: 10, opacity: isOpen ? 0.3 : 1 }}
              />
              <Text style={styles.sectionTitle}>
                {t(language, "averageTrend") || "Average Trend (Last 10)"}
              </Text>
            </View>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {isOpen && (
            <View style={{ paddingBottom: 10 }}>
              {playerNames.length === 0 ? (
                <Text style={[styles.emptyText, { paddingVertical: 40 }]}>
                  {t(language, "insufficientDataTrend") ||
                    "Not enough data (min. 2 matches) for any selected player to draw a trend."}
                </Text>
              ) : (
                playerNames.map((playerName) => {
                  const chartData = data[playerName];
                  const isPlayerOpen = openPlayers[playerName] || false;

                  return (
                    <View
                      key={playerName}
                      style={{ paddingHorizontal: 18, marginBottom: 10 }}
                    >
                      <Pressable
                        style={styles.hitPlayerHeader}
                        onPress={() => togglePlayer(playerName)}
                      >
                        <Text style={styles.hitPlayerName}>{playerName}</Text>
                        <Ionicons
                          name={isPlayerOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={theme.colors.primary}
                        />
                      </Pressable>

                      {isPlayerOpen && (
                        <View style={{ alignItems: "center", marginTop: 10 }}>
                          <LineChart
                            data={chartData}
                            width={Dimensions.get("window").width - 70}
                            height={180}
                            formatYLabel={(yValue) =>
                              Math.round(Number(yValue)).toString()
                            }
                            chartConfig={{
                              backgroundColor: theme.colors.card,
                              backgroundGradientFrom: theme.colors.card,
                              backgroundGradientTo: theme.colors.card,
                              decimalPlaces: 0,
                              color: (opacity = 1) => theme.colors.primary,
                              labelColor: (opacity = 1) =>
                                theme.colors.textMuted,
                              propsForDots: {
                                r: "5",
                                strokeWidth: "2",
                                stroke: theme.colors.primaryDark,
                              },
                              propsForLabels: {
                                fontSize: 10,
                                fontWeight: "bold",
                              },
                            }}
                            bezier
                            style={{ borderRadius: 16 }}
                            withVerticalLines={false}
                            fromZero={false}
                          />
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </View>
    </ScaleDecorator>
  );
};

const StatCard = React.memo(
  ({
    item,
    drag,
    stats,
    isOpen,
    onToggle,
    noPlayersSelected,
    collapsedPlayers,
    onTogglePlayer,
    tripleTerm,
    missTerm,
    bullTerm,
  }: any) => {
    const [sortConfig, setSortConfig] = useState<{
      col: string;
      asc: boolean;
    } | null>(null);
    const { language } = useLanguage();
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const handleSort = (col: string) => {
      if (sortConfig?.col === col) {
        if (!sortConfig.asc) setSortConfig({ col, asc: true });
        else setSortConfig(null);
      } else {
        setSortConfig({ col, asc: false });
      }
    };

    const getTranslatedTitle = (id: string) => {
      switch (id) {
        case "games":
          return t(language, "gamesWonHeader") || "Games / Won / %";
        case "performance":
          return t(language, "avgHeader") || "First 9 / Average";
        case "checkouts":
          return t(language, "gameDartsHeader") || "Game Darts / Hit %";
        case "scoring":
          return (
            t(language, "scoringHeader") || "Scoring (60+ / 100+ / 140+ / 180)"
          );
        case "hit_chart":
          return t(language, "sectorsHeader") || "Targets hitted (S / D / T)";
        default:
          return id;
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
          case "mPlayed":
            valA = a.mPlayed;
            valB = b.mPlayed;
            break;
          case "mWon":
            valA = a.mWon;
            valB = b.mWon;
            break;
          case "winPct":
            valA = a.mPlayed > 0 ? a.mWon / a.mPlayed : 0;
            valB = b.mPlayed > 0 ? b.mWon / b.mPlayed : 0;
            break;
          case "avg":
            valA = a.totalDarts > 0 ? (a.totalPoints / a.totalDarts) * 3 : 0;
            valB = b.totalDarts > 0 ? (b.totalPoints / b.totalDarts) * 3 : 0;
            break;
          case "first9":
            valA = a.first9Count > 0 ? (a.first9Points / a.first9Count) * 3 : 0;
            valB = b.first9Count > 0 ? (b.first9Points / b.first9Count) * 3 : 0;
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
        }
        if (valA === valB) return 0;
        if (typeof valA === "string" && typeof valB === "string") {
          return sortConfig.asc
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortConfig.asc ? valA - valB : valB - valA;
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
      <ScaleDecorator activeScale={1.03}>
        <View style={{ paddingBottom: 16 }} collapsable={false}>
          <View style={styles.card}>
            <Pressable
              style={styles.sectionHeader}
              onPress={onToggle}
              onLongPress={!isOpen ? drag : undefined}
              delayLongPress={150}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="reorder-two"
                  size={24}
                  color={theme.colors.textLight}
                  style={{ marginRight: 10, opacity: isOpen ? 0.3 : 1 }}
                />
                <Text style={styles.sectionTitle}>
                  {getTranslatedTitle(item.id)}
                </Text>
              </View>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.colors.textMuted}
              />
            </Pressable>

            {isOpen && (
              <View style={styles.table}>
                {item.id === "games" && (
                  <>
                    <View style={styles.rowHeader}>
                      <SortableHeader
                        label={t(language, "player") || "Player"}
                        colKey="name"
                        isName
                      />
                      <SortableHeader label="Matches" colKey="mPlayed" />
                      <SortableHeader label="W" colKey="mWon" />
                      <SortableHeader label="W %" colKey="winPct" />
                    </View>
                    {sortedStats.map((s: any) => (
                      <View key={s.name} style={styles.row}>
                        <Text style={styles.cellName}>{s.name}</Text>
                        <Text style={styles.cell}>{s.mPlayed}</Text>
                        <Text
                          style={[styles.cell, { color: theme.colors.success }]}
                        >
                          {s.mWon}
                        </Text>
                        <Text style={styles.cell}>
                          {((s.mWon / s.mPlayed) * 100 || 0).toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </>
                )}

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
                          {((s.first9Points / s.first9Count) * 3 || 0).toFixed(
                            1,
                          )}
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
                      <SortableHeader label="Darts" colKey="checkoutDarts" />
                      <SortableHeader label="Hit %" colKey="checkoutPct" />
                    </View>
                    {sortedStats.map((s: any) => (
                      <View key={s.name} style={styles.row}>
                        <Text style={styles.cellName}>{s.name}</Text>
                        <Text style={styles.cell}>{s.checkoutDarts}</Text>
                        <Text
                          style={[styles.cell, { color: theme.colors.success }]}
                        >
                          {s.checkoutDarts > 0
                            ? (
                                (s.checkoutHits / s.checkoutDarts) *
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
                        20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
                        5, 4, 3, 2, 1, 25, 0,
                      ];
                      const hasHits = defaultTargets.some(
                        (t) =>
                          s.hits[t].S > 0 || s.hits[t].D > 0 || s.hits[t].T > 0,
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
                                  <Text style={styles.colText}>Target</Text>
                                </View>
                                <SortableHeader label="Single" colKey="S" />
                                <SortableHeader label="Double" colKey="D" />
                                <SortableHeader label={tripleTerm} colKey="T" />
                              </View>
                              {targets.map((target) => {
                                const h = s.hits[target];
                                if (h.S === 0 && h.D === 0 && h.T === 0)
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
                {stats.length === 0 && (
                  <Text style={styles.emptyText}>
                    {noPlayersSelected
                      ? "No players selected"
                      : "No data is available for this period"}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScaleDecorator>
    );
  },
);

export default function Statistics() {
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const { language } = useLanguage();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [history, setHistory] = useState<any[]>([]);
  const [appliedNames, setAppliedNames] = useState<string[]>([]);
  const [tempNames, setTempNames] = useState<string[]>([]);
  const [showPlayerFilter, setShowPlayerFilter] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSharePlayer, setSelectedSharePlayer] = useState<string | null>(
    null,
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");

  const viewShotRef = useRef<any>(null);

  const defaultSections: Section[] = [
    { id: "trend" },
    { id: "games" },
    { id: "performance" },
    { id: "checkouts" },
    { id: "scoring" },
    { id: "hit_chart" },
  ];

  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trend: true,
    games: true,
    performance: true,
    checkouts: true,
    scoring: true,
    hit_chart: true,
  });
  const [collapsedPlayers, setCollapsedPlayers] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const loadSettings = async () => {
      const [savedOrder, savedOpenState, savedCollapsedPlayers] =
        await Promise.all([
          AsyncStorage.getItem(SECTIONS_KEY),
          AsyncStorage.getItem(OPEN_SECTIONS_KEY),
          AsyncStorage.getItem(COLLAPSED_PLAYERS_KEY),
        ]);
      if (savedOrder) {
        const parsedOrder: Section[] = JSON.parse(savedOrder);
        const missingSections = defaultSections.filter(
          (def) => !parsedOrder.find((p) => p.id === def.id),
        );
        setSections(
          parsedOrder
            .map((p) => defaultSections.find((d) => d.id === p.id) || p)
            .concat(missingSections),
        );
      }
      if (savedOpenState)
        setOpenSections((prev) => ({ ...prev, ...JSON.parse(savedOpenState) }));
      if (savedCollapsedPlayers)
        setCollapsedPlayers(JSON.parse(savedCollapsedPlayers));
    };
    loadSettings();
  }, []);

  const saveSectionsOrder = async (newOrder: Section[]) => {
    setSections(newOrder);
    await AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(newOrder));
  };

  const togglePlayerCollapse = useCallback((playerName: string) => {
    setCollapsedPlayers((prev) => {
      const newState = { ...prev, [playerName]: !prev[playerName] };
      AsyncStorage.setItem(COLLAPSED_PLAYERS_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: `${t(language, "stats") || "Statistics"} (${t(language, "x01") || "X01"})`,
      headerRight: () => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginRight: 10,
          }}
        >
          <Pressable
            onPress={() => setShowShareModal(true)}
            style={{ padding: 5 }}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={theme.colors.primary}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              setTempNames(appliedNames);
              setShowPlayerFilter(true);
            }}
            style={{ padding: 5 }}
          >
            <Ionicons name="filter" size={24} color={theme.colors.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, appliedNames, language, theme]);

  useFocusEffect(
    useCallback(() => {
      setTimeFilter("today");
      AsyncStorage.getItem(HISTORY_KEY).then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved);
          setHistory(parsed);
          const allNames = Array.from(
            new Set(
              parsed.flatMap((m: any) => m.players.map((p: any) => p.name)),
            ),
          ) as string[];
          setAppliedNames((prev) => (prev.length === 0 ? allNames : prev));
        }
      });
    }, []),
  );

  const trendData = useMemo(() => {
    const chronologicalHistory = [...history]
      .filter((m) => m.mode === "X01")
      .sort(
        (a, b) =>
          parseDateString(a.date).getTime() - parseDateString(b.date).getTime(),
      );

    const dataByPlayer: Record<string, any> = {};

    appliedNames.forEach((playerName) => {
      const dataPoints: number[] = [];
      const labels: string[] = [];

      chronologicalHistory.forEach((match) => {
        const p = match.players.find(
          (player: any) => player.name === playerName,
        );
        if (p && p.allTurns) {
          let pts = 0;
          let darts = 0;
          p.allTurns.forEach((turn: any) => {
            pts += turn.reduce(
              (a: any, b: any) => a + (typeof b === "number" ? b : b.v * b.m),
              0,
            );
            darts += turn.length;
          });
          if (darts > 0) {
            dataPoints.push(Number(((pts / darts) * 3).toFixed(1)));
            labels.push(
              match.date.split(".")[0] + "." + match.date.split(".")[1],
            );
          }
        }
      });

      if (dataPoints.length >= 2) {
        dataByPlayer[playerName] = {
          labels: labels.slice(-10),
          datasets: [{ data: dataPoints.slice(-10) }],
        };
      }
    });

    return dataByPlayer;
  }, [history, appliedNames]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const filteredHistory = history.filter((match) => {
      if (match.mode !== "X01") return false;

      if (timeFilter === "all" || !match.date) return true;
      const matchDate = parseDateString(match.date);
      if (timeFilter === "today") return matchDate >= startOfToday;
      if (timeFilter === "7d") return matchDate >= sevenDaysAgo;
      if (timeFilter === "30d") return matchDate >= thirtyDaysAgo;
      return true;
    });

    const playerMap: Record<string, any> = {};
    filteredHistory.forEach((match) => {
      const winner = [...match.players].sort(
        (a, b) =>
          (b.sets || 0) - (a.sets || 0) ||
          (b.legs || 0) - (a.legs || 0) ||
          (a.score || 0) - (b.score || 0),
      )[0];
      match.players.forEach((p: any) => {
        if (!appliedNames.includes(p.name)) return;
        if (!playerMap[p.name]) {
          playerMap[p.name] = {
            name: p.name,
            mPlayed: 0,
            mWon: 0,
            totalPoints: 0,
            totalDarts: 0,
            first9Points: 0,
            first9Count: 0,
            checkoutDarts: 0,
            checkoutHits: 0,
            s180: 0,
            s140: 0,
            s100: 0,
            s60: 0,
            hits: {},
          };
          [...Array(20)].forEach(
            (_, i) => (playerMap[p.name].hits[i + 1] = { S: 0, D: 0, T: 0 }),
          );
          playerMap[p.name].hits[25] = { S: 0, D: 0, T: 0 };
          playerMap[p.name].hits[0] = { S: 0, D: 0, T: 0 };
        }
        const s = playerMap[p.name];
        s.mPlayed += 1;
        if (winner && p.name === winner.name) s.mWon += 1;
        s.checkoutDarts += p.checkoutDarts || 0;
        s.checkoutHits += p.checkoutHits || 0;
        if (p.allTurns) {
          p.allTurns.forEach((turn: any[], index: number) => {
            const turnSum = turn.reduce(
              (a, b) => a + (typeof b === "number" ? b : b.v * b.m),
              0,
            );
            s.totalPoints += turnSum;
            s.totalDarts += turn.length;
            if (index < 3) {
              s.first9Points += turnSum;
              s.first9Count += turn.length;
            }
            if (turnSum >= 180) s.s180++;
            else if (turnSum >= 140) s.s140++;
            else if (turnSum >= 100) s.s100++;
            else if (turnSum >= 60) s.s60++;
            turn.forEach((dart) => {
              if (typeof dart === "object" && dart.v !== undefined) {
                const target = dart.v;
                const mult = dart.m;
                if (s.hits[target]) {
                  if (mult === 1) s.hits[target].S++;
                  if (mult === 2) s.hits[target].D++;
                  if (mult === 3) s.hits[target].T++;
                }
              }
            });
          });
        }
      });
    });
    return Object.values(playerMap);
  }, [history, appliedNames, timeFilter]);

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const newState = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  const handleShareAction = async (playerName: string) => {
    setSelectedSharePlayer(playerName);
    setShowShareModal(false);

    setTimeout(async () => {
      if (viewShotRef.current && viewShotRef.current.capture) {
        try {
          const uri = await viewShotRef.current.capture();
          await Sharing.shareAsync(uri, {
            dialogTitle: "Share your Darts Stats!",
            mimeType: "image/jpeg",
          });
        } catch (error) {
          console.error("Oops, snapshot failed", error);
        } finally {
          setSelectedSharePlayer(null);
        }
      }
    }, 750);
  };

  const renderItem = useCallback(
    ({ item, drag }: RenderItemParams<Section>) => {
      if (item.id === "trend") {
        return (
          <TrendCard
            data={trendData}
            theme={theme}
            language={language}
            isOpen={openSections.trend}
            onToggle={() => toggleSection("trend")}
            drag={drag}
          />
        );
      }
      return (
        <StatCard
          item={item}
          drag={drag}
          stats={stats}
          isOpen={openSections[item.id]}
          onToggle={() => toggleSection(item.id)}
          noPlayersSelected={appliedNames.length === 0}
          collapsedPlayers={collapsedPlayers}
          onTogglePlayer={togglePlayerCollapse}
          tripleTerm={tripleTerm}
          missTerm={missTerm}
          bullTerm={bullTerm}
        />
      );
    },
    [
      stats,
      openSections,
      appliedNames,
      collapsedPlayers,
      trendData,
      theme,
      language,
    ],
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.segmentContainer}>
        {(["today", "7d", "30d", "all"] as TimeFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[
              styles.segmentBtn,
              timeFilter === f && styles.segmentBtnActive,
            ]}
            onPress={() => setTimeFilter(f)}
          >
            <Text
              style={[
                styles.segmentText,
                timeFilter === f && styles.segmentTextActive,
              ]}
            >
              {f === "today"
                ? t(language, "today") || "Today"
                : f === "7d"
                  ? t(language, "week") || "7 days"
                  : f === "30d"
                    ? t(language, "month") || "30 days"
                    : t(language, "all") || "All time"}
            </Text>
          </Pressable>
        ))}
      </View>
      <DraggableFlatList
        data={sections}
        onDragEnd={({ data }) => saveSectionsOrder(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        activationDistance={15}
      />

      <Modal visible={showPlayerFilter} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPlayerFilter(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>
              {t(language, "selectPlayers") || "Select players"}
            </Text>
            <FlatList
              data={Array.from(
                new Set(
                  history.flatMap((m) => m.players.map((p: any) => p.name)),
                ),
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.filterRow}
                  onPress={() =>
                    setTempNames((prev) =>
                      prev.includes(item)
                        ? prev.filter((n) => n !== item)
                        : [...prev, item],
                    )
                  }
                >
                  <Text style={styles.filterRowText}>{item}</Text>
                  <Ionicons
                    name={
                      tempNames.includes(item) ? "checkbox" : "square-outline"
                    }
                    size={26}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
            />
            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                setAppliedNames(tempNames);
                setShowPlayerFilter(false);
              }}
            >
              <Text style={styles.closeBtnText}>
                {t(language, "setFilters") || "Set filters"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showShareModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowShareModal(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>
              {t(language, "shareStatsTitle") || "Share Stats"} (X01)
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                textAlign: "center",
                marginBottom: 20,
                fontWeight: "600",
              }}
            >
              {t(language, "shareStatsDesc") ||
                "Select a player to generate a sharing card"}
            </Text>
            <FlatList
              data={stats.map((s: any) => s.name)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.filterRow}
                  onPress={() => handleShareAction(item)}
                >
                  <Text style={styles.filterRowText}>{item}</Text>
                  <Ionicons
                    name="share-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {t(language, "noDataFilters") ||
                    "No data available for applied filters."}
                </Text>
              }
            />
            <Pressable
              style={[
                styles.closeBtn,
                { backgroundColor: theme.colors.cardBorder },
              ]}
              onPress={() => setShowShareModal(false)}
            >
              <Text
                style={[styles.closeBtnText, { color: theme.colors.textMain }]}
              >
                {t(language, "cancel") || "Cancel"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {selectedSharePlayer && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: -10,
            opacity: 0.01,
            pointerEvents: "none",
          }}
        >
          <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 1 }}>
            <ShareCard
              playerName={selectedSharePlayer}
              stats={stats.find((s: any) => s.name === selectedSharePlayer)}
              trendData={trendData[selectedSharePlayer]}
              theme={theme}
              language={language}
            />
          </ViewShot>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    segmentContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.cardBorder,
      margin: 16,
      marginBottom: 0,
      borderRadius: 12,
      padding: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 10,
    },
    segmentBtnActive: {
      backgroundColor: theme.colors.primaryDark,
      elevation: 2,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    segmentTextActive: { color: "#fff" },
    card: {
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
    emptyText: {
      textAlign: "center",
      padding: 20,
      color: theme.colors.textLight,
      fontStyle: "italic",
      fontWeight: "bold",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 30,
      padding: 25,
      maxHeight: "80%",
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      marginBottom: 5,
      color: theme.colors.textMain,
      textAlign: "center",
    },
    filterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    filterRowText: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    closeBtn: {
      backgroundColor: theme.colors.primary,
      padding: 18,
      borderRadius: 15,
      marginTop: 20,
      alignItems: "center",
    },
    closeBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  });
