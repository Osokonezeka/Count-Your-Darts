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

const TOURNAMENT_HISTORY_KEY = "@tournament_history";
const SECTIONS_KEY = "@dart_tourney_stats_sections_order";
const OPEN_SECTIONS_KEY = "@dart_tourney_stats_sections_open";

type Section = { id: string };
type TimeFilter = "today" | "7d" | "30d" | "all";

export default function TournamentStatistics() {
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
            totalDarts: 0,
            first9Points: 0,
            first9Count: 0,
            s60: 0,
            s100: 0,
            s140: 0,
            s180: 0,
            checkoutHits: 0,
            checkoutDarts: 0,
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
              playerMap[p1Name].checkoutHits += parseInt(p1Match[1], 10);
              playerMap[p1Name].checkoutDarts += parseInt(p1Match[2], 10);
            }
          }
          if (p2Name && appliedNames.includes(p2Name) && coStat.p2) {
            const p2Match = String(coStat.p2).match(/\((\d+)\/(\d+)\)/);
            if (p2Match) {
              playerMap[p2Name].checkoutHits += parseInt(p2Match[1], 10);
              playerMap[p2Name].checkoutDarts += parseInt(p2Match[2], 10);
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
                playerMap[name].totalDarts++;
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

    return Object.values(playerMap).map((s: any) => ({
      ...s,
      winPct: s.mPlayed > 0 ? (s.mWon / s.mPlayed) * 100 : 0,
      calculatedAvg: s.totalDarts > 0 ? s.totalPoints / s.totalDarts : 0,
      calculatedFirst9: s.first9Count > 0 ? s.first9Points / s.first9Count : 0,
      calculatedCheckoutPct:
        s.checkoutDarts > 0 ? (s.checkoutHits / s.checkoutDarts) * 100 : 0,
    }));
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
          theme={theme}
          language={language}
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
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 160 + insets.bottom,
        }}
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
            {(() => {
              const playerStats = stats.find(
                (s: any) => s.name === selectedSharePlayer,
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
