import React, { useRef } from "react";
import {
  Pressable,
  PressableProps,
  Animated,
  StyleProp,
  ViewStyle,
  Insets,
  GestureResponderEvent,
} from "react-native";

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps
  extends Omit<
    PressableProps,
    | "style"
    | "children"
    | "onPress"
    | "onLongPress"
    | "hitSlop"
    | "onPressIn"
    | "onPressOut"
  > {
  onPress?: ((event: GestureResponderEvent) => void) | (() => void);
  onLongPress?: ((event: GestureResponderEvent) => void) | (() => void);
  delayLongPress?: number;
  hitSlop?: number | Insets | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  scaleTo?: number;
  opacityTo?: number;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  delayLongPress,
  hitSlop,
  disabled,
  style,
  children,
  scaleTo = 0.95,
  opacityTo = 0.8,
  accessibilityRole = "button",
  ...accessibilityAndTouchProps
}: AnimatedPressableProps) {
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
    outputRange: [1, scaleTo],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, opacityTo],
  });

  return (
    <AnimatedPressableComponent
      {...accessibilityAndTouchProps}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={hitSlop}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      style={[style, { transform: [{ scale }], opacity }]}
    >
      {children}
    </AnimatedPressableComponent>
  );
}
