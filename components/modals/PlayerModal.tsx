import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { t } from "../../lib/i18n";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { BaseModal } from "./BaseModal";

export interface PlayerModalProps {
  visible: boolean;
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
}

export function PlayerModal({
  visible,
  title,
  value,
  onChangeText,
  onClose,
  onSave,
  theme,
  language,
}: PlayerModalProps) {
  const styles = getStyles(theme);

  return (
    <BaseModal visible={visible} onClose={onClose} useKeyboardAvoidingView>
      <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TextInput
          style={styles.addPlayerInput}
          placeholder={t(language, "nameOrNickname")}
          placeholderTextColor={theme.colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          autoFocus
          maxLength={30}
          onSubmitEditing={onSave}
          returnKeyType="done"
        />
        <View style={styles.modalActions}>
          <AnimatedPressable style={styles.modalBtnCancel} onPress={onClose}>
            <Text style={styles.modalBtnCancelText}>
              {t(language, "cancel")}
            </Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.modalBtnAdd} onPress={onSave}>
            <Text style={styles.modalBtnAddText}>
              {t(language, "save")}
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    </BaseModal>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      elevation: 10,
      width: "100%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
      textAlign: "center",
    },
    addPlayerInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.colors.textMain,
      fontWeight: "600",
      textAlign: "center",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 24,
    },
    modalBtnCancel: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      justifyContent: "center",
    },
    modalBtnCancelText: {
      color: theme.colors.textMuted,
      fontWeight: "700",
      fontSize: 16,
    },
    modalBtnAdd: {
      backgroundColor: theme.colors.success,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      justifyContent: "center",
    },
    modalBtnAddText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
