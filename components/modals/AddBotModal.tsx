import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { getBotCheckoutChance } from "../../lib/bot";
import { t } from "../../lib/i18n";
import { AnimatedPressable } from "../common/AnimatedPressable";

interface CustomSliderProps {
  value: number;
  onValueChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  theme: { colors: Record<string, string> };
}

const CustomSlider = ({
  value,
  onValueChange,
  min,
  max,
  step,
  theme,
}: CustomSliderProps) => {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (widthRef.current > 0) {
          const tapX = e.nativeEvent.locationX;
          let newVal = min + (tapX / widthRef.current) * (max - min);
          newVal = Math.round(newVal / step) * step;
          newVal = Math.max(min, Math.min(max, newVal));

          onValueChange(newVal);
          startVal.current = newVal;
        } else {
          startVal.current = valueRef.current;
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (widthRef.current === 0) return;
        const diff = (gestureState.dx / widthRef.current) * (max - min);
        let newVal = startVal.current + diff;
        newVal = Math.round(newVal / step) * step;
        newVal = Math.max(min, Math.min(max, newVal));
        onValueChange(newVal);
      },
    }),
  ).current;

  const percentage = (value - min) / (max - min);

  return (
    <View style={{ width: "100%", paddingHorizontal: 12, marginVertical: 10 }}>
      <View
        style={{ width: "100%", height: 40, justifyContent: "center" }}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          widthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
        pointerEvents="box-only"
      >
        <View
          style={{
            height: 8,
            backgroundColor: theme.colors.cardBorder,
            borderRadius: 4,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 0,
            height: 8,
            backgroundColor: theme.colors.primary,
            borderRadius: 4,
            width: width > 0 ? percentage * width : 0,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 8,
            left: width > 0 ? percentage * width - 12 : -12,
            width: 24,
            height: 24,
            backgroundColor: "#fff",
            borderRadius: 12,
            borderWidth: 2,
            borderColor: theme.colors.primary,
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
          }}
        />
      </View>
    </View>
  );
};

export interface AddBotModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (difficulty: number) => void;
  theme: { colors: Record<string, string> };
  language: Parameters<typeof t>[0];
  gameMode: string;
  trainingMode: string;
}

const getBotValueText = (
  difficulty: number,
  isCricketMode: boolean,
  isHitPercentMode: boolean,
  isBobs27Mode: boolean,
) => {
  if (isCricketMode) {
    if (difficulty === 120) return "5.5+";
    const mpr = 2.55 * (difficulty / 120) * (0.85 * (difficulty / 120) + 1);
    return `~${mpr.toFixed(1)}`;
  }
  if (isHitPercentMode) {
    if (difficulty === 120) {
      return isBobs27Mode ? "60%+" : "95%+";
    }
    const pct = isBobs27Mode
      ? getBotCheckoutChance(difficulty) * 0.7
      : (difficulty / 120) * 90;
    return `~${Math.round(pct)}%`;
  }
  return difficulty === 120 ? "120+" : `~${difficulty}`;
};

export const AddBotModal = ({
  visible,
  onClose,
  onAdd,
  theme,
  language,
  gameMode,
  trainingMode,
}: AddBotModalProps) => {
  const [difficulty, setDifficulty] = useState(45);
  const [isAdaptive, setIsAdaptive] = useState(false);
  const styles = getStyles(theme);

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem("@last_bot_difficulty")
        .then((saved) => {
          if (saved) setDifficulty(parseInt(saved, 10));
        })
        .catch(() => {});
    }
  }, [visible]);

  const isHitPercentMode =
    gameMode === "Training" &&
    (trainingMode === "around_the_clock" || trainingMode === "bobs_27");
  const isCricketMode = gameMode === "Cricket";
  const isBobs27Mode = gameMode === "Training" && trainingMode === "bobs_27";

  const handleAddClick = async () => {
    if (!isAdaptive) {
      await AsyncStorage.setItem("@last_bot_difficulty", difficulty.toString());
      onAdd(difficulty);
    } else {
      onAdd(0);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
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
            <Text style={styles.modalTitle}>
              {t(language, "addBot") || "Add Bot"}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: isAdaptive ? 32 : 16,
              }}
            >
              <Text style={[styles.stepperLabel, { marginBottom: 0 }]}>
                {t(language, "adaptiveBot") || "Adaptive Bot"}
              </Text>
              <Switch
                value={isAdaptive}
                onValueChange={setIsAdaptive}
                trackColor={{
                  false: theme.colors.cardBorder,
                  true: theme.colors.primaryLight,
                }}
                thumbColor={
                  isAdaptive ? theme.colors.primary : theme.colors.textLight
                }
              />
            </View>

            {!isAdaptive && (
              <View
                style={{
                  marginBottom: 28,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <View style={styles.statsRow}>
                  <View style={styles.statColumn}>
                    <Text style={styles.stepperLabel}>
                      {t(language, "botLevel") || "Bot level"}
                    </Text>
                    <Text style={styles.sliderValueText}>
                      {(difficulty - 20) / 5}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statColumn}>
                    <Text style={styles.stepperLabel}>
                      {isCricketMode
                        ? "MPR"
                        : isHitPercentMode
                          ? t(language, "hitPercent") || "Hit %"
                          : t(language, "botAverage") || "Average"}
                    </Text>
                    <Text style={styles.sliderValueText}>
                      {getBotValueText(
                        difficulty,
                        isCricketMode,
                        isHitPercentMode,
                        isBobs27Mode,
                      )}
                    </Text>
                  </View>
                </View>

                <CustomSlider
                  value={difficulty}
                  onValueChange={setDifficulty}
                  min={20}
                  max={120}
                  step={5}
                  theme={theme}
                />
              </View>
            )}

            <View style={styles.modalButtons}>
              <AnimatedPressable
                onPress={onClose}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>
                  {t(language, "cancel") || "Cancel"}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleAddClick}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveText}>
                  {t(language, "add") || "Add"}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 20,
      textAlign: "center",
    },
    stepperLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
      marginBottom: 12,
      textTransform: "uppercase",
    },
    sliderValueText: {
      fontSize: 38,
      fontWeight: "900",
      color: theme.colors.primary,
      marginBottom: 4,
      letterSpacing: -1,
    },
    statsRow: {
      flexDirection: "row",
      width: "100%",
      alignItems: "center",
      justifyContent: "space-evenly",
      marginBottom: 16,
    },
    statColumn: {
      alignItems: "center",
      flex: 1,
    },
    statDivider: {
      width: 2,
      height: 40,
      backgroundColor: theme.colors.cardBorder,
      borderRadius: 2,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      alignItems: "center",
    },
    modalCancelText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "700",
    },
    modalSaveBtn: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      alignItems: "center",
    },
    modalSaveText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
    },
  });
