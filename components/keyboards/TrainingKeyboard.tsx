import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardActionButton } from "./KeyboardActionButton";

export interface TrainingKeyboardProps {
  playerName: string;
  instructionText: string;
  targetValue: string | number;
  hitLabel: string;
  missLabel: string;
  onHit: () => void;
  onMiss: () => void;
  onUndo: () => void;
  theme: { colors: Record<string, string> };
}

export function TrainingKeyboard({
  playerName,
  instructionText,
  targetValue,
  hitLabel,
  missLabel,
  onHit,
  onMiss,
  onUndo,
  theme,
}: TrainingKeyboardProps) {
  const styles = getStyles(theme);

  return (
    <View style={styles.keyboard}>
      <View style={styles.keyboardHeader}>
        <Text style={styles.instructionText}>
          {playerName}, {instructionText}{" "}
          <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>
            {targetValue}
          </Text>
        </Text>
      </View>
      <View style={styles.keyRow}>
        <KeyboardActionButton onPress={onMiss} theme={theme}>
          <Text style={styles.keyTextAction}>{missLabel}</Text>
        </KeyboardActionButton>

        <KeyboardActionButton
          onPress={onHit}
          theme={theme}
          active
          activeColor={theme.colors.primary}
        >
          <Text style={[styles.keyTextAction, { color: "#fff" }]}>
            {hitLabel}
          </Text>
        </KeyboardActionButton>

        <KeyboardActionButton onPress={onUndo} theme={theme} undo>
          <Ionicons name="arrow-undo" size={28} color={theme.colors.danger} />
        </KeyboardActionButton>
      </View>
    </View>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    keyboard: {
      padding: 16,
      backgroundColor: theme.colors.cardBorder,
      paddingBottom: 30,
    },
    keyboardHeader: { marginBottom: 12, alignItems: "center" },
    instructionText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textMain,
    },
    keyRow: { flexDirection: "row", gap: 6 },
    keyTextAction: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
  });
