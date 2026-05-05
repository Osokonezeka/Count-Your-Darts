import React from "react";
import { View } from "react-native";
import { AnimatedSegmentedControl } from "../common/AnimatedSegmentedControl";
import { t } from "../../lib/i18n";

export interface InputModeSelectorProps {
  inputMode: string;
  setInputMode: (mode: "dart" | "score" | "board") => void;
  onReset?: () => void;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
}

export function InputModeSelector({
  inputMode,
  setInputMode,
  onReset,
  theme,
  language,
}: InputModeSelectorProps) {
  const handleSelect = (mode: string) => {
    if (mode !== inputMode) {
      setInputMode(mode as "dart" | "score" | "board");
      if (onReset) onReset();
    }
  };

  return (
    <View style={{ marginBottom: 2 }}>
      <AnimatedSegmentedControl
        theme={theme}
        activeOption={inputMode}
        onSelect={handleSelect}
        options={[
          { id: "dart", label: t(language, "inputModeDart") || "Dart" },
          { id: "score", label: t(language, "inputModeScore") || "Score" },
          { id: "board", label: t(language, "inputModeBoard") || "Board" },
        ]}
      />
    </View>
  );
}
