import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { t } from "../../lib/i18n";

export function SelectPlayersModal({
  visible,
  title,
  players,
  selectedPlayers,
  onTogglePlayer,
  onClose,
  onConfirm,
  confirmText,
  confirmColor,
  cancelText,
  showSearch = false,
  searchQuery = "",
  onSearchChange,
  showSelectAll = false,
  onSelectAll,
  onDeselectAll,
  allSelected = false,
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
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.modalTitle}>{title}</Text>

          {showSearch && (
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={theme.colors.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t(language, "searchPlayer") || "Search player..."}
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={onSearchChange}
              />
            </View>
          )}

          {showSelectAll && (
            <View style={styles.selectAllRow}>
              <Text style={styles.selectAllLabel}>
                {players.length} {t(language, "playersShort") || "players"}
              </Text>
              <AnimatedPressable
                onPress={allSelected ? onDeselectAll : onSelectAll}
              >
                <Text style={styles.selectAllText}>
                  {allSelected
                    ? t(language, "deselectAll") || "Deselect all"
                    : t(language, "selectAll") || "Select all"}
                </Text>
              </AnimatedPressable>
            </View>
          )}

          <FlatList
            style={{ maxHeight: 350, width: "100%" }}
            data={players}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const checked = selectedPlayers.includes(item);
              return (
                <AnimatedPressable
                  style={styles.playerRow}
                  onPress={() => onTogglePlayer(item)}
                >
                  <Text
                    style={[
                      styles.playerName,
                      checked && styles.playerNameActive,
                    ]}
                  >
                    {item}
                  </Text>
                  <View
                    style={[styles.checkbox, checked && styles.checkboxActive]}
                  >
                    {checked && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </AnimatedPressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {t(language, "noPlayersMatch") ||
                  "No players match the criteria."}
              </Text>
            }
          />

          <View style={styles.modalActions}>
            {cancelText && (
              <AnimatedPressable
                onPress={onClose}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>{cancelText}</Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable
              onPress={onConfirm}
              style={[
                styles.modalBtnAdd,
                confirmColor && { backgroundColor: confirmColor },
              ]}
            >
              <Text style={styles.modalBtnAddText}>{confirmText}</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Pressable>
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
      maxHeight: "85%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
      textAlign: "center",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingLeft: 8,
      color: theme.colors.textMain,
      fontSize: 16,
    },
    selectAllRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    selectAllLabel: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    selectAllText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: "700",
    },
    playerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    playerName: {
      fontSize: 16,
      color: theme.colors.textMain,
      fontWeight: "600",
    },
    playerNameActive: {
      color: theme.colors.success || "#28a745",
      fontWeight: "bold",
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.textLight,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxActive: {
      backgroundColor: theme.colors.success || "#28a745",
      borderColor: theme.colors.success || "#28a745",
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
      flex: 1,
      backgroundColor: theme.colors.success || "#28a745",
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
    },
    modalBtnAddText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    emptyText: {
      color: theme.colors.textMuted,
      marginVertical: 20,
      fontStyle: "italic",
      textAlign: "center",
    },
  });
