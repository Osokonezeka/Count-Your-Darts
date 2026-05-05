import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { getBotDifficultyFromName } from "../../lib/bot";
import { BotThrowingOverlay } from "./BotThrowingOverlay";
import { t } from "../../lib/i18n";

type BotAwareKeyboardProps = {
  playerName: string;
  onUndo: () => void;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  botStyle?: StyleProp<ViewStyle>;
};

export const BotAwareKeyboard = ({
  playerName,
  onUndo,
  theme,
  language,
  children,
  style,
  botStyle,
}: BotAwareKeyboardProps) => {
  const isBot = getBotDifficultyFromName(playerName) !== null;

  if (isBot) {
    return (
      <View style={botStyle || style}>
        <BotThrowingOverlay
          playerName={playerName}
          onUndo={onUndo}
          theme={theme}
          language={language}
        />
      </View>
    );
  }

  return style ? <View style={style}>{children}</View> : <>{children}</>;
};
