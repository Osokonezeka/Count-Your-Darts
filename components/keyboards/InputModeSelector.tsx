import React from "react";
import { View } from "react-native";
import { AnimatedSegmentedControl } from "../common/AnimatedSegmentedControl";
import { t } from "../../lib/i18n";

export function InputModeSelector({
  inputMode,
  setInputMode,
  theme,
  language,
}: any) {
  return (
    <View style={{ marginBottom: 2 }}>
      <AnimatedSegmentedControl
        theme={theme}
        activeOption={inputMode}
        onSelect={setInputMode}
        options={[
          { id: "dart", label: t(language, "inputModeDart") || "Dart" },
          { id: "score", label: t(language, "inputModeScore") || "Score" },
          { id: "board", label: t(language, "inputModeBoard") || "Board" },
        ]}
      />
    </View>
  );
}
