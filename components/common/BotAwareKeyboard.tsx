import React from "react";
import { View } from "react-native";
import { getBotDifficultyFromName } from "../../lib/bot";
import { BotThrowingOverlay } from "./BotThrowingOverlay";

type BotAwareKeyboardProps = {
  playerName: string;
  onUndo: () => void;
  theme: any;
  language: any;
  children: React.ReactNode;
  style?: any;
  botStyle?: any;
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
