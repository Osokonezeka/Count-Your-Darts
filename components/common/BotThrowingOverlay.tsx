import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "./AnimatedPressable";
import { t } from "../../lib/i18n";

type BotThrowingOverlayProps = {
  playerName: string;
  onUndo: () => void;
  theme: any;
  language: any;
};

export const BotThrowingOverlay = ({
  playerName,
  onUndo,
  theme,
  language,
}: BotThrowingOverlayProps) => {
  const styles = getStyles(theme);
  return (
    <View style={styles.botOverlay}>
      <Ionicons name="hardware-chip" size={64} color={theme.colors.primary} />
      <Text style={styles.botOverlayText}>
        {playerName} {t(language, "isThrowing") || "is throwing..."}
      </Text>
      <AnimatedPressable style={styles.botUndoBtn} onPress={onUndo}>
        <Ionicons name="arrow-undo" size={20} color="#fff" />
        <Text style={styles.botUndoText}>
          {t(language, "undoThrow") || "Undo last throw"}
        </Text>
      </AnimatedPressable>
    </View>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    botOverlay: {
      minHeight: 280,
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
      padding: 20,
    },
    botOverlayText: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginTop: 16,
      marginBottom: 24,
      textAlign: "center",
    },
    botUndoBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.danger,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8,
    },
    botUndoText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  });
