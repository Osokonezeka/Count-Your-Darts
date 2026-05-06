import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScoreKeyboard } from "../../components/keyboards/ScoreKeyboard";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useGameModals } from "../../hooks/useGameModals";
import { useX01Match } from "../../hooks/useX01Match";
import { t } from "../../lib/i18n";
import { Match } from "../../lib/statsUtils";

const { width } = Dimensions.get("window");

export default function TournamentMatchScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { isHapticsEnabled, intensity } = useHaptics();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation();
  const isExiting = useRef(false);

  const {
    GameAlerts,
    showExitConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  const { matchData, settingsData } = useLocalSearchParams();
  const match = matchData ? JSON.parse(matchData as string) : null;
  const initialSettings = settingsData
    ? JSON.parse(settingsData as string)
    : null;

  const [settings, setSettings] = useState(initialSettings);
  const [isFormatLoaded, setIsFormatLoaded] = useState(false);

  const {
    activePlayerId,
    currentInput,
    p1Score,
    p2Score,
    p1Throws,
    p2Throws,
    winner,
    showDoublePrompt,
    pendingTurn,
    p1ActiveMember,
    p2ActiveMember,
    handleKeyPress,
    handleDelete,
    handleEnter,
    processTurn,
  } = useX01Match(match, settings, isFormatLoaded, {
    showUndoConfirm,
    showInvalidScoreAlert,
  });

  useEffect(() => {
    const determineMatchFormat = async () => {
      if (!match || !initialSettings) {
        setIsFormatLoaded(true);
        return;
      }
      try {
        const bKey = `bracket_structure_${initialSettings.name?.replace(/\s/g, "_")}`;
        const bStr = await AsyncStorage.getItem(bKey);
        if (bStr) {
          const bracket = JSON.parse(bStr);
          const totalR = Math.max(...bracket.map((m: Match) => m.round || 0));

          let overriddenSettings = { ...initialSettings };

          if (
            initialSettings.format === "double_knockout" ||
            initialSettings.format === "groups_and_double_knockout"
          ) {
            if (initialSettings.customFinals && match.bracket === "gf") {
              overriddenSettings.targetSets = Number(initialSettings.finalSets);
              overriddenSettings.targetLegs = Number(initialSettings.finalLegs);
            } else if (initialSettings.customSemis) {
              const totalWBRounds = Math.max(
                ...bracket
                  .filter((m: Match) => m.bracket === "wb")
                  .map((m: Match) => m.round || 0),
                1,
              );
              const totalLBRounds = Math.max(
                ...bracket
                  .filter((m: Match) => m.bracket === "lb")
                  .map((m: Match) => m.round || 0),
                1,
              );
              if (
                (match.bracket === "wb" && match.round === totalWBRounds) ||
                (match.bracket === "lb" && match.round === totalLBRounds)
              ) {
                overriddenSettings.targetSets = Number(
                  initialSettings.semiSets,
                );
                overriddenSettings.targetLegs = Number(
                  initialSettings.semiLegs,
                );
              }
            }
          } else {
            if (
              initialSettings.customFinals &&
              match.round === totalR &&
              !match.isThirdPlace
            ) {
              overriddenSettings.targetSets = Number(initialSettings.finalSets);
              overriddenSettings.targetLegs = Number(initialSettings.finalLegs);
            } else if (
              initialSettings.customSemis &&
              match.round === totalR - 1 &&
              !match.isThirdPlace
            ) {
              overriddenSettings.targetSets = Number(initialSettings.semiSets);
              overriddenSettings.targetLegs = Number(initialSettings.semiLegs);
            }
          }

          setSettings(overriddenSettings);
        }
      } catch (e) {
        console.error(
          t(language, "errorLoadingPhaseSettings") ||
            "Error loading phase settings:",
          e,
        );
      }
      setIsFormatLoaded(true);
    };

    determineMatchFormat();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (winner || isExiting.current) return;
      e.preventDefault();
      handleExitRequest();
    });
    return unsubscribe;
  }, [navigation, winner]);

  const handleExitRequest = () => {
    showExitConfirm(
      () => {
        isExiting.current = true;
        router.back();
      },
      t(language, "exitMatchSub") || "Score will be saved.",
    );
  };

  const triggerHaptic = () => {
    if (isHapticsEnabled) {
      let style = Haptics.ImpactFeedbackStyle.Medium;
      if (intensity === "light") style = Haptics.ImpactFeedbackStyle.Light;
      if (intensity === "heavy") style = Haptics.ImpactFeedbackStyle.Heavy;
      Haptics.impactAsync(style);
    }
  };

  const tableRows = useMemo(() => {
    const rows = [];
    const p1Active =
      activePlayerId === match.player1.id && p1Throws.length === 0;
    const p2Active =
      activePlayerId === match.player2?.id && p2Throws.length === 0;
    rows.push(
      <View key="s" style={styles.row}>
        <View style={[styles.colScored, styles.disabledScoredCell]}>
          <Text style={styles.disabledScoredText}>-</Text>
        </View>
        <View style={[styles.colToGo, p1Active && styles.activeToGoCell]}>
          <Text style={[styles.txtToGo, p1Active && styles.activeToGoText]}>
            {settings.startingPoints}
          </Text>
        </View>
        <View style={styles.colCenter} />
        <View style={[styles.colToGo, p2Active && styles.activeToGoCell]}>
          <Text style={[styles.txtToGo, p2Active && styles.activeToGoText]}>
            {match.player2 ? settings.startingPoints : "-"}
          </Text>
        </View>
        <View style={[styles.colScored, styles.disabledScoredCell]}>
          <Text style={styles.disabledScoredText}>-</Text>
        </View>
      </View>,
    );
    const maxR = Math.max(p1Throws.length, p2Throws.length) + 1;
    let s1 = settings.startingPoints,
      s2 = settings.startingPoints;
    for (let i = 0; i < maxR; i++) {
      const t1 = p1Throws[i],
        t2 = p2Throws[i];
      if (t1 && t1 !== "BUST") s1 -= parseInt(t1);
      if (t2 && t2 !== "BUST") s2 -= parseInt(t2);
      const isP1T =
        activePlayerId === match.player1.id && i === p1Throws.length;
      const isP2T =
        activePlayerId === match.player2?.id && i === p2Throws.length;
      rows.push(
        <View key={i} style={styles.row}>
          <View style={styles.colScored}>
            <Text style={[styles.txtScored, t1 === "BUST" && styles.txtBust]}>
              {isP1T ? currentInput : t1 || ""}
            </Text>
          </View>
          <View
            style={[
              styles.colToGo,
              activePlayerId === match.player1.id &&
                i === p1Throws.length - 1 &&
                styles.activeToGoCell,
            ]}
          >
            <Text
              style={[
                styles.txtToGo,
                activePlayerId === match.player1.id &&
                  i === p1Throws.length - 1 &&
                  styles.activeToGoText,
                t1 && s1 === 0 && { color: theme.colors.warning },
              ]}
            >
              {t1 ? s1 : ""}
            </Text>
          </View>
          <View style={styles.colCenter}>
            <Text style={styles.txtDarts}>{(i + 1) * 3}</Text>
          </View>
          <View
            style={[
              styles.colToGo,
              activePlayerId === match.player2?.id &&
                i === p2Throws.length - 1 &&
                styles.activeToGoCell,
            ]}
          >
            <Text
              style={[
                styles.txtToGo,
                activePlayerId === match.player2?.id &&
                  i === p2Throws.length - 1 &&
                  styles.activeToGoText,
                t2 && s2 === 0 && { color: theme.colors.warning },
              ]}
            >
              {t2 ? s2 : ""}
            </Text>
          </View>
          <View style={styles.colScored}>
            <Text style={[styles.txtScored, t2 === "BUST" && styles.txtBust]}>
              {isP2T ? currentInput : t2 || ""}
            </Text>
          </View>
        </View>,
      );
    }
    return rows;
  }, [
    activePlayerId,
    p1Throws,
    p2Throws,
    currentInput,
    settings,
    match,
    theme,
  ]);

  if (!isFormatLoaded || !settings) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.matchHeader}>
        <TouchableOpacity onPress={handleExitRequest}>
          <Ionicons name="close" size={28} color={theme.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t(language, "firstTo") || "First to"} {settings.targetSets}{" "}
          {t(language, "setsShort") || "Sets"} / {settings.targetLegs}{" "}
          {t(language, "legsShort") || "Legs"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.playerInfoBar}>
        <View style={styles.playerInfoItem}>
          <Text
            style={[
              styles.pName,
              activePlayerId === match.player1.id && styles.pActive,
            ]}
            numberOfLines={1}
          >
            {match.player1.name}
          </Text>
          {p1ActiveMember && (
            <Text
              style={[
                styles.pMemberName,
                activePlayerId === match.player1.id && styles.pMemberActive,
              ]}
              numberOfLines={1}
            >
              {p1ActiveMember}
            </Text>
          )}
        </View>
        <View style={styles.scoreBadge}>
          {settings.targetSets > 1 && (
            <View style={styles.scoreBadgeRow}>
              <Text style={styles.scoreBadgeNum}>{p1Score.sets}</Text>
              <Text style={styles.scoreBadgeLabel}>S</Text>
              <Text style={styles.scoreBadgeNum}>{p2Score.sets}</Text>
            </View>
          )}
          <View style={styles.scoreBadgeRow}>
            <Text style={styles.scoreBadgeNum}>{p1Score.legs}</Text>
            <Text style={styles.scoreBadgeLabel}>L</Text>
            <Text style={styles.scoreBadgeNum}>{p2Score.legs}</Text>
          </View>
        </View>
        <View style={styles.playerInfoItem}>
          <Text
            style={[
              styles.pName,
              activePlayerId === match.player2?.id && styles.pActive,
            ]}
            numberOfLines={1}
          >
            {match.player2?.name || t(language, "byePlayer") || "Bye"}
          </Text>
          {p2ActiveMember && (
            <Text
              style={[
                styles.pMemberName,
                activePlayerId === match.player2?.id && styles.pMemberActive,
              ]}
              numberOfLines={1}
            >
              {p2ActiveMember}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.tableHead}>
        <Text style={styles.headLabel}>
          {t(language, "scored") || "Scored"}
        </Text>
        <Text style={styles.headLabelToGo}>
          {t(language, "toGo") || "To Go"}
        </Text>
        <View style={{ width: 40 }} />
        <Text style={styles.headLabelToGo}>
          {t(language, "toGo") || "To Go"}
        </Text>
        <Text style={styles.headLabel}>
          {t(language, "scored") || "Scored"}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {tableRows}
      </ScrollView>

      {winner && (
        <View style={styles.winOverlay}>
          <Text style={styles.winTitle}>
            {winner} {t(language, "wins") || "Wins!"}
          </Text>
          <TouchableOpacity
            style={styles.winBtn}
            onPress={() => {
              isExiting.current = true;
              router.back();
            }}
          >
            <Text style={styles.winBtnTxt}>
              {t(language, "close") || "Close"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showDoublePrompt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t(language, "doublesDarts") || "Darts at double"}
            </Text>
            <Text style={styles.modalDesc}>
              {t(language, "doublesDartsDesc") ||
                "How many darts were thrown at a double?"}
            </Text>
            <View style={styles.doublePromptActions}>
              {(() => {
                if (!pendingTurn) return null;
                let maxDarts = 3;
                const bogey2Darts = [109, 108, 106, 105, 103, 102, 99];

                if (
                  pendingTurn.currentLeft > 110 ||
                  bogey2Darts.includes(pendingTurn.currentLeft)
                ) {
                  maxDarts = 1;
                } else if (pendingTurn.currentLeft > 50) {
                  maxDarts = 2;
                }

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
                      <Text style={styles.promptSectionTitle}>
                        {t(language, "checkout") || "Checkout (Win)"}
                      </Text>
                      <View style={styles.doublePromptActions}>
                        {winOpts.map((num) => (
                          <TouchableOpacity
                            key={`win-${num}`}
                            style={[
                              styles.doubleBtn,
                              {
                                backgroundColor:
                                  theme.colors.success || "#28a745",
                              },
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              processTurn(
                                pendingTurn.isP1,
                                pendingTurn.score,
                                0,
                                false,
                                num,
                              );
                            }}
                          >
                            <Text style={styles.doubleBtnTxt}>{num}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text
                        style={[
                          styles.promptSectionTitle,
                          {
                            color: theme.colors.danger || "#dc3545",
                            marginTop: 20,
                          },
                        ]}
                      >
                        {t(language, "bust") || "Bust"}
                      </Text>
                      <View style={styles.doublePromptActions}>
                        {bustOpts.map((num) => (
                          <TouchableOpacity
                            key={`bust-${num}`}
                            style={[
                              styles.doubleBtn,
                              {
                                backgroundColor:
                                  theme.colors.danger || "#dc3545",
                              },
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              processTurn(
                                pendingTurn.isP1,
                                pendingTurn.score,
                                0,
                                true,
                                num,
                              );
                            }}
                          >
                            <Text style={styles.doubleBtnTxt}>{num}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                }

                let opts = Array.from({ length: maxDarts + 1 }, (_, i) => i);
                return opts.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.doubleBtn}
                    onPress={() => {
                      triggerHaptic();
                      processTurn(
                        pendingTurn.isP1,
                        pendingTurn.score,
                        pendingTurn.newLeft,
                        pendingTurn.isBust,
                        num,
                      );
                    }}
                  >
                    <Text style={styles.doubleBtnTxt}>{num}</Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>
        </View>
      </Modal>

      <View>
        <ScoreKeyboard
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onSubmit={handleEnter}
          theme={theme}
          hideWrapperBorder={true}
          keyStyle={{ height: 80 }}
          style={[
            styles.kb,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 0 },
          ]}
        />
      </View>

      <GameAlerts />
    </View>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    matchHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    playerInfoBar: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      backgroundColor: theme.colors.background,
    },
    playerInfoItem: { flex: 1 },
    pName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    pActive: { color: theme.colors.primary, fontSize: 20 },
    pMemberName: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textLight,
      textAlign: "center",
      marginTop: 2,
    },
    pMemberActive: {
      color: theme.colors.primary,
      opacity: 0.8,
    },
    scoreBadge: {
      backgroundColor: theme.colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 2,
    },
    scoreBadgeNum: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.textMain,
      width: 20,
      textAlign: "center",
    },
    scoreBadgeLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
      width: 14,
      textAlign: "center",
    },
    tableHead: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    headLabelToGo: {
      flex: 1.3,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      height: 55,
    },
    colScored: { flex: 1, justifyContent: "center", alignItems: "center" },
    colToGo: {
      flex: 1.3,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.card,
    },
    colCenter: {
      width: 40,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.cardBorder,
    },
    activeToGoCell: {
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.15)",
    },
    activeToGoText: { color: theme.colors.primary },
    disabledScoredCell: {
      backgroundColor: theme.colors.cardBorder,
      opacity: 0.5,
    },
    disabledScoredText: {
      color: theme.colors.textMuted,
      fontSize: 22,
      fontWeight: "600",
    },
    txtScored: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    txtToGo: { fontSize: 24, fontWeight: "900", color: theme.colors.textMain },
    txtDarts: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    txtBust: { color: "red", fontSize: 14, fontWeight: "800" },
    kb: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    winOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    winTitle: {
      color: "#fff",
      fontSize: 32,
      fontWeight: "900",
      marginBottom: 20,
    },
    winBtn: {
      backgroundColor: theme.colors.primary,
      padding: 15,
      borderRadius: 10,
    },
    winBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.colors.textMain,
      marginBottom: 8,
    },
    modalDesc: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 24,
    },
    promptSectionTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: theme.colors.success,
      marginBottom: 8,
      textTransform: "uppercase",
      textAlign: "center",
      letterSpacing: 1,
    },
    doublePromptActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      gap: 10,
    },
    doubleBtn: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
    },
    doubleBtnTxt: { color: "#fff", fontSize: 20, fontWeight: "800" },
  });
