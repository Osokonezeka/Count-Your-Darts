import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";

export function FinishModal({
  visible,
  title,
  subtitle,
  icon = "🏆",
  iconBgColor,
  theme,
  children,
}: any) {
  const styles = getStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View
            style={[
              styles.trophyWrapper,
              iconBgColor && { backgroundColor: iconBgColor },
            ]}
          >
            <Text style={{ fontSize: 40 }}>{icon}</Text>
          </View>

          {!!title && (
            <Text
              style={[styles.modalTitle, !subtitle && { marginBottom: 20 }]}
            >
              {title}
            </Text>
          )}
          {!!subtitle && <Text style={styles.modalSub}>{subtitle}</Text>}

          {children}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      padding: 25,
      borderRadius: 24,
      width: "100%",
      alignItems: "center",
    },
    trophyWrapper: {
      width: 80,
      height: 80,
      backgroundColor: theme.colors.warning,
      opacity: 0.8,
      borderRadius: 40,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 15,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "900",
      textAlign: "center",
      color: theme.colors.textMain,
      marginBottom: 10,
    },
    modalSub: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 25,
    },
  });
