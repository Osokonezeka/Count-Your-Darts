import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { ScaleDecorator } from "react-native-draggable-flatlist";
import Svg, { Circle, Line } from "react-native-svg";
import { getStatisticsStyles } from "./StatisticsStyles";
import { t } from "../../lib/i18n";

export const ShareStatBox = ({ label, value, theme, fullWidth }: any) => (
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

export const ShareCard = ({
  playerName,
  subtitle,
  topRightBox,
  boxes,
  trendData,
  theme,
  language,
  footerText,
}: any) => {
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
        {boxes.map((box: any, idx: number) => (
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

export const TrendCard = ({
  data,
  theme,
  language,
  isOpen,
  onToggle,
  drag,
}: any) => {
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

export const HeatmapBoard = ({ coords, theme, size = 280 }: any) => {
  const cx = size / 2;
  const cy = size / 2;
  const rDoubleOut = 0.82 * cx;
  const rDoubleIn = 0.74 * cx;
  const rTripleOut = 0.48 * cx;
  const rTripleIn = 0.4 * cx;
  const rOuterBull = 0.1 * cx;
  const rInnerBull = 0.05 * cx;

  const lines = Array.from({ length: 20 }, (_, i) => {
    const angle = (i * 18 - 9) * (Math.PI / 180);
    return {
      x: cx + rDoubleOut * Math.sin(angle),
      y: cy - rDoubleOut * Math.cos(angle),
    };
  });

  const gridSize = 40;
  const cellSize = size / gridSize;
  const grid = new Map<string, number>();
  let maxCount = 0;

  if (coords && Array.isArray(coords)) {
    coords.forEach((c: any) => {
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

  const heatmapDots = Array.from(grid.entries()).map(([key, count]) => {
    const [gx, gy] = key.split(",").map(Number);
    const opacity = maxCount > 0 ? 0.15 + 0.85 * (count / maxCount) : 0;

    return (
      <Circle
        key={key}
        cx={gx * cellSize + cellSize / 2}
        cy={gy * cellSize + cellSize / 2}
        r={cellSize * 0.8}
        fill={theme.colors.primary}
        opacity={opacity}
      />
    );
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#1a1a1a",
        overflow: "hidden",
        alignSelf: "center",
        marginVertical: 10,
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={rDoubleOut}
          stroke="#444"
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rDoubleIn}
          stroke="#444"
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rTripleOut}
          stroke="#444"
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rTripleIn}
          stroke="#444"
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rOuterBull}
          stroke="#444"
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={rInnerBull}
          stroke="#444"
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
            stroke="#444"
            strokeWidth="1"
          />
        ))}
        {heatmapDots}
      </Svg>
    </View>
  );
};

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
  }: any) => {
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
        case "hit_chart":
          return t(language, "sectorsHeader") || "Targets hitted (S / D / T)";
        case "heatmap":
          return t(language, "heatmap") || "Heatmap";
        default:
          return id;
      }
    };

    const sortedStats = useMemo(() => {
      if (!sortConfig || item.id === "hit_chart") return stats;
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
            valA = a.winPct;
            valB = b.winPct;
            break;
          case "avg":
            valA = a.calculatedAvg;
            valB = b.calculatedAvg;
            break;
          case "first9":
            valA = a.calculatedFirst9;
            valB = b.calculatedFirst9;
            break;
          case "checkoutDarts":
            valA = a.checkoutDarts;
            valB = b.checkoutDarts;
            break;
          case "checkoutPct":
            valA = a.calculatedCheckoutPct;
            valB = b.calculatedCheckoutPct;
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
    }, [stats, sortConfig, item.id]);

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
                        <Text style={styles.cell}>{s.winPct.toFixed(0)}%</Text>
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
                          {s.calculatedFirst9.toFixed(1)}
                        </Text>
                        <Text
                          style={[
                            styles.cell,
                            { color: theme.colors.success, fontWeight: "bold" },
                          ]}
                        >
                          {s.calculatedAvg.toFixed(1)}
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
                        <Text style={styles.cell}>{s.checkoutDarts}</Text>
                        <Text
                          style={[styles.cell, { color: theme.colors.success }]}
                        >
                          {s.calculatedCheckoutPct.toFixed(1)}%
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
                          s.hits &&
                          (s.hits[t]?.S > 0 ||
                            s.hits[t]?.D > 0 ||
                            s.hits[t]?.T > 0),
                      );
                      if (!hasHits) return null;
                      const isCollapsed =
                        collapsedPlayers && collapsedPlayers[s.name];
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
                                <SortableHeader
                                  label={tripleTerm || "Triple"}
                                  colKey="T"
                                />
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
                    {stats.map((s: any) => {
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
