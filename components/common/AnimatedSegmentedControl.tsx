import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";

export interface SegmentedControlOption {
  id: string;
  label: string;
  icon?: (isActive: boolean) => React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
}

export interface AnimatedSegmentedControlProps {
  options: SegmentedControlOption[];
  activeOption: string;
  onSelect: (id: string) => void;
  theme: { colors: Record<string, string> };
  style?: StyleProp<ViewStyle>;
}

export function AnimatedSegmentedControl({
  options,
  activeOption,
  onSelect,
  theme,
  style,
}: AnimatedSegmentedControlProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === activeOption),
  );
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (containerWidth > 0) {
      const segmentWidth = (containerWidth - 8) / options.length;
      Animated.spring(translateX, {
        toValue: activeIndex * segmentWidth,
        useNativeDriver: true,
        bounciness: 4,
        speed: 20,
      }).start();
    }
  }, [activeIndex, containerWidth, options.length]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        style,
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.slider,
            {
              width: (containerWidth - 8) / options.length,
              backgroundColor: theme.colors.primaryDark,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
      {options.map((opt, idx: number) => {
        const isActive = activeIndex === idx;
        return (
          <Pressable
            key={opt.id}
            style={styles.segment}
            onPress={() => onSelect(opt.id)}
          >
            {opt.icon && (
              <View style={{ marginRight: 6 }}>{opt.icon(isActive)}</View>
            )}
            <Text
              style={[
                styles.text,
                isActive
                  ? { color: "#fff", fontWeight: "700" }
                  : { color: theme.colors.textMuted, fontWeight: "600" },
                opt.textStyle,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    position: "relative",
  },
  slider: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    zIndex: 1,
  },
  text: { fontSize: 14 },
});
