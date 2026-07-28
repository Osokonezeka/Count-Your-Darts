import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardActionButton } from "../keyboards/KeyboardActionButton";
import { t } from "../../lib/i18n";

type BotThrowingOverlayProps = {
  playerName: string;
  onUndo: () => void;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
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
        {playerName} {t(language, "isThrowing")}
      </Text>
      <KeyboardActionButton variant="pill" onPress={onUndo} theme={theme}>
        <Ionicons name="arrow-undo" size={20} color="#fff" />
        <Text style={styles.botUndoText}>
          {t(language, "undoThrow")}
        </Text>
      </KeyboardActionButton>
    </View>
  );
};

const getStyles = (theme: { colors: Record<string, string> }) =>
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
    botUndoText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  });
