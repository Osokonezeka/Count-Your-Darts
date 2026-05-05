import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useBotDelay = (
  isUndoing: boolean | undefined,
  baseDelay: number = 1200,
) => {
  const [isFastBot, setIsFastBot] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("@fast_bot_enabled").then((val) =>
      setIsFastBot(val === "true"),
    );
  }, []);

  const delay = isUndoing
    ? Math.max(1200, baseDelay)
    : isFastBot
      ? 50
      : baseDelay;

  return { isFastBot, delay };
};
