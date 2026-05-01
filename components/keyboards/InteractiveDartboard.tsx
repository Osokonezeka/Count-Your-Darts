import React, { useState, useCallback, memo } from "react";
import {
  View,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import Svg, { Path, Circle, G, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import { t } from "../../lib/i18n";

const SECTORS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const StaticBoardBackground = memo(({ cx, cy, onSectorPress }: any) => {
  const rDoubleOut = 0.82;
  const rDoubleIn = 0.74;
  const rOuterSingleIn = 0.48;
  const rTripleIn = 0.4;
  const rOuterBull = 0.1;
  const rInnerBull = 0.05;

  const createWedge = (rInnerPct: number, rOuterPct: number) => {
    const rInner = rInnerPct * cx;
    const rOuter = rOuterPct * cx;
    const a1 = (-9 * Math.PI) / 180;
    const a2 = (9 * Math.PI) / 180;

    const x1_in = cx + rInner * Math.sin(a1);
    const y1_in = cy - rInner * Math.cos(a1);
    const x2_in = cx + rInner * Math.sin(a2);
    const y2_in = cy - rInner * Math.cos(a2);

    const x1_out = cx + rOuter * Math.sin(a1);
    const y1_out = cy - rOuter * Math.cos(a1);
    const x2_out = cx + rOuter * Math.sin(a2);
    const y2_out = cy - rOuter * Math.cos(a2);

    return `M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${rOuter} ${rOuter} 0 0 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${rInner} ${rInner} 0 0 0 ${x1_in} ${y1_in} Z`;
  };

  const pathDouble = createWedge(rDoubleIn, rDoubleOut);
  const pathOuterSingle = createWedge(rOuterSingleIn, rDoubleIn);
  const pathTriple = createWedge(rTripleIn, rOuterSingleIn);
  const pathInnerSingle = createWedge(rOuterBull, rTripleIn);

  const colorBlack = "#121212";
  const colorWhite = "#f0ebd8";
  const colorRed = "#e63946";
  const colorGreen = "#2a9d8f";

  return (
    <>
      <Circle
        cx={cx}
        cy={cy}
        r={cx}
        fill="#1a1a1a"
        onPress={(e) => onSectorPress(e, 0, 1)}
      />

      {SECTORS.map((value, index) => {
        const isEven = index % 2 === 0;
        const cSingle = isEven ? colorBlack : colorWhite;
        const cMult = isEven ? colorRed : colorGreen;
        const rotation = index * 18;

        return (
          <G
            key={`sector-${value}`}
            rotation={rotation}
            origin={`${cx}, ${cy}`}
          >
            <Path
              d={pathDouble}
              fill={cMult}
              onPress={(e) => onSectorPress(e, value, 2)}
            />
            <Path
              d={pathOuterSingle}
              fill={cSingle}
              onPress={(e) => onSectorPress(e, value, 1)}
            />
            <Path
              d={pathTriple}
              fill={cMult}
              onPress={(e) => onSectorPress(e, value, 3)}
            />
            <Path
              d={pathInnerSingle}
              fill={cSingle}
              onPress={(e) => onSectorPress(e, value, 1)}
            />
          </G>
        );
      })}

      {SECTORS.map((value, index) => {
        const angle = ((index * 18 - 90) * Math.PI) / 180;
        const radius = 0.91 * cx;
        const lx = cx + radius * Math.cos(angle);
        const ly = cy + radius * Math.sin(angle);
        return (
          <SvgText
            key={`label-${value}`}
            x={lx}
            y={ly + 6}
            fill="#fff"
            fontSize={16}
            fontWeight="bold"
            textAnchor="middle"
            pointerEvents="none"
          >
            {value}
          </SvgText>
        );
      })}

      <Circle
        cx={cx}
        cy={cy}
        r={rOuterBull * cx}
        fill={colorGreen}
        onPress={(e) => onSectorPress(e, 25, 1)}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={rInnerBull * cx}
        fill={colorRed}
        onPress={(e) => onSectorPress(e, 25, 2)}
      />
    </>
  );
});

export function InteractiveDartboard({
  onThrow,
  onUndo,
  theme,
  language,
}: any) {
  const size = Dimensions.get("window").width - 32;
  const cx = size / 2;
  const cy = size / 2;

  const [pinpoint, setPinpoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handlePress = useCallback(
    (e: any, value: number, multiplier: number) => {
      let coords = undefined;
      if (e && e.nativeEvent && e.nativeEvent.locationX !== undefined) {
        const locX = e.nativeEvent.locationX;
        const locY = e.nativeEvent.locationY;
        setPinpoint({ x: locX, y: locY });
        coords = { x: (locX - cx) / cx, y: (locY - cy) / cy };
      }
      onThrow(value, multiplier, coords);
    },
    [cx, cy, onThrow],
  );

  const handleUndoPress = () => {
    setPinpoint(null);
    onUndo();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.hintText, { color: theme.colors.textMuted }]}>
        {t(language, "boardZoomHint") ||
          "Przytrzymaj / Uszczypnij, aby przybliżyć i precyzyjnie celować 🔍"}
      </Text>

      <View style={styles.boardWrapper}>
        <ReactNativeZoomableView
          maxZoom={3.5}
          minZoom={1}
          zoomStep={0.5}
          initialZoom={1}
          bindToBorders={true}
          style={{ width: size, height: size }}
        >
          <Svg width={size} height={size}>
            <StaticBoardBackground
              cx={cx}
              cy={cy}
              onSectorPress={handlePress}
            />

            {pinpoint && (
              <G pointerEvents="none">
                <Circle
                  cx={pinpoint.x}
                  cy={pinpoint.y}
                  r={12}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2}
                  opacity={0.8}
                  pointerEvents="none"
                />
                <Circle
                  cx={pinpoint.x}
                  cy={pinpoint.y}
                  r={4}
                  fill={theme.colors.primary}
                  pointerEvents="none"
                />
              </G>
            )}
          </Svg>
        </ReactNativeZoomableView>
      </View>

      <TouchableOpacity
        style={[styles.undoBtn, { backgroundColor: theme.colors.danger }]}
        onPress={handleUndoPress}
      >
        <Ionicons name="arrow-undo" size={20} color="#fff" />
        <Text style={styles.undoTxt}>
          {t(language, "undoThrow") || "Undo throw"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 5,
  },
  hintText: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  boardWrapper: {
    width: Dimensions.get("window").width - 32,
    height: Dimensions.get("window").width - 32,
    overflow: "hidden",
    borderRadius: (Dimensions.get("window").width - 32) / 2,
    backgroundColor: "#1a1a1a",
  },
  undoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 15,
    gap: 8,
    width: "100%",
  },
  undoTxt: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
