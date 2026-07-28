import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { AnimatedPressable } from "../common/AnimatedPressable";

export interface KeyboardActionButtonProps {
  onPress: () => void;
  theme: { colors: Record<string, string> };
  variant?: "key" | "pill";
  active?: boolean;
  activeColor?: string;
  undo?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function KeyboardActionButton({
  onPress,
  theme,
  variant = "key",
  active,
  activeColor,
  undo,
  disabled,
  style,
  children,
}: KeyboardActionButtonProps) {
  const styles = getStyles(theme);

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[
        variant === "pill" ? styles.pill : styles.key,
        undo && styles.undoKey,
        active &&
          (activeColor ? { backgroundColor: activeColor } : styles.activeKey),
        disabled && styles.disabledKey,
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    key: {
      flex: 1,
      height: 58,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.danger,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8,
    },
    activeKey: { backgroundColor: theme.colors.primaryDark },
    undoKey: { backgroundColor: theme.colors.dangerLight },
    disabledKey: {
      backgroundColor: theme.colors.cardBorder,
      elevation: 0,
      opacity: 0.5,
    },
  });
