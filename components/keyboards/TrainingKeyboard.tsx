import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
        <TouchableOpacity onPress={onMiss} style={styles.keyAction}>
          <Text style={styles.keyTextAction}>{missLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onHit}
          style={[styles.keyAction, styles.keyHit]}
        >
          <Text style={[styles.keyTextAction, { color: "#fff" }]}>
            {hitLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onUndo}
          style={[styles.keyAction, styles.undoKey]}
        >
          <Ionicons name="arrow-undo" size={28} color={theme.colors.danger} />
        </TouchableOpacity>
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
    keyAction: {
      flex: 1,
      height: 58,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      elevation: 2,
    },
    keyHit: { backgroundColor: theme.colors.primary },
    undoKey: { backgroundColor: theme.colors.dangerLight },
    keyTextAction: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
  });
