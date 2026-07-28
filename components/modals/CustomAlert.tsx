import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { BaseModal, MODAL_BACKDROP_OPACITY } from "./BaseModal";

export type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onRequestClose: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
}: CustomAlertProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  if (!visible) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={onRequestClose}
      backdropOpacity={MODAL_BACKDROP_OPACITY}
      overlayStyle={styles.overlay}
    >
      <View style={styles.alertBox} onStartShouldSetResponder={() => true}>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.buttonContainer}>
          {buttons.map((btn, index) => {
            const isCancel = btn.style === "cancel";
            const isDestructive = btn.style === "destructive";

            return (
              <AnimatedPressable
                key={index}
                style={[
                  styles.button,
                  isCancel && styles.buttonCancel,
                  isDestructive && styles.buttonDestructive,
                  !isCancel && !isDestructive && styles.buttonDefault,
                ]}
                onPress={() => {
                  if (btn.onPress) btn.onPress();
                  onRequestClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={btn.text}
              >
                <Text
                  style={[
                    styles.buttonText,
                    isCancel && styles.buttonTextCancel,
                  ]}
                >
                  {btn.text}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
    </BaseModal>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    overlay: {
      alignItems: "center",
      padding: 24,
    },
    alertBox: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
      marginBottom: 10,
      textAlign: "center",
    },
    message: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 22,
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonDefault: {
      backgroundColor: theme.colors.primary,
    },
    buttonCancel: {
      backgroundColor: theme.colors.background,
    },
    buttonDestructive: {
      backgroundColor: theme.colors.danger,
    },
    buttonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
    },
    buttonTextCancel: {
      color: theme.colors.textMuted,
    },
  });
