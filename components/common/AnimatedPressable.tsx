import React, { useRef } from "react";
import { Pressable, Animated } from "react-native";

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

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
    outputRange: [1, scaleTo],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, opacityTo],
  });

  return (
    <AnimatedPressableComponent
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={hitSlop}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[style, { transform: [{ scale }], opacity }]}
    >
      {children}
    </AnimatedPressableComponent>
  );
}
