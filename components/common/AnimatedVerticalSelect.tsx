import React, { useEffect, useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from "react-native";

export interface VerticalOptionType {
  id: string;
  title: string;
  desc?: string;
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
        <Animated.Text style={[styles.title, { color: titleColor }]}>
          {opt.title}
        </Animated.Text>
        {opt.desc && (
          <Animated.Text style={[styles.desc, { color: descColor }]}>
            {opt.desc}
          </Animated.Text>
        )}
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

const styles = StyleSheet.create({
  optionBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 1,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  desc: { fontSize: 13, fontWeight: "500" },
});
