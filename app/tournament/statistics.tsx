import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, {
    useCallback,
    useEffect,
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
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

import DraggableFlatList, {
    RenderItemParams,
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

const TOURNAMENT_HISTORY_KEY = "@tournament_history";
const SECTIONS_KEY = "@dart_tourney_stats_sections_order";
const OPEN_SECTIONS_KEY = "@dart_tourney_stats_sections_open";

type Section = { id: string };
type TimeFilter = "today" | "7d" | "30d" | "all";

const ShareStatBox = ({ label, value, theme, fullWidth }: any) => (
  <View
    style={{
      width: fullWidth ? "100%" : "48%",
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
        textTransform: "uppercase",
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
    stats.coAtt > 0 ? ((stats.coHits / stats.coAtt) * 100).toFixed(1) : "0";
  const avg =
    stats.totalTurns > 0
      ? (stats.totalPoints / stats.totalTurns).toFixed(1)
      : "0.0";
  const first9 =
    stats.first9Count > 0
      ? (stats.first9Points / stats.first9Count).toFixed(1)
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
            {t(language, "sharePlayerStats") || "PLAYER STATS"} • TOURNAMENTS
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
          label={t(language, "shareMatchesPlayed") || "MATCHES PLAYED"}
          value={stats.mPlayed.toString()}
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
          label={t(language, "shareTournaments") || "TOURNAMENTS (1st / 2nd)"}
          value={`${stats.tPlayed} (${stats.t1st} / ${stats.t2nd})`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareGamesWon") || "MATCHES / WON"}
          value={`${stats.mPlayed} / ${stats.mWon} (${winPct}%)`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareFirst9Avg") || "FIRST 9 / AVG"}
          value={`${first9} / ${avg}`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareCheckoutsHit") || "CHECKOUTS / HIT %"}
          value={`${stats.coHits} / ${hitPct}%`}
          theme={theme}
        />
        <ShareStatBox
          label={t(language, "shareScoring") || "100+ / 140+ / 180"}
          value={`${stats.s100} / ${stats.s140} / ${stats.s180}`}
          theme={theme}
          fullWidth
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
              {t(language, "shareAvgLast10") || "AVERAGE OVER LAST 10 MATCHES"}
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
                color: () => theme.colors.primary,
                labelColor: () => theme.colors.textMuted,
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: theme.colors.primaryDark,
                },
                propsForLabels: { fontSize: 10, fontWeight: "bold" },
              }}
              bezier
              withVerticalLines={false}
              style={{ borderRadius: 8, paddingRight: 35 }}
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
      </View>
    </View>
  );
};

const TrendCard = ({ data, theme, language, isOpen, onToggle, drag }: any) => {
  const styles = getStyles(theme);
  const [openPlayers, setOpenPlayers] = useState<Record<string, boolean>>({});
  const togglePlayer = (name: string) =>
    setOpenPlayers((prev) => ({ ...prev, [name]: !prev[name] }));
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
                    "Not enough data for any selected player to draw a trend."}
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
                              color: () => theme.colors.primary,
                              labelColor: () => theme.colors.textMuted,
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
  ({ item, drag, stats, isOpen, onToggle, noPlayersSelected }: any) => {
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
      } else setSortConfig({ col, asc: false });
    };

    const getTranslatedTitle = (id: string) => {
      switch (id) {
        case "tournaments":
          return (
            t(language, "tournamentsHeader") ||
            "Tournaments (Played / 1st / 2nd)"
          );
        case "games":
          return t(language, "gamesWonHeader") || "Matches / Won / %";
        case "performance":
          return t(language, "avgHeader") || "First 9 / Average";
        case "checkouts":
          return t(language, "gameDartsHeader") || "Checkouts / Hit %";
        case "scoring":
          return (
            t(language, "scoringHeader") || "Scoring (60+ / 100+ / 140+ / 180)"
          );
        default:
          return id;
      }
    };

    const sortedStats = useMemo(() => {
      if (!sortConfig) return stats;
      return [...stats].sort((a, b) => {
        let valA: any = 0,
          valB: any = 0;
        switch (sortConfig.col) {
          case "name":
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case "tPlayed":
            valA = a.tPlayed;
            valB = b.tPlayed;
            break;
          case "t1st":
            valA = a.t1st;
            valB = b.t1st;
            break;
          case "t2nd":
            valA = a.t2nd;
            valB = b.t2nd;
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
            valA = a.totalTurns > 0 ? a.totalPoints / a.totalTurns : 0;
            valB = b.totalTurns > 0 ? b.totalPoints / b.totalTurns : 0;
            break;
          case "first9":
            valA = a.first9Count > 0 ? a.first9Points / a.first9Count : 0;
            valB = b.first9Count > 0 ? b.first9Points / b.first9Count : 0;
            break;
          case "checkoutDarts":
            valA = a.coAtt;
            valB = b.coAtt;
            break;
          case "checkoutPct":
            valA = a.coAtt > 0 ? a.coHits / a.coAtt : 0;
            valB = b.coAtt > 0 ? b.coHits / b.coAtt : 0;
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
        if (typeof valA === "string" && typeof valB === "string")
          return sortConfig.asc
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        return sortConfig.asc ? valA - valB : valB - valA;
      });
    }, [stats, sortConfig]);

    const SortableHeader = ({
      label,
      colKey,
      isName = false,
    }: {
      label: string;
      colKey: string;
      isName?: boolean;
    }) => (
      <Pressable
        style={isName ? styles.colNameWrap : styles.colWrap}
        onPress={() => handleSort(colKey)}
      >
        <Text style={styles.colText}>{label}</Text>
        {sortConfig?.col === colKey && (
          <Ionicons
            name={sortConfig.asc ? "caret-up" : "caret-down"}
            size={12}
            color={theme.colors.success}
            style={{ marginLeft: 2 }}
          />
        )}
      </Pressable>
    );

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
                {item.id === "tournaments" && (
                  <>
                    <View style={styles.rowHeader}>
                      <SortableHeader
                        label={t(language, "player") || "Player"}
                        colKey="name"
                        isName
                      />
                      <SortableHeader
                        label={t(language, "playedShort") || "Played"}
                        colKey="tPlayed"
                      />
                      <SortableHeader label="1st" colKey="t1st" />
                      <SortableHeader label="2nd" colKey="t2nd" />
                    </View>
                    {sortedStats.map((s: any) => (
                      <View key={s.name} style={styles.row}>
                        <Text style={styles.cellName}>{s.name}</Text>
                        <Text style={styles.cell}>{s.tPlayed}</Text>
                        <Text
                          style={[
                            styles.cell,
                            { color: theme.colors.warning, fontWeight: "900" },
                          ]}
                        >
                          {s.t1st}
                        </Text>
                        <Text
                          style={[
                            styles.cell,
                            {
                              color: theme.colors.textMuted,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {s.t2nd}
                        </Text>
                      </View>
                    ))}
                  </>
                )}

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
                          {((s.mWon / (s.mPlayed || 1)) * 100).toFixed(0)}%
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
                          {(s.first9Points / (s.first9Count || 1)).toFixed(1)}
                        </Text>
                        <Text
                          style={[
                            styles.cell,
                            { color: theme.colors.success, fontWeight: "bold" },
                          ]}
                        >
                          {(s.totalPoints / (s.totalTurns || 1)).toFixed(1)}
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
                      <SortableHeader label="Att" colKey="checkoutDarts" />
                      <SortableHeader label="Hit %" colKey="checkoutPct" />
                    </View>
                    {sortedStats.map((s: any) => (
                      <View key={s.name} style={styles.row}>
                        <Text style={styles.cellName}>{s.name}</Text>
                        <Text style={styles.cell}>{s.coAtt}</Text>
                        <Text
                          style={[styles.cell, { color: theme.colors.success }]}
                        >
                          {s.coAtt > 0
                            ? ((s.coHits / s.coAtt) * 100).toFixed(1) + "%"
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

export default function TournamentStatistics() {
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [history, setHistory] = useState<any[]>([]);
  const [appliedNames, setAppliedNames] = useState<string[]>([]);
  const [tempNames, setTempNames] = useState<string[]>([]);

  const [showPlayerFilter, setShowPlayerFilter] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSharePlayer, setSelectedSharePlayer] = useState<string | null>(
    null,
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const viewShotRef = useRef<any>(null);

  const defaultSections: Section[] = [
    { id: "trend" },
    { id: "tournaments" },
    { id: "games" },
    { id: "performance" },
    { id: "checkouts" },
    { id: "scoring" },
  ];

  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trend: true,
    tournaments: true,
    games: true,
    performance: true,
    checkouts: true,
    scoring: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      const [savedOrder, savedOpenState] = await Promise.all([
        AsyncStorage.getItem(SECTIONS_KEY),
        AsyncStorage.getItem(OPEN_SECTIONS_KEY),
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
    };
    loadSettings();
  }, []);

  const saveSectionsOrder = async (newOrder: Section[]) => {
    setSections(newOrder);
    await AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(newOrder));
  };

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(TOURNAMENT_HISTORY_KEY).then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved);
          setHistory(parsed);
          const allNames = Array.from(
            new Set(
              parsed.flatMap(
                (t: any) => t.players?.map((p: any) => p.name) || [],
              ),
            ),
          ) as string[];
          setAppliedNames((prev) => (prev.length === 0 ? allNames : prev));
        }
      });
    }, []),
  );

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const filteredHistory = history.filter((tourney) => {
      if (timeFilter === "all" || !tourney.finishedAt) return true;
      const matchDate = new Date(tourney.finishedAt);
      if (timeFilter === "today") return matchDate >= startOfToday;
      if (timeFilter === "7d") return matchDate >= sevenDaysAgo;
      if (timeFilter === "30d") return matchDate >= thirtyDaysAgo;
      return true;
    });

    const playerMap: Record<string, any> = {};

    filteredHistory.forEach((tourney) => {
      let firstPlace: string | null = null;
      let secondPlace: string | null = null;

      if (tourney.settings?.format === "round_robin") {
        const rrStats: Record<string, any> = {};
        tourney.players?.forEach((p: any) => {
          rrStats[p.name] = { won: 0, legsFor: 0, legsAgainst: 0 };
        });
        tourney.bracket?.forEach((m: any) => {
          if (m.isBye || !m.winner || !m.player1 || !m.player2) return;
          if (m.winner.id === m.player1.id) {
            if (rrStats[m.player1.name]) rrStats[m.player1.name].won++;
          } else {
            if (rrStats[m.player2.name]) rrStats[m.player2.name].won++;
          }
          if (m.score) {
            if (tourney.settings?.targetSets > 1) {
              if (rrStats[m.player1.name]) {
                rrStats[m.player1.name].legsFor += m.score.p1Sets || 0;
                rrStats[m.player1.name].legsAgainst += m.score.p2Sets || 0;
              }
              if (rrStats[m.player2.name]) {
                rrStats[m.player2.name].legsFor += m.score.p2Sets || 0;
                rrStats[m.player2.name].legsAgainst += m.score.p1Sets || 0;
              }
            } else {
              if (rrStats[m.player1.name]) {
                rrStats[m.player1.name].legsFor += m.score.p1Legs || 0;
                rrStats[m.player1.name].legsAgainst += m.score.p2Legs || 0;
              }
              if (rrStats[m.player2.name]) {
                rrStats[m.player2.name].legsFor += m.score.p2Legs || 0;
                rrStats[m.player2.name].legsAgainst += m.score.p1Legs || 0;
              }
            }
          }
        });
        const sorted = Object.keys(rrStats).sort((a, b) => {
          if (rrStats[b].won !== rrStats[a].won)
            return rrStats[b].won - rrStats[a].won;
          const diffA = rrStats[a].legsFor - rrStats[a].legsAgainst;
          const diffB = rrStats[b].legsFor - rrStats[b].legsAgainst;
          return diffB - diffA;
        });
        if (sorted.length > 0) firstPlace = sorted[0];
        if (sorted.length > 1) secondPlace = sorted[1];
      } else {
        const koMatches = tourney.bracket?.filter(
          (b: any) => b.phase === "knockout" || !b.phase,
        );
        if (koMatches && koMatches.length > 0) {
          const totalR = Math.max(...koMatches.map((b: any) => b.round));
          const finalMatch = koMatches.find(
            (m: any) => m.round === totalR && !m.isThirdPlace,
          );
          if (finalMatch && finalMatch.winner) {
            firstPlace = finalMatch.winner.name;
            secondPlace =
              finalMatch.winner.id === finalMatch.player1?.id
                ? finalMatch.player2?.name
                : finalMatch.player1?.name;
          }
        }
      }

      const initPlayer = (name: string) => {
        if (!playerMap[name]) {
          playerMap[name] = {
            name,
            mPlayed: 0,
            mWon: 0,
            lWon: 0,
            totalPoints: 0,
            totalTurns: 0,
            first9Points: 0,
            first9Count: 0,
            s60: 0,
            s100: 0,
            s140: 0,
            s180: 0,
            coHits: 0,
            coAtt: 0,
            tPlayed: 0,
            t1st: 0,
            t2nd: 0,
          };
        }
      };

      const participants = tourney.players?.map((p: any) => p.name) || [];
      participants.forEach((pName: string) => {
        if (appliedNames.includes(pName)) {
          initPlayer(pName);
          playerMap[pName].tPlayed++;
        }
      });

      if (firstPlace && appliedNames.includes(firstPlace)) {
        initPlayer(firstPlace);
        playerMap[firstPlace].t1st++;
      }
      if (secondPlace && appliedNames.includes(secondPlace)) {
        initPlayer(secondPlace);
        playerMap[secondPlace].t2nd++;
      }

      tourney.bracket?.forEach((match: any) => {
        if (match.isBye || !match.player1 || !match.winner) return;

        const p1Name = match.player1.name;
        const p2Name = match.player2?.name;

        if (appliedNames.includes(p1Name)) {
          initPlayer(p1Name);
          playerMap[p1Name].mPlayed++;
          if (match.winner?.id === match.player1.id) playerMap[p1Name].mWon++;
        }

        if (p2Name && appliedNames.includes(p2Name)) {
          initPlayer(p2Name);
          playerMap[p2Name].mPlayed++;
          if (match.winner?.id === match.player2.id) playerMap[p2Name].mWon++;
        }

        const coStat = match.stats?.find((s: any) => s.label === "Checkout %");
        if (coStat) {
          if (appliedNames.includes(p1Name)) {
            const p1Match = String(coStat.p1).match(/\((\d+)\/(\d+)\)/);
            if (p1Match) {
              playerMap[p1Name].coHits += parseInt(p1Match[1], 10);
              playerMap[p1Name].coAtt += parseInt(p1Match[2], 10);
            }
          }
          if (p2Name && appliedNames.includes(p2Name) && coStat.p2) {
            const p2Match = String(coStat.p2).match(/\((\d+)\/(\d+)\)/);
            if (p2Match) {
              playerMap[p2Name].coHits += parseInt(p2Match[1], 10);
              playerMap[p2Name].coAtt += parseInt(p2Match[2], 10);
            }
          }
        }

        if (match.logs) {
          match.logs.forEach((leg: any) => {
            if (
              leg.winnerId === match.player1.id &&
              appliedNames.includes(p1Name)
            )
              playerMap[p1Name].lWon++;
            else if (
              p2Name &&
              leg.winnerId === match.player2.id &&
              appliedNames.includes(p2Name)
            )
              playerMap[p2Name].lWon++;

            const processThrows = (throws: string[], name: string) => {
              if (!appliedNames.includes(name)) return;
              throws.forEach((tStr, idx) => {
                const val = tStr === "BUST" ? 0 : parseInt(tStr);
                playerMap[name].totalPoints += val;
                playerMap[name].totalTurns++;
                if (idx < 3) {
                  playerMap[name].first9Points += val;
                  playerMap[name].first9Count++;
                }
                if (val >= 180) playerMap[name].s180++;
                else if (val >= 140) playerMap[name].s140++;
                else if (val >= 100) playerMap[name].s100++;
                else if (val >= 60) playerMap[name].s60++;
              });
            };

            processThrows(leg.p1Throws || [], p1Name);
            if (p2Name) processThrows(leg.p2Throws || [], p2Name);
          });
        }
      });
    });

    return Object.values(playerMap);
  }, [history, appliedNames, timeFilter]);

  const trendData = useMemo(() => {
    const chronologicalHistory = [...history].sort(
      (a, b) =>
        new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime(),
    );
    const dataByPlayer: Record<string, any> = {};

    appliedNames.forEach((playerName) => {
      const dataPoints: number[] = [];
      const labels: string[] = [];

      chronologicalHistory.forEach((tourney) => {
        let tPoints = 0;
        let tTurns = 0;

        tourney.bracket?.forEach((match: any) => {
          if (match.isBye || !match.winner || !match.logs) return;
          const isP1 = match.player1?.name === playerName;
          const isP2 = match.player2?.name === playerName;
          if (!isP1 && !isP2) return;

          match.logs.forEach((leg: any) => {
            const throws = isP1 ? leg.p1Throws : leg.p2Throws;
            if (throws) {
              throws.forEach((tStr: string) => {
                tPoints += tStr === "BUST" ? 0 : parseInt(tStr);
                tTurns++;
              });
            }
          });
        });

        if (tTurns > 0) {
          dataPoints.push(Number((tPoints / tTurns).toFixed(1)));
          const d = new Date(tourney.finishedAt);
          labels.push(`${d.getDate()}.${d.getMonth() + 1}`);
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
      if (item.id === "trend")
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
      return (
        <StatCard
          item={item}
          drag={drag}
          stats={stats}
          isOpen={openSections[item.id]}
          onToggle={() => toggleSection(item.id)}
          noPlayersSelected={appliedNames.length === 0}
        />
      );
    },
    [stats, openSections, appliedNames, trendData, theme, language],
  );

  const allHistoryPlayers = useMemo(() => {
    return Array.from(
      new Set(
        history.flatMap((t: any) => t.players?.map((p: any) => p.name) || []),
      ),
    ) as string[];
  }, [history]);

  const filteredHistoryPlayers = useMemo(() => {
    return allHistoryPlayers
      .filter((p) => p.toLowerCase().includes(filterSearchQuery.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, language === "pl" ? "pl" : "en"));
  }, [allHistoryPlayers, filterSearchQuery, language]);

  const allSelected =
    filteredHistoryPlayers.length > 0 &&
    filteredHistoryPlayers.every((p) => tempNames.includes(p));

  return (
    <GestureHandlerRootView
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t(language, "tournamentStatistics") || "Tournament Stats"}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowShareModal(true)}
            style={styles.headerBtn}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setTempNames(appliedNames);
              setShowPlayerFilter(true);
            }}
            style={styles.headerBtn}
          >
            <Ionicons name="filter" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 160 + insets.bottom,
        }}
        activationDistance={15}
      />

      <Modal visible={showPlayerFilter} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowPlayerFilter(false);
            setFilterSearchQuery("");
          }}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>
              {t(language, "selectPlayers") || "Select players"}
            </Text>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={theme.colors.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t(language, "searchPlayer") || "Search player..."}
                placeholderTextColor={theme.colors.textMuted}
                value={filterSearchQuery}
                onChangeText={setFilterSearchQuery}
              />
            </View>

            <View style={styles.selectAllRow}>
              <Text style={styles.selectAllLabel}>
                {filteredHistoryPlayers.length}{" "}
                {t(language, "playersShort") || "players"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (allSelected) {
                    setTempNames(
                      tempNames.filter(
                        (n) => !filteredHistoryPlayers.includes(n),
                      ),
                    );
                  } else {
                    setTempNames(
                      Array.from(
                        new Set([...tempNames, ...filteredHistoryPlayers]),
                      ),
                    );
                  }
                }}
              >
                <Text style={styles.selectAllText}>
                  {allSelected
                    ? t(language, "deselectAll") || "Deselect all"
                    : t(language, "selectAll") || "Select all"}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              style={{ flexShrink: 1 }}
              data={filteredHistoryPlayers}
              keyExtractor={(item: any) => item}
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
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {t(language, "noPlayersMatch") ||
                    "No players match the criteria."}
                </Text>
              }
            />
            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                setAppliedNames(tempNames);
                setShowPlayerFilter(false);
                setFilterSearchQuery("");
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
              {t(language, "shareStatsTitle") || "Share Stats"}
            </Text>
            <FlatList
              style={{ flexShrink: 1 }}
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
            />
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerBtn: { padding: 4 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      flex: 1,
      textAlign: "center",
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
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
    colText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textLight,
    },
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
      maxHeight: "85%",
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      marginBottom: 10,
      color: theme.colors.textMain,
      textAlign: "center",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      paddingLeft: 8,
      color: theme.colors.textMain,
      fontSize: 16,
    },
    selectAllRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    selectAllLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    selectAllText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.primary,
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
