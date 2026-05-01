import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { t } from "../../lib/i18n";

export function PlayerModal({
  visible,
  title,
  value,
  onChangeText,
  onClose,
  onSave,
  theme,
  language,
}: any) {
  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>{title}</Text>
            <TextInput
              style={styles.addPlayerInput}
              placeholder={t(language, "nameOrNickname") || "Name or nickname"}
              placeholderTextColor={theme.colors.textMuted}
              value={value}
              onChangeText={onChangeText}
              autoFocus
              maxLength={15}
              onSubmitEditing={onSave}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
                <Text style={styles.modalBtnCancelText}>
                  {t(language, "cancel") || "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnAdd} onPress={onSave}>
                <Text style={styles.modalBtnAddText}>
                  {t(language, "save") || "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
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
      backgroundColor: theme.colors.success || "#28a745",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      justifyContent: "center",
    },
    modalBtnAddText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
