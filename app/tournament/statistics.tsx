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
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { useLanguage } from "../../context/LanguageContext";
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
  getTournamentStatisticsAsync,
  calculateTournamentTrendData,
  Tournament,
  AggregatedStats,
  PlayerMatchStats,
} from "../../lib/statsUtils";

const TOURNAMENT_HISTORY_KEY = "@tournament_history";
const SECTIONS_KEY = "@dart_tourney_stats_sections_order";
const OPEN_SECTIONS_KEY = "@dart_tourney_stats_sections_open";

type Section = { id: string };
type EntityType = "single" | "team";
type TimeFilter = "today" | "7d" | "30d" | "all";

export default function TournamentStatistics() {
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStatisticsStyles(theme);

  const [history, setHistory] = useState<Tournament[]>([]);
  const [stats, setStats] = useState<AggregatedStats[]>([]);
  const [appliedNames, setAppliedNames] = useState<string[]>([]);
  const [tempNames, setTempNames] = useState<string[]>([]);

  const [showPlayerFilter, setShowPlayerFilter] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSharePlayer, setSelectedSharePlayer] = useState<string | null>(
    null,
  );
  const [entityType, setEntityType] = useState<EntityType>("single");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");

  const viewShotRef = useRef<ViewShot>(null);

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
      setTimeFilter("today");
      AsyncStorage.getItem(TOURNAMENT_HISTORY_KEY).then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved);
          setHistory(parsed);
        }
      });
    }, []),
  );

  const allHistoryPlayers = useMemo(() => {
    const filtered = history.filter((t: Tournament) =>
      entityType === "team"
        ? t.settings?.teamSize === "team"
        : t.settings?.teamSize !== "team",
    );
    const map = new Map();
    filtered.forEach((t: Tournament) => {
      t.players?.forEach((p: PlayerMatchStats) => {
        if (!map.has(p.name)) {
          map.set(p.name, {
            name: p.name,
            subtitle: p.isTeam && p.members ? p.members.join(" & ") : undefined,
            searchStr:
              p.isTeam && p.members ? p.members.join(" ").toLowerCase() : "",
          });
        }
      });
    });
    return Array.from(map.values());
  }, [history, entityType]);

  useEffect(() => {
    const names = allHistoryPlayers.map((p) => p.name);
    setAppliedNames(names);
    setTempNames(names);
  }, [entityType, allHistoryPlayers]);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      const result = await getTournamentStatisticsAsync(
        history,
        appliedNames,
        timeFilter,
        entityType,
      );
      if (isMounted) {
        setStats(result);
      }
    };
    loadStats();
    return () => {
      isMounted = false;
    };
  }, [history, appliedNames, timeFilter, entityType]);

  const trendData = useMemo(() => {
    return calculateTournamentTrendData(history, appliedNames, entityType);
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
          theme={theme}
          language={language}
        />
      );
    },
    [stats, openSections, appliedNames, trendData, theme, language],
  );

  const filteredHistoryPlayers = useMemo(() => {
    const q = filterSearchQuery.toLowerCase();
    return allHistoryPlayers
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.searchStr && p.searchStr.includes(q)),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, language === "pl" ? "pl" : "en"),
      );
  }, [allHistoryPlayers, filterSearchQuery, language]);

  const allSelected =
    filteredHistoryPlayers.length > 0 &&
    filteredHistoryPlayers.every((p) => tempNames.includes(p.name));

  return (
    <GestureHandlerRootView
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>
          {t(language, "tournamentStatistics") || "Tournament Stats"}
        </Text>
        <View style={styles.headerRight}>
          <AnimatedPressable
            onPress={() => setShowShareModal(true)}
            style={styles.headerBtn}
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
            style={styles.headerBtn}
          >
            <Ionicons name="filter" size={24} color={theme.colors.primary} />
          </AnimatedPressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <AnimatedSegmentedControl
          theme={theme}
          activeOption={entityType}
          onSelect={(val) => setEntityType(val as EntityType)}
          style={styles.segmentContainer}
          options={[
            { id: "single", label: t(language, "players") || "Players" },
            { id: "team", label: t(language, "teams") || "Teams" },
          ]}
        />
        <AnimatedSegmentedControl
          theme={theme}
          activeOption={timeFilter}
          onSelect={(val) => setTimeFilter(val as TimeFilter)}
          style={[styles.segmentContainer, { marginTop: 12 }]}
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
      </View>

      <View style={{ flex: 1 }}>
        <DraggableFlatList
          data={sections}
          onDragEnd={({ data }) => saveSectionsOrder(data)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 40 + insets.bottom,
          }}
          activationDistance={15}
        />
      </View>

      <SelectPlayersModal
        visible={showPlayerFilter}
        title={
          entityType === "team"
            ? t(language, "selectTeamsTitle") || "Select teams"
            : t(language, "selectPlayers") || "Select players"
        }
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
        searchPlaceholder={
          entityType === "team"
            ? t(language, "searchTeamOrPlayer") || "Search team / player..."
            : t(language, "searchPlayer") || "Search player..."
        }
        countLabel={
          entityType === "team"
            ? t(language, "teamsCount") || "teams"
            : t(language, "playersShort") || "players"
        }
        onSelectAll={() =>
          setTempNames(
            Array.from(
              new Set([
                ...tempNames,
                ...filteredHistoryPlayers.map((p) => p.name),
              ]),
            ),
          )
        }
        onDeselectAll={() =>
          setTempNames(
            tempNames.filter(
              (n) => !filteredHistoryPlayers.find((p) => p.name === n),
            ),
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
              {t(language, "shareStatsTitle") || "Share Stats"}
            </Text>
            <FlatList
              style={{ flexShrink: 1 }}
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
            {(() => {
              const playerStats = stats.find(
                (s: AggregatedStats) => s.name === selectedSharePlayer,
              );
              return (
                <ShareCard
                  playerName={selectedSharePlayer}
                  subtitle={`${t(language, "sharePlayerStats") || "PLAYER STATS"} • TOURNAMENTS`}
                  topRightBox={{
                    label:
                      t(language, "shareMatchesPlayed") || "MATCHES PLAYED",
                    value: playerStats?.mPlayed?.toString() || "0",
                  }}
                  boxes={[
                    {
                      label:
                        t(language, "shareTournaments") ||
                        "TOURNAMENTS (1st / 2nd)",
                      value: `${playerStats?.tPlayed || 0} (${playerStats?.t1st || 0} / ${playerStats?.t2nd || 0})`,
                    },
                    {
                      label: t(language, "shareGamesWon") || "MATCHES / WON",
                      value: `${playerStats?.mPlayed || 0} / ${playerStats?.mWon || 0} (${playerStats?.winPct?.toFixed(0) || 0}%)`,
                    },
                    {
                      label: t(language, "shareFirst9Avg") || "FIRST 9 / AVG",
                      value: `${playerStats?.calculatedFirst9?.toFixed(1) || "0.0"} / ${playerStats?.calculatedAvg?.toFixed(1) || "0.0"}`,
                    },
                    {
                      label:
                        t(language, "shareCheckoutsHit") || "CHECKOUTS / HIT %",
                      value: `${playerStats?.checkoutHits || 0} / ${playerStats?.calculatedCheckoutPct?.toFixed(1) || "0.0"}%`,
                    },
                    {
                      label: t(language, "shareScoring") || "100+ / 140+ / 180",
                      value: `${playerStats?.s100 || 0} / ${playerStats?.s140 || 0} / ${playerStats?.s180 || 0}`,
                      fullWidth: true,
                    },
                  ]}
                  trendData={trendData[selectedSharePlayer as string]}
                  theme={theme}
                  language={language}
                />
              );
            })()}
          </ViewShot>
        </View>
      )}
    </GestureHandlerRootView>
  );
}
