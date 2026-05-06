import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { formatTime } from "../../lib/gameUtils";

interface TimerBadgeProps {
  initialTime: number;
  isRunning: boolean;
  onTimeUpdate: (time: number) => void;
  theme: any;
  styles: any;
}

export const TimerBadge = React.memo(
  ({
    initialTime,
    isRunning,
    onTimeUpdate,
    theme,
    styles,
  }: TimerBadgeProps) => {
    const [time, setTime] = useState(initialTime);

    useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isRunning) {
        interval = setInterval(() => {
          setTime((prev) => {
            const next = prev + 1;
            onTimeUpdate(next);
            return next;
          });
        }, 1000);
      }
      return () => clearInterval(interval);
    }, [isRunning, onTimeUpdate]);

    return (
      <View style={styles.timerBadge}>
        <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
        <Text style={styles.timerText}>{formatTime(time)}</Text>
      </View>
    );
  },
);
