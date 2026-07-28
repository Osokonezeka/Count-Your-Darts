import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BaseModal, MODAL_BACKDROP_OPACITY } from "./BaseModal";

export interface FinishModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  icon?: string;
  iconBgColor?: string;
  theme: { colors: Record<string, string> };
  children?: React.ReactNode;
}

export function FinishModal({
  visible,
  title,
  subtitle,
  icon = "🏆",
  iconBgColor,
  theme,
  children,
}: FinishModalProps) {
  const styles = getStyles(theme);

  return (
    <BaseModal
      visible={visible}
      dismissableOnBackdropPress={false}
      backdropOpacity={MODAL_BACKDROP_OPACITY}
      overlayStyle={styles.modalOverlay}
    >
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
          <Text style={[styles.modalTitle, !subtitle && { marginBottom: 20 }]}>
            {title}
          </Text>
        )}
        {!!subtitle && <Text style={styles.modalSub}>{subtitle}</Text>}

        {children}
      </View>
    </BaseModal>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    modalOverlay: {
      alignItems: "center",
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
