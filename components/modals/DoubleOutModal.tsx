import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getMaxDoubleAttemptDarts, PendingX01Turn } from "../../hooks/useX01Engine";
import { Lang, t } from "../../lib/i18n";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { BaseModal } from "./BaseModal";

export interface DoubleOutModalProps {
  visible: boolean;
  pendingTurn: PendingX01Turn | null;
  onSelect: (score: number, dartsAtDouble: number, isBust: boolean) => void;
  theme: { colors: Record<string, string> };
  language: Lang;
  maxDartsAvailable?: number;
}

export function DoubleOutModal({
  visible,
  pendingTurn,
  onSelect,
  theme,
  language,
  maxDartsAvailable = 3,
}: DoubleOutModalProps) {
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <BaseModal
      visible={visible}
      dismissableOnBackdropPress={false}
      overlayStyle={styles.overlay}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t(language, "doublesDarts")}
        </Text>
        <Text style={styles.desc}>
          {t(language, "doublesDartsDesc")}
        </Text>
        <View style={styles.actions}>
          {pendingTurn &&
            (() => {
              const maxDarts = getMaxDoubleAttemptDarts(
                pendingTurn.currentLeft,
                maxDartsAvailable,
              );

              if (pendingTurn.newLeft === 0 && !pendingTurn.isBust) {
                const winOpts = Array.from(
                  { length: maxDarts },
                  (_, i) => i + 1,
                );
                const bustOpts = Array.from(
                  { length: maxDarts + 1 },
                  (_, i) => i,
                );

                return (
                  <View style={{ width: "100%" }}>
                    <Text style={styles.sectionTitle}>
                      {t(language, "checkout")}
                    </Text>
                    <View style={styles.actions}>
                      {winOpts.map((num) => (
                        <AnimatedPressable
                          key={`win-${num}`}
                          style={[
                            styles.btn,
                            { backgroundColor: theme.colors.success },
                          ]}
                          onPress={() => onSelect(pendingTurn.score, num, false)}
                        >
                          <Text style={styles.btnTxt}>{num}</Text>
                        </AnimatedPressable>
                      ))}
                    </View>

                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: theme.colors.danger, marginTop: 20 },
                      ]}
                    >
                      {t(language, "bust")}
                    </Text>
                    <View style={styles.actions}>
                      {bustOpts.map((num) => (
                        <AnimatedPressable
                          key={`bust-${num}`}
                          style={[
                            styles.btn,
                            { backgroundColor: theme.colors.danger },
                          ]}
                          onPress={() => onSelect(pendingTurn.score, num, true)}
                        >
                          <Text style={styles.btnTxt}>{num}</Text>
                        </AnimatedPressable>
                      ))}
                    </View>
                  </View>
                );
              }

              const opts = Array.from({ length: maxDarts + 1 }, (_, i) => i);
              return opts.map((num) => (
                <AnimatedPressable
                  key={num}
                  style={styles.btn}
                  onPress={() => onSelect(pendingTurn.score, num, false)}
                >
                  <Text style={styles.btnTxt}>{num}</Text>
                </AnimatedPressable>
              ));
            })()}
        </View>
      </View>
    </BaseModal>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    overlay: {
      alignItems: "center",
    },
    content: {
      backgroundColor: theme.colors.card,
      padding: 25,
      borderRadius: 24,
      width: "100%",
      alignItems: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "900",
      textAlign: "center",
      color: theme.colors.textMain,
      marginBottom: 15,
    },
    desc: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: theme.colors.success,
      marginBottom: 8,
      textTransform: "uppercase",
      textAlign: "center",
      letterSpacing: 1,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      gap: 10,
    },
    btn: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
    },
    btnTxt: { color: "#fff", fontSize: 20, fontWeight: "800" },
  });
