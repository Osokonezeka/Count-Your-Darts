import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const StepperButton = ({ onPress, iconName, theme, styles }: any) => {
  const anim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      theme.colors.background,
      theme.colors.primaryLight || "rgba(0, 122, 255, 0.15)",
    ],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.cardBorder, theme.colors.primary],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.stepperBtn,
          { transform: [{ scale }], backgroundColor, borderColor },
        ]}
      >
        <Ionicons name={iconName} size={18} color={theme.colors.primary} />
      </Animated.View>
    </Pressable>
  );
};

export function AnimatedStepper({
  value,
  setValue,
  label,
  min = 1,
  max = 9999,
  step = 1,
  displayValue,
  onLeftPress,
  onRightPress,
  theme,
}: any) {
  const handleMinus = () => {
    if (onLeftPress) onLeftPress();
    else if (value - step >= min) setValue(value - step);
  };

  const handlePlus = () => {
    if (onRightPress) onRightPress();
    else if (value + step <= max) setValue(value + step);
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.stepperContainer}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <StepperButton
          onPress={handleMinus}
          iconName="remove"
          theme={theme}
          styles={styles}
        />

        <Text
          style={styles.stepperValue}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayValue !== undefined ? displayValue : value}
        </Text>

        <StepperButton
          onPress={handlePlus}
          iconName="add"
          theme={theme}
          styles={styles}
        />
      </View>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    stepperContainer: { flex: 1, alignItems: "center" },
    stepperLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: "700",
      marginBottom: 8,
      textTransform: "uppercase",
      textAlign: "center",
    },
    stepperControls: { flexDirection: "row", alignItems: "center", gap: 6 },
    stepperBtn: {
      backgroundColor: theme.colors.background,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    stepperValue: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      minWidth: 26,
      textAlign: "center",
      flexShrink: 1,
      marginHorizontal: 2,
    },
  });
