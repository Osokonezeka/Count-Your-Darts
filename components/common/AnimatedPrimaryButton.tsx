import React, { useRef } from "react";
import { Text, Pressable, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function AnimatedPrimaryButton({
  onPress,
  title,
  iconName,
  iconSize = 24,
  iconPosition = "right",
  disabled,
  theme,
  style,
  color,
  textColor = "#fff",
  fontSize = 16,
}: any) {
  const anim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 50,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.95],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.8],
  });

  const bgColor = color || theme.colors.primary;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: bgColor, shadowColor: bgColor },
          disabled && {
            backgroundColor: theme.colors.primaryDisabled || "#ccc",
            elevation: 0,
            shadowOpacity: 0,
          },
          { transform: [{ scale }], opacity },
        ]}
      >
        {iconName && iconPosition === "left" && (
          <Ionicons name={iconName} size={iconSize} color={textColor} />
        )}
        <Text style={[styles.text, { color: textColor, fontSize }]}>
          {title}
        </Text>
        {iconName && iconPosition === "right" && (
          <Ionicons name={iconName} size={iconSize} color={textColor} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  text: { fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
});
