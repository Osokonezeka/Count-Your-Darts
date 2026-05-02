import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { useHaptics } from "../../context/HapticsContext";
import * as Haptics from "expo-haptics";

export function ScoreKeyboard({
  onKeyPress,
  onDelete,
  onSubmit,
  theme,
  style,
  keyStyle,
  hideWrapperBorder,
}: any) {
  const styles = getStyles(theme);
  const { isHapticsEnabled, intensity } = useHaptics();

  const triggerHaptic = () => {
    if (isHapticsEnabled) {
      let hapticStyle = Haptics.ImpactFeedbackStyle.Medium;
      if (intensity === "light")
        hapticStyle = Haptics.ImpactFeedbackStyle.Light;
      if (intensity === "heavy")
        hapticStyle = Haptics.ImpactFeedbackStyle.Heavy;
      Haptics.impactAsync(hapticStyle);
    }
  };

  return (
    <View style={[!hideWrapperBorder && styles.wrapper, style]}>
      {[
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["DEL", "0", "ENTER"],
      ].map((row, rI) => (
        <View key={rI} style={{ flexDirection: "row" }}>
          {row.map((key) => (
            <AnimatedPressable
              key={key}
              style={[
                styles.kbKey,
                keyStyle,
                key === "ENTER" && styles.kbEnter,
                key === "DEL" && styles.kbDel,
              ]}
              onPress={() => {
                triggerHaptic();
                if (key === "ENTER") onSubmit();
                else if (key === "DEL") onDelete();
                else onKeyPress(key);
              }}
            >
              {key === "DEL" ? (
                <Ionicons name="backspace-outline" size={32} color="#fff" />
              ) : key === "ENTER" ? (
                <Ionicons name="checkmark" size={38} color="#fff" />
              ) : (
                <Text style={styles.kbTxt}>{key}</Text>
              )}
            </AnimatedPressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    wrapper: {
      marginTop: 4,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    kbKey: {
      flex: 1,
      height: 65,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    kbEnter: { backgroundColor: theme.colors.success || "#28a745" },
    kbDel: { backgroundColor: theme.colors.danger || "#ff4444" },
    kbTxt: { fontSize: 28, fontWeight: "800", color: theme.colors.textMain },
  });
