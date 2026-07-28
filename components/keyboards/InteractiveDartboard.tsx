import { Ionicons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import React, { memo, useCallback, useState } from "react";
import {
  Dimensions,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import {
  DARTBOARD_RADII,
  DARTBOARD_SECTORS,
  createWedgePath,
  sectorLabelPosition,
} from "../../lib/dartboardGeometry";
import { t } from "../../lib/i18n";

interface StaticBoardBackgroundProps {
  cx: number;
  cy: number;
  onSectorPress: (
    e: GestureResponderEvent,
    value: number,
    multiplier: number,
  ) => void;
}

const StaticBoardBackground = memo(
  ({ cx, cy, onSectorPress }: StaticBoardBackgroundProps) => {
    const {
      doubleOut: rDoubleOut,
      doubleIn: rDoubleIn,
      tripleOut: rOuterSingleIn,
      tripleIn: rTripleIn,
      outerBull: rOuterBull,
      innerBull: rInnerBull,
    } = DARTBOARD_RADII;

    const pathDouble = createWedgePath(cx, cy, rDoubleIn, rDoubleOut);
    const pathOuterSingle = createWedgePath(cx, cy, rOuterSingleIn, rDoubleIn);
    const pathTriple = createWedgePath(cx, cy, rTripleIn, rOuterSingleIn);
    const pathInnerSingle = createWedgePath(cx, cy, rOuterBull, rTripleIn);

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

        {DARTBOARD_SECTORS.map((value, index) => {
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

        {DARTBOARD_SECTORS.map((value, index) => {
          const { x: lx, y: ly } = sectorLabelPosition(cx, cy, index);
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
  },
);

export interface InteractiveDartboardProps {
  onThrow: (
    value: number,
    multiplier: number,
    coords?: { x: number; y: number },
  ) => void;
  onUndo: () => void;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
}

export function InteractiveDartboard({
  onThrow,
  onUndo,
  theme,
  language,
}: InteractiveDartboardProps) {
  const size = Dimensions.get("window").width - 32;
  const cx = size / 2;
  const cy = size / 2;

  const [pinpoint, setPinpoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent, value: number, multiplier: number) => {
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
        {t(language, "boardZoomHint")}
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
          {t(language, "undoThrow")}
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
