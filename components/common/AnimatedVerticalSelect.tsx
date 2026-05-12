import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

export interface VerticalOptionType {
  id: string;
  title: string;
  desc?: string;
  icon?: React.ReactNode;
}

interface VerticalOptionProps {
  opt: VerticalOptionType;
  isActive: boolean;
  onSelect: (id: string) => void;
  theme: { colors: Record<string, string> };
}

const VerticalOption = ({
  opt,
  isActive,
  onSelect,
  theme,
}: VerticalOptionProps) => {
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isActive ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isActive]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.background, theme.colors.primaryDark],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.cardBorder, theme.colors.primaryDark],
  });

  const titleColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.textMain, "#ffffff"],
  });

  const descColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.textLight, "rgba(255,255,255,0.7)"],
  });

  return (
    <Pressable onPress={() => onSelect(opt.id)}>
      <Animated.View
        style={[styles.optionBtn, { backgroundColor, borderColor }]}
      >
        <View style={styles.optionContent}>
          {opt.icon && <View style={styles.iconContainer}>{opt.icon}</View>}
          <View style={styles.textContainer}>
            <Animated.Text style={[styles.title, { color: titleColor }]}>
              {opt.title}
            </Animated.Text>
            {opt.desc && (
              <Animated.Text style={[styles.desc, { color: descColor }]}>
                {opt.desc}
              </Animated.Text>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export interface AnimatedVerticalSelectProps {
  options: VerticalOptionType[];
  activeOption: string;
  onSelect: (id: string) => void;
  theme: { colors: Record<string, string> };
  style?: StyleProp<ViewStyle>;
}

export function AnimatedVerticalSelect({
  options,
  activeOption,
  onSelect,
  theme,
  style,
}: AnimatedVerticalSelectProps) {
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(options.length > 5);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    setCanScrollUp(contentOffset.y > 0);
    setCanScrollDown(
      contentOffset.y + layoutMeasurement.height < contentSize.height - 5,
    );
  };

  if (options.length <= 5) {
    return (
      <View style={[{ gap: 8 }, style]}>
        {options.map((opt) => (
          <VerticalOption
            key={opt.id}
            opt={opt}
            isActive={activeOption === opt.id}
            onSelect={onSelect}
            theme={theme}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[style, { position: "relative" }]}>
      <ScrollView
        ref={scrollRef}
        style={{ maxHeight: 380 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
      >
        {options.map((opt) => (
          <VerticalOption
            key={opt.id}
            opt={opt}
            isActive={activeOption === opt.id}
            onSelect={onSelect}
            theme={theme}
          />
        ))}
      </ScrollView>

      {canScrollUp && (
        <View style={styles.scrollArrowTop} pointerEvents="box-none">
          <Pressable
            onPress={() =>
              scrollRef.current?.scrollTo({ y: 0, animated: true })
            }
            style={[
              styles.arrowIconBackground,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.cardBorder,
              },
            ]}
          >
            <Ionicons
              name="chevron-up"
              size={16}
              color={theme.colors.textMain}
            />
          </Pressable>
        </View>
      )}
      {canScrollDown && (
        <View style={styles.scrollArrowBottom} pointerEvents="box-none">
          <Pressable
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            style={[
              styles.arrowIconBackground,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.cardBorder,
              },
            ]}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={theme.colors.textMain}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  optionBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 1,
  },
  optionContent: { flexDirection: "row", alignItems: "center" },
  iconContainer: { marginRight: 16 },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  desc: { fontSize: 13, fontWeight: "500" },
  scrollArrowTop: {
    position: "absolute",
    top: 4,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  scrollArrowBottom: {
    position: "absolute",
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  arrowIconBackground: {
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 1,
  },
});
