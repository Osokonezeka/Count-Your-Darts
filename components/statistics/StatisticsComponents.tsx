import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { ScaleDecorator } from "react-native-draggable-flatlist";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { AggregatedStats } from "../../lib/statsUtils";
import { getStatisticsStyles } from "./StatisticsStyles";

const DEFAULT_TARGETS = [
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 25, 0,
];

interface ShareStatBoxProps {
  label: string;
  value: string | number;
  theme: { colors: Record<string, string> };
  fullWidth?: boolean;
}

export const ShareStatBox = ({
  label,
  value,
  theme,
  fullWidth,
}: ShareStatBoxProps) => (
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

interface ShareCardProps {
  playerName: string;
  subtitle: string;
  topRightBox: { label: string; value: string | number };
  boxes: { label: string; value: string | number; fullWidth?: boolean }[];
  trendData?: { labels: string[]; datasets: { data: number[] }[] };
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
  footerText?: string;
}

export const ShareCard = ({
  playerName,
  subtitle,
  topRightBox,
  boxes,
  trendData,
  theme,
  language,
  footerText,
}: ShareCardProps) => {
  if (!playerName)
    return (
      <View
        style={{
          width: 400,
          height: 400,
          backgroundColor: theme.colors.background,
        }}
      />
    );

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
            {subtitle}
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
          label={topRightBox.label}
          value={topRightBox.value}
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
        {boxes.map((box, idx: number) => (
          <ShareStatBox
            key={idx}
            label={box.label}
            value={box.value}
            theme={theme}
            fullWidth={box.fullWidth}
          />
        ))}
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
              {t(language, "shareAvgLast10") || "AVERAGE OVER LAST 10"}
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
        {footerText && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: theme.colors.textMuted,
              marginTop: 4,
            }}
          >
            {footerText}
          </Text>
        )}
      </View>
    </View>
  );
};

interface TrendCardProps {
  data: Record<string, { labels: string[]; datasets: { data: number[] }[] }>;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
  isOpen: boolean;
  onToggle: () => void;
  drag?: () => void;
}

export const TrendCard = ({
  data,
  theme,
  language,
  isOpen,
  onToggle,
  drag,
}: TrendCardProps) => {
  const styles = getStatisticsStyles(theme);
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
                {t(language, "averageTrend") || "Average Trend"}
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
                  {t(language, "insufficientDataTrend") || "Not enough data"}
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

interface HeatmapBoardProps {
  coords: { x: number; y: number }[];
  theme: { colors: Record<string, string> };
  size?: number;
}

export const HeatmapBoard = ({
  coords,
  theme,
  size = 280,
}: HeatmapBoardProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const rDoubleOut = 0.82 * cx;
  const rDoubleIn = 0.74 * cx;
  const rTripleOut = 0.48 * cx;
  const rTripleIn = 0.4 * cx;
  const rOuterBull = 0.1 * cx;
  const rInnerBull = 0.05 * cx;

  const { themeMode } = useTheme();
  const systemColorScheme = useColorScheme();
  const isLightTheme =
    (themeMode === "auto" ? systemColorScheme : themeMode) !== "dark";

  const lines = Array.from({ length: 20 }, (_, i) => {
    const angle = (i * 18 - 9) * (Math.PI / 180);
    return {
      x: cx + rDoubleOut * Math.sin(angle),
      y: cy - rDoubleOut * Math.cos(angle),
    };
  });

  const heatmapDots = useMemo(() => {
    const gridSize = 40;
    const cellSize = size / gridSize;
    const grid = new Map<string, number>();
    let maxCount = 0;

    if (coords && Array.isArray(coords)) {
      coords.forEach((c) => {
        const gridX = Math.floor(((c.x + 1) / 2) * gridSize);
        const gridY = Math.floor(((c.y + 1) / 2) * gridSize);

        const safeX = Math.max(0, Math.min(gridSize - 1, gridX));
        const safeY = Math.max(0, Math.min(gridSize - 1, gridY));

        const key = `${safeX},${safeY}`;
        const count = (grid.get(key) || 0) + 1;
        grid.set(key, count);
        if (count > maxCount) maxCount = count;
      });
    }

    return Array.from(grid.entries()).map(([key, count]) => {
      const [gx, gy] = key.split(",").map(Number);
      const opacity = maxCount > 0 ? 0.1 + 0.7 * (count / maxCount) : 0;

      return (
        <Circle
          key={key}
          cx={gx * cellSize + cellSize / 2}
          cy={gy * cellSize + cellSize / 2}
          r={cellSize * 0.7}
          fill="url(#heatGrad)"
          opacity={opacity}
        />
      );
    });
  }, [coords, size]);

  const bgColor = isLightTheme ? "#f0ebd870" : "#1a1a1a";
  const strokeColor = isLightTheme ? "#d0c9b4" : "#444";

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        overflow: "hidden",
        alignSelf: "center",
        marginVertical: 10,
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="heatGrad" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop
              offset="0%"
              stopColor={theme.colors.primary}
              stopOpacity="0.8"
            />
            <Stop
              offset="100%"
              stopColor={theme.colors.primary}
              stopOpacity="0"
            />
          </RadialGradient>
        </Defs>
        <Circle
          cx={cx}
          cy={cy}
          r={rDoubleOut}
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rDoubleIn}
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rTripleOut}
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rTripleIn}
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rOuterBull}
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rInnerBull}
          stroke={strokeColor}
          strokeWidth="1"
          fill="none"
        />
        {lines.map((l, i) => (
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={l.x}
            y2={l.y}
            stroke={strokeColor}
            strokeWidth="1"
          />
        ))}
        <G pointerEvents="none">{heatmapDots}</G>
      </Svg>
    </View>
  );
};

interface StatCardProps {
  item: { id: string; title?: string };
  drag?: () => void;
  stats: AggregatedStats[];
  isOpen: boolean;
  onToggle: () => void;
  noPlayersSelected?: boolean;
  collapsedPlayers?: Record<string, boolean>;
  onTogglePlayer?: (key: string) => void;
  tripleTerm?: string;
  missTerm?: string;
  bullTerm?: string;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
}

export const StatCard = React.memo(
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
    theme,
    language,
  }: StatCardProps) => {
    const [sortConfig, setSortConfig] = useState<{
      col: string;
      asc: boolean;
    } | null>(null);
    const styles = getStatisticsStyles(theme);
    const handleSort = (col: string) => {
      if (sortConfig?.col === col) {
        if (!sortConfig.asc) setSortConfig({ col, asc: true });
        else setSortConfig(null);
      } else setSortConfig({ col, asc: false });
    };

    const translatedTitles: Record<string, string> = {
      tournaments:
        t(language, "tournamentsHeader") || "Tournaments (Played / 1st / 2nd)",
      games: t(language, "gamesWonHeader") || "Matches / Won / %",
      performance: t(language, "avgHeader") || "First 9 / Average",
      checkouts: t(language, "gameDartsHeader") || "Checkouts / Hit %",
      scoring:
        t(language, "scoringHeader") || "Scoring (60+ / 100+ / 140+ / 180)",
      hit_chart: t(language, "sectorsHeader") || "Targets hitted (S / D / T)",
      heatmap: t(language, "heatmap") || "Heatmap",
    };
    const title = translatedTitles[item.id] || item.id;

    type ColumnDef = {
      key: string;
      label: string;
      isName?: boolean;
      render: (s: AggregatedStats) => React.ReactNode;
    };

    const tableColumns: Record<string, ColumnDef[]> = {
      tournaments: [
        {
          key: "name",
          label: t(language, "player") || "Player",
          isName: true,
          render: (s) => <Text style={styles.cellName}>{s.name}</Text>,
        },
        {
          key: "tPlayed",
          label: t(language, "playedShort") || "Played",
          render: (s) => <Text style={styles.cell}>{s.tPlayed}</Text>,
        },
        {
          key: "t1st",
          label: t(language, "firstPlaceShort") || "1st",
          render: (s) => (
            <Text
              style={[
                styles.cell,
                { color: theme.colors.warning, fontWeight: "900" },
              ]}
            >
              {s.t1st}
            </Text>
          ),
        },
        {
          key: "t2nd",
          label: t(language, "secondPlaceShort") || "2nd",
          render: (s) => (
            <Text
              style={[
                styles.cell,
                { color: theme.colors.textMuted, fontWeight: "700" },
              ]}
            >
              {s.t2nd}
            </Text>
          ),
        },
      ],
      games: [
        {
          key: "name",
          label: t(language, "player") || "Player",
          isName: true,
          render: (s) => <Text style={styles.cellName}>{s.name}</Text>,
        },
        {
          key: "mPlayed",
          label: t(language, "matches") || "Matches",
          render: (s) => <Text style={styles.cell}>{s.mPlayed}</Text>,
        },
        {
          key: "mWon",
          label: t(language, "winsShort") || "W",
          render: (s) => (
            <Text style={[styles.cell, { color: theme.colors.success }]}>
              {s.mWon}
            </Text>
          ),
        },
        {
          key: "winPct",
          label: t(language, "winPctShort") || "W %",
          render: (s) => (
            <Text style={styles.cell}>{(s.winPct || 0).toFixed(0)}%</Text>
          ),
        },
      ],
      performance: [
        {
          key: "name",
          label: t(language, "player") || "Player",
          isName: true,
          render: (s) => <Text style={styles.cellName}>{s.name}</Text>,
        },
        {
          key: "first9",
          label: t(language, "firstNine") || "First 9",
          render: (s) => (
            <Text style={styles.cell}>
              {(s.calculatedFirst9 || 0).toFixed(1)}
            </Text>
          ),
        },
        {
          key: "avg",
          label: t(language, "average") || "Average",
          render: (s) => (
            <Text
              style={[
                styles.cell,
                { color: theme.colors.success, fontWeight: "bold" },
              ]}
            >
              {(s.calculatedAvg || 0).toFixed(1)}
            </Text>
          ),
        },
      ],
      checkouts: [
        {
          key: "name",
          label: t(language, "player") || "Player",
          isName: true,
          render: (s) => <Text style={styles.cellName}>{s.name}</Text>,
        },
        {
          key: "checkoutDarts",
          label: t(language, "attemptsShort") || "Att",
          render: (s) => <Text style={styles.cell}>{s.checkoutDarts}</Text>,
        },
        {
          key: "checkoutPct",
          label: t(language, "hitPercent") || "Hit %",
          render: (s) => (
            <Text style={[styles.cell, { color: theme.colors.success }]}>
              {(s.calculatedCheckoutPct || 0).toFixed(1)}%
            </Text>
          ),
        },
      ],
      scoring: [
        {
          key: "name",
          label: t(language, "player") || "Player",
          isName: true,
          render: (s) => <Text style={styles.cellName}>{s.name}</Text>,
        },
        {
          key: "s60",
          label: "60+",
          render: (s) => <Text style={styles.cell}>{s.s60}</Text>,
        },
        {
          key: "s100",
          label: "100+",
          render: (s) => <Text style={styles.cell}>{s.s100}</Text>,
        },
        {
          key: "s140",
          label: "140+",
          render: (s) => <Text style={styles.cell}>{s.s140}</Text>,
        },
        {
          key: "s180",
          label: "180",
          render: (s) => (
            <Text
              style={[
                styles.cell,
                { color: theme.colors.success, fontWeight: "bold" },
              ]}
            >
              {s.s180}
            </Text>
          ),
        },
      ],
    };

    const sortedStats = useMemo(() => {
      if (!sortConfig || item.id === "hit_chart") return stats;
      return [...stats].sort((a, b) => {
        const keyMap: Record<string, keyof AggregatedStats> = {
          avg: "calculatedAvg",
          first9: "calculatedFirst9",
          checkoutPct: "calculatedCheckoutPct",
        };

        const actualKey =
          keyMap[sortConfig.col] || (sortConfig.col as keyof AggregatedStats);
        const valA = a[actualKey] ?? 0;
        const valB = b[actualKey] ?? 0;

        if (valA === valB) return 0;
        if (typeof valA === "string" && typeof valB === "string") {
          const cmp = valA.localeCompare(valB, undefined, {
            sensitivity: "base",
          });
          return sortConfig.asc ? cmp : -cmp;
        }
        return sortConfig.asc
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
    }, [stats, sortConfig, item.id]);

    const renderSortableHeader = (
      label: string,
      colKey: string,
      isName = false,
    ) => (
      <Pressable
        key={colKey}
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
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.colors.textMuted}
              />
            </Pressable>

            {isOpen && (
              <View style={styles.table}>
                {tableColumns[item.id] && (
                  <>
                    <View style={styles.rowHeader}>
                      {tableColumns[item.id].map((c) =>
                        renderSortableHeader(c.label, c.key, c.isName),
                      )}
                    </View>
                    {sortedStats.map((s: AggregatedStats) => (
                      <View key={s.name} style={styles.row}>
                        {tableColumns[item.id].map((c) => (
                          <React.Fragment key={c.key}>
                            {c.render(s)}
                          </React.Fragment>
                        ))}
                      </View>
                    ))}
                  </>
                )}
                {item.id === "hit_chart" && (
                  <View style={{ paddingTop: 10 }}>
                    {sortedStats.map((s: AggregatedStats) => {
                      const hasHits = DEFAULT_TARGETS.some(
                        (t) =>
                          s.hits &&
                          (s.hits[t]?.S > 0 ||
                            s.hits[t]?.D > 0 ||
                            s.hits[t]?.T > 0),
                      );
                      if (!hasHits) return null;
                      const isCollapsed =
                        collapsedPlayers &&
                        collapsedPlayers[`${item.id}_${s.name}`];
                      let targets = [...DEFAULT_TARGETS];
                      if (sortConfig && !isCollapsed) {
                        targets.sort((a, b) => {
                          const colKey = sortConfig.col as "S" | "D" | "T";
                          const hitsA = s.hits[a]?.[colKey] || 0;
                          const hitsB = s.hits[b]?.[colKey] || 0;
                          if (hitsA === hitsB)
                            return (
                              DEFAULT_TARGETS.indexOf(a) -
                              DEFAULT_TARGETS.indexOf(b)
                            );
                          return sortConfig.asc ? hitsA - hitsB : hitsB - hitsA;
                        });
                      }
                      return (
                        <View key={s.name} style={{ marginBottom: 20 }}>
                          <Pressable
                            style={styles.hitPlayerHeader}
                            onPress={() =>
                              onTogglePlayer &&
                              onTogglePlayer(`${item.id}_${s.name}`)
                            }
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
                                  <Text style={styles.colText}>
                                    {t(language, "target") || "Target"}
                                  </Text>
                                </View>
                                {renderSortableHeader(
                                  t(language, "single") || "Single",
                                  "S",
                                )}
                                {renderSortableHeader(
                                  t(language, "double") || "Double",
                                  "D",
                                )}
                                {renderSortableHeader(
                                  tripleTerm || "Triple",
                                  "T",
                                )}
                              </View>
                              {targets.map((target: number) => {
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
                    {stats.map((s: AggregatedStats) => {
                      if (!s.coords || s.coords.length === 0) return null;
                      const isCollapsed =
                        collapsedPlayers &&
                        collapsedPlayers[`${item.id}_${s.name}`];
                      return (
                        <View key={s.name} style={{ marginBottom: 20 }}>
                          <Pressable
                            style={styles.hitPlayerHeader}
                            onPress={() =>
                              onTogglePlayer &&
                              onTogglePlayer(`${item.id}_${s.name}`)
                            }
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
                {stats.length === 0 && (
                  <Text style={styles.emptyText}>
                    {noPlayersSelected
                      ? t(language, "noPlayersSelected") ||
                        "No players selected"
                      : t(language, "noData") ||
                        "No data is available for this period"}
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
