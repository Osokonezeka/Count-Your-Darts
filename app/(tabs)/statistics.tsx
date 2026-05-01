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
import { FlatList, Modal, Pressable, Text, View } from "react-native";

import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ViewShot from "react-native-view-shot";
import { useLanguage } from "../../context/LanguageContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { getStatisticsStyles } from "../../components/statistics/StatisticsStyles";
import {
  ShareCard,
  TrendCard,
  StatCard,
} from "../../components/statistics/StatisticsComponents";
import { SelectPlayersModal } from "../../components/modals/SelectPlayersModal";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";

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

export default function Statistics() {
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const { language } = useLanguage();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStatisticsStyles(theme);

  const [history, setHistory] = useState<any[]>([]);
  const [appliedNames, setAppliedNames] = useState<string[]>([]);
  const [tempNames, setTempNames] = useState<string[]>([]);
  const [showPlayerFilter, setShowPlayerFilter] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
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
    { id: "heatmap" },
  ];

  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trend: true,
    games: true,
    performance: true,
    checkouts: true,
    scoring: true,
    hit_chart: true,
    heatmap: true,
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
          <AnimatedPressable
            onPress={() => setShowShareModal(true)}
            style={{ padding: 5 }}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={theme.colors.primary}
            />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              setTempNames(appliedNames);
              setShowPlayerFilter(true);
            }}
            style={{ padding: 5 }}
          >
            <Ionicons name="filter" size={24} color={theme.colors.primary} />
          </AnimatedPressable>
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
          const sumOfLengths = p.allTurns.reduce(
            (acc: number, t: any[]) => acc + t.length,
            0,
          );
          const isBuggyCompressed =
            p.totalMatchDarts &&
            p.totalMatchDarts > sumOfLengths &&
            !p.allTurns.some((t: any[]) =>
              t.some((d: any) => d.d !== undefined),
            );

          p.allTurns.forEach((turn: any) => {
            pts += turn.reduce(
              (a: any, b: any) => a + (typeof b === "number" ? b : b.v * b.m),
              0,
            );
            let turnDarts = turn.reduce(
              (a: any, b: any) =>
                a + (typeof b === "number" ? 1 : b.d !== undefined ? b.d : 1),
              0,
            );
            if (isBuggyCompressed) {
              turnDarts = 3;
            }
            darts += turnDarts;
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
            coords: [],
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
          const sumOfLengths = p.allTurns.reduce(
            (acc: number, t: any[]) => acc + t.length,
            0,
          );
          const isBuggyCompressed =
            p.totalMatchDarts &&
            p.totalMatchDarts > sumOfLengths &&
            !p.allTurns.some((t: any[]) =>
              t.some((d: any) => d.d !== undefined),
            );

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

            s.totalPoints += turnSum;
            s.totalDarts += turnDarts;
            if (index < 3) {
              s.first9Points += turnSum;
              s.first9Count += turnDarts;
            }
            if (turnSum >= 180) s.s180++;
            else if (turnSum >= 140) s.s140++;
            else if (turnSum >= 100) s.s100++;
            else if (turnSum >= 60) s.s60++;
            turn.forEach((dart) => {
              const isScoreInput = dart.i === true || isBuggyCompressed;
              if (isScoreInput) return;
              if (dart.c) s.coords.push(dart.c);

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

    return Object.values(playerMap).map((s: any) => ({
      ...s,
      winPct: s.mPlayed > 0 ? (s.mWon / s.mPlayed) * 100 : 0,
      calculatedAvg: s.totalDarts > 0 ? (s.totalPoints / s.totalDarts) * 3 : 0,
      calculatedFirst9:
        s.first9Count > 0 ? (s.first9Points / s.first9Count) * 3 : 0,
      calculatedCheckoutPct:
        s.checkoutDarts > 0 ? (s.checkoutHits / s.checkoutDarts) * 100 : 0,
    }));
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
          theme={theme}
          language={language}
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

  const allHistoryPlayers = useMemo(() => {
    return Array.from(
      new Set(history.flatMap((m) => m.players.map((p: any) => p.name))),
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
    <GestureHandlerRootView style={styles.container}>
      <AnimatedSegmentedControl
        theme={theme}
        activeOption={timeFilter}
        onSelect={setTimeFilter}
        style={styles.segmentContainer}
        options={(["today", "7d", "30d", "all"] as TimeFilter[]).map((f) => ({
          id: f,
          label:
            f === "today"
              ? t(language, "today") || "Today"
              : f === "7d"
                ? t(language, "week") || "7 days"
                : f === "30d"
                  ? t(language, "month") || "30 days"
                  : t(language, "all") || "All time",
        }))}
      />
      <DraggableFlatList
        data={sections}
        onDragEnd={({ data }) => saveSectionsOrder(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        activationDistance={15}
      />

      <SelectPlayersModal
        visible={showPlayerFilter}
        title={t(language, "selectPlayers") || "Select players"}
        players={filteredHistoryPlayers}
        selectedPlayers={tempNames}
        onTogglePlayer={(item: string) =>
          setTempNames((prev) =>
            prev.includes(item)
              ? prev.filter((n) => n !== item)
              : [...prev, item],
          )
        }
        onClose={() => {
          setShowPlayerFilter(false);
          setFilterSearchQuery("");
        }}
        onConfirm={() => {
          setAppliedNames(tempNames);
          setShowPlayerFilter(false);
          setFilterSearchQuery("");
        }}
        confirmText={t(language, "setFilters") || "Set filters"}
        confirmColor={theme.colors.primary}
        showSearch={true}
        searchQuery={filterSearchQuery}
        onSearchChange={setFilterSearchQuery}
        showSelectAll={true}
        allSelected={allSelected}
        onSelectAll={() =>
          setTempNames(
            Array.from(new Set([...tempNames, ...filteredHistoryPlayers])),
          )
        }
        onDeselectAll={() =>
          setTempNames(
            tempNames.filter((n) => !filteredHistoryPlayers.includes(n)),
          )
        }
        theme={theme}
        language={language}
      />

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
            {(() => {
              const playerStats = stats.find(
                (s: any) => s.name === selectedSharePlayer,
              );
              return (
                <ShareCard
                  playerName={selectedSharePlayer}
                  subtitle={`${t(language, "sharePlayerStats") || "PLAYER STATS"} • X01`}
                  topRightBox={{
                    label: t(language, "shareDartsThrown") || "DARTS THROWN",
                    value: playerStats?.totalDarts?.toString() || "0",
                  }}
                  boxes={[
                    {
                      label: t(language, "shareGamesWon") || "GAMES / WON",
                      value: `${playerStats?.mPlayed || 0} / ${playerStats?.mWon || 0} (${playerStats?.winPct?.toFixed(0) || 0}%)`,
                    },
                    {
                      label: t(language, "shareFirst9Avg") || "FIRST 9 / AVG",
                      value: `${playerStats?.calculatedFirst9?.toFixed(1) || "0.0"} / ${playerStats?.calculatedAvg?.toFixed(1) || "0.0"}`,
                    },
                    {
                      label:
                        t(language, "shareGameDartsHit") ||
                        "GAME DARTS / HIT %",
                      value: `${playerStats?.checkoutDarts || 0} / ${playerStats?.calculatedCheckoutPct?.toFixed(1) || "0.0"}%`,
                    },
                    {
                      label: t(language, "shareScoring") || "100+ / 140+ / 180",
                      value: `${playerStats?.s100 || 0} / ${playerStats?.s140 || 0} / ${playerStats?.s180 || 0}`,
                    },
                  ]}
                  trendData={trendData[selectedSharePlayer as string]}
                  theme={theme}
                  language={language}
                  footerText={`${t(language, "shareGeneratedOn") || "Generated on"} ${new Date().toLocaleDateString()}`}
                />
              );
            })()}
          </ViewShot>
        </View>
      )}
    </GestureHandlerRootView>
  );
}
