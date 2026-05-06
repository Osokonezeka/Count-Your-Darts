import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { t } from "../../lib/i18n";
import { AnimatedPressable } from "../common/AnimatedPressable";

const DART_ROWS = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 25],
];

interface DartKeyboardProps {
  onThrow: (value: number) => void;
  onMiss: () => void;
  onMultiplierToggle: (mult: 2 | 3) => void;
  onUndo: () => void;
  multiplier: 1 | 2 | 3;
  theme: { colors: Record<string, string> };
  bullTerm: string;
  missTerm: string;
  tripleTerm: string;
  language: Parameters<typeof t>[0];
}

export function DartKeyboard({
  onThrow,
  onMiss,
  onMultiplierToggle,
  onUndo,
  multiplier,
  theme,
  bullTerm,
  missTerm,
  tripleTerm,
  language,
}: DartKeyboardProps) {
  const styles = getStyles(theme);
  return (
    <>
      {DART_ROWS.map((row, i) => (
        <View key={i} style={styles.keyRow7}>
          {row.map((k) => {
            const isBullDisabled = k === 25 && multiplier === 3;
            return (
              <AnimatedPressable
                key={k}
                onPress={() => {
                  if (!isBullDisabled) onThrow(k);
                }}
                style={[styles.key, isBullDisabled && styles.disabledKey]}
              >
                <Text
                  style={[
                    styles.keyText,
                    isBullDisabled && styles.disabledKeyText,
                  ]}
                >
                  {k === 25 ? bullTerm : k}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      ))}

      <View style={styles.keyRow4}>
        <AnimatedPressable
          onPress={onMiss}
          style={[styles.keyAction, multiplier !== 1 && styles.disabledKey]}
        >
          <Text
            style={[
              styles.keyTextAction,
              multiplier !== 1 && styles.disabledKeyText,
            ]}
          >
            {missTerm}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => onMultiplierToggle(2)}
          style={[styles.keyAction, multiplier === 2 && styles.activeModifier]}
        >
          <Text
            style={[
              styles.keyTextAction,
              multiplier === 2 && styles.activeModifierText,
            ]}
          >
            {t(language, "double") || "Double"}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => onMultiplierToggle(3)}
          style={[styles.keyAction, multiplier === 3 && styles.activeModifier]}
        >
          <Text
            style={[
              styles.keyTextAction,
              multiplier === 3 && styles.activeModifierText,
            ]}
          >
            {tripleTerm}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={onUndo}
          style={[styles.keyAction, styles.undoKey]}
        >
          <Ionicons name="arrow-undo" size={28} color={theme.colors.danger} />
        </AnimatedPressable>
      </View>
    </>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    keyRow7: { flexDirection: "row", gap: 6 },
    keyRow4: { flexDirection: "row", gap: 6, marginTop: 4 },
    key: {
      flex: 1,
      height: 52,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyText: { fontSize: 18, fontWeight: "700", color: theme.colors.textMain },
    keyAction: {
      flex: 1,
      height: 58,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyTextAction: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    activeModifier: { backgroundColor: theme.colors.primaryDark },
    activeModifierText: { color: "#fff" },
    disabledKey: {
      backgroundColor: theme.colors.cardBorder,
      elevation: 0,
      opacity: 0.5,
    },
    disabledKeyText: { color: theme.colors.textLight },
    undoKey: { backgroundColor: theme.colors.dangerLight },
  });
