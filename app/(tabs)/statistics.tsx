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
import {
  getOverallStatisticsAsync,
  calculateTrendData,
  isBot,
  Match,
  AggregatedStats,
} from "../../lib/statsUtils";

const HISTORY_KEY = "@dart_match_history";
const SECTIONS_KEY = "@dart_stats_sections_order";
const OPEN_SECTIONS_KEY = "@dart_stats_sections_open";
const COLLAPSED_PLAYERS_KEY = "@dart_stats_collapsed_players";

type Section = { id: string };
type TimeFilter = "today" | "7d" | "30d" | "all";

export default function Statistics() {
  const { tripleTerm, missTerm, bullTerm } = useTerminology();
  const { language } = useLanguage();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStatisticsStyles(theme);

  const [history, setHistory] = useState<Match[]>([]);
  const [stats, setStats] = useState<AggregatedStats[]>([]);
  const [appliedNames, setAppliedNames] = useState<string[]>([]);
  const [tempNames, setTempNames] = useState<string[]>([]);
  const [showPlayerFilter, setShowPlayerFilter] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSharePlayer, setSelectedSharePlayer] = useState<string | null>(
    null,
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");

  const viewShotRef = useRef<ViewShot>(null);

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

  const togglePlayerCollapse = useCallback((key: string) => {
    setCollapsedPlayers((prev) => {
      const newState = { ...prev, [key]: !prev[key] };
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
              parsed.flatMap((m: Match) => m.players?.map((p) => p.name) || []),
            ),
          ) as string[];
          const humanNames = allNames.filter((name) => !isBot(name));
          setAppliedNames((prev) => (prev.length === 0 ? humanNames : prev));
        }
      });
    }, []),
  );

  const trendData = useMemo(() => {
    return calculateTrendData(history, appliedNames);
  }, [history, appliedNames]);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      const result = await getOverallStatisticsAsync(
        history,
        appliedNames,
        timeFilter,
      );
      if (isMounted) {
        setStats(result);
      }
    };
    loadStats();
    return () => {
      isMounted = false;
    };
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
    const allNames = Array.from(
      new Set(history.flatMap((m) => m.players?.map((p) => p.name) || [])),
    ) as string[];
    return allNames.filter((name) => !isBot(name));
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
        onSelect={(val) => setTimeFilter(val as TimeFilter)}
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
      <View style={{ flex: 1 }}>
        <DraggableFlatList
          data={sections}
          onDragEnd={({ data }) => saveSectionsOrder(data)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          activationDistance={15}
        />
      </View>

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
              data={stats.map((s: AggregatedStats) => s.name)}
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
                (s: AggregatedStats) => s.name === selectedSharePlayer,
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
