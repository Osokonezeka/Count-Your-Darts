import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  DevSettings,
} from "react-native";

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSpeech } from "../../context/SpeechContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { availableLanguages, t } from "../../lib/i18n";
import CustomAlert, { AlertButton } from "../../components/modals/CustomAlert";
import { exportBackup, importBackup } from "../../lib/backupUtils";
import * as Updates from "expo-updates";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const languageNames: Record<string, string> = {
  en: "English",
  pl: "Polski",
};

export const languageFlags: Record<string, string> = {
  en: "🇬🇧",
  pl: "🇵🇱",
};

export default function Settings() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();
  const { theme, themeMode, setThemeMode } = useTheme();
  const {
    tripleTerm,
    setTripleTerm,
    missTerm,
    setMissTerm,
    bullTerm,
    setBullTerm,
  } = useTerminology();
  const { isHapticsEnabled, toggleHaptics, intensity, setIntensity } =
    useHaptics();
  const { isSpeechEnabled, toggleSpeech } = useSpeech();

  const [isLangModalVisible, setLangModalVisible] = useState(false);
  const [isFastBotEnabled, setIsFastBotEnabled] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
    onDismiss: undefined as (() => void) | undefined,
  });

  const [localTriple, setLocalTriple] = useState(tripleTerm);
  const [localMiss, setLocalMiss] = useState(missTerm);
  const [localBull, setLocalBull] = useState(bullTerm);
  const [localThemeMode, setLocalThemeMode] = useState(themeMode);

  useEffect(() => setLocalTriple(tripleTerm), [tripleTerm]);
  useEffect(() => setLocalMiss(missTerm), [missTerm]);
  useEffect(() => setLocalBull(bullTerm), [bullTerm]);
  useEffect(() => setLocalThemeMode(themeMode), [themeMode]);

  useEffect(() => {
    AsyncStorage.getItem("@fast_bot_enabled").then((val) =>
      setIsFastBotEnabled(val === "true"),
    );
  }, []);

  const toggleFastBot = async (val: boolean) => {
    setIsFastBotEnabled(val);
    await AsyncStorage.setItem("@fast_bot_enabled", val ? "true" : "false");
  };
  const animValue = useRef(new Animated.Value(0)).current;

  const openModal = () => {
    setLangModalVisible(true);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.back(0.5)),
      useNativeDriver: true,
    }).start();
  };

  const closeModal = (callback?: () => void) => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setLangModalVisible(false);
      if (callback) callback();
    });
  };

  const handleRestartApp = async () => {
    try {
      if (__DEV__) DevSettings.reload();
      else await Updates.reloadAsync();
    } catch (e) {
      console.error("Reload error:", e);
    }
  };

  const showAlert = (
    title: string,
    message: string,
    buttons?: AlertButton[],
    onDismiss?: () => void,
  ) => {
    setAlertConfig({
      title,
      message,
      buttons: buttons || [
        {
          text: t(language, "ok") || "OK",
          style: "default",
          onPress: () => setAlertVisible(false),
        },
      ],
      onDismiss,
    });
    setAlertVisible(true);
  };

  const handleExport = async () => {
    try {
      await exportBackup();
    } catch (error) {
      showAlert(
        t(language, "error") || "Error",
        t(language, "exportError") || "Error during data export.",
      );
    }
  };

  const handleImport = async () => {
    try {
      const success = await importBackup();
      if (success) {
        showAlert(
          t(language, "dataManagement") || "Data Management",
          t(language, "importSuccess") ||
            "Data successfully imported! Please restart the app.",
          [
            {
              text: t(language, "restartApp") || "Restart App",
              style: "default",
              onPress: handleRestartApp,
            },
          ],
          handleRestartApp,
        );
      }
    } catch (error) {
      showAlert(
        t(language, "error") || "Error",
        t(language, "importError") ||
          "Invalid file or error during data import.",
      );
    }
  };

  const handleHardReset = () => {
    showAlert(
      t(language, "hardResetConfirmTitle") || "Wipe All Data?",
      t(language, "hardResetConfirmMessage") ||
        "This action cannot be undone. Are you sure you want to permanently delete all data from this device?",
      [
        {
          text: t(language, "cancel") || "Cancel",
          style: "cancel",
          onPress: () => setAlertVisible(false),
        },
        {
          text: t(language, "deletePermanently") || "Delete permanently",
          style: "destructive",
          onPress: async () => {
            setAlertVisible(false);
            await AsyncStorage.clear();
            showAlert(
              t(language, "hardReset") || "Wipe All Data",
              t(language, "hardResetSuccess") ||
                "All data has been wiped. Please restart the app.",
              [
                {
                  text: t(language, "restartApp") || "Restart App",
                  style: "default",
                  onPress: handleRestartApp,
                },
              ],
              handleRestartApp,
            );
          },
        },
      ],
    );
  };

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const sheetTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.8, 0],
  });

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name="globe-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {t(language, "language") || "Language"}
            </Text>
          </View>

          <Pressable style={styles.dropdownTrigger} onPress={openModal}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{languageFlags[language]}</Text>
              <Text style={styles.dropdownValue}>
                {languageNames[language]}
              </Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={20}
              color={theme.colors.textLight}
            />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name="text-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {t(language, "terminology") || "Terminology"}
            </Text>
          </View>

          <Text style={styles.subLabel}>
            {t(language, "x3Multiplier") || "X3 Multiplier"}
          </Text>
          <AnimatedSegmentedControl
            theme={theme}
            activeOption={localTriple}
            onSelect={(val) => {
              setLocalTriple(val as "Triple" | "Treble");
              setTimeout(() => setTripleTerm(val as "Triple" | "Treble"), 50);
            }}
            options={[
              { id: "Triple", label: t(language, "triple") || "Triple" },
              { id: "Treble", label: t(language, "treble") || "Treble" },
            ]}
          />

          <Text style={[styles.subLabel, { marginTop: 16 }]}>
            {t(language, "miss") || "Miss"}
          </Text>
          <AnimatedSegmentedControl
            theme={theme}
            activeOption={localMiss}
            onSelect={(val) => {
              setLocalMiss(val as "0" | "Miss");
              setTimeout(() => setMissTerm(val as "0" | "Miss"), 50);
            }}
            options={[
              { id: "0", label: "0" },
              { id: "Miss", label: t(language, "miss") || "Miss" },
            ]}
          />

          <Text style={[styles.subLabel, { marginTop: 16 }]}>
            {t(language, "bullseye") || "Bullseye"}
          </Text>
          <AnimatedSegmentedControl
            theme={theme}
            activeOption={localBull}
            onSelect={(val) => {
              setLocalBull(val as "25" | "Bull");
              setTimeout(() => setBullTerm(val as "25" | "Bull"), 50);
            }}
            options={[
              { id: "25", label: "25" },
              { id: "Bull", label: t(language, "bull") || "Bull" },
            ]}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name="color-palette-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {t(language, "theme") || "Theme"}
            </Text>
          </View>

          <AnimatedSegmentedControl
            theme={theme}
            activeOption={localThemeMode}
            onSelect={(val) => {
              setLocalThemeMode(val as "light" | "auto" | "dark");
              setTimeout(
                () => setThemeMode(val as "light" | "auto" | "dark"),
                50,
              );
            }}
            options={[
              {
                id: "light",
                label: t(language, "lightTheme") || "Light",
                icon: (isActive: boolean) => (
                  <Ionicons
                    name="sunny"
                    size={18}
                    color={isActive ? "#fff" : theme.colors.textMuted}
                  />
                ),
              },
              {
                id: "auto",
                label: t(language, "autoTheme") || "Auto",
                icon: (isActive: boolean) => (
                  <Ionicons
                    name="contrast"
                    size={18}
                    color={isActive ? "#fff" : theme.colors.textMuted}
                  />
                ),
              },
              {
                id: "dark",
                label: t(language, "darkTheme") || "Dark",
                icon: (isActive: boolean) => (
                  <Ionicons
                    name="moon"
                    size={18}
                    color={isActive ? "#fff" : theme.colors.textMuted}
                  />
                ),
              },
            ]}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name="settings-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {t(language, "preferences") || "Preferences"}
            </Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="volume-high-outline"
                size={22}
                color={theme.colors.textMuted}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.settingLabel}>
                {t(language, "speech") || "Announcer"}
              </Text>
            </View>
            <Switch
              value={isSpeechEnabled}
              onValueChange={toggleSpeech}
              trackColor={{
                false: theme.colors.cardBorder,
                true: theme.colors.primaryLight,
              }}
              thumbColor={
                isSpeechEnabled ? theme.colors.primary : theme.colors.textLight
              }
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="phone-portrait-outline"
                size={22}
                color={theme.colors.textMuted}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.settingLabel}>
                {t(language, "vibrations") || "Haptics & Vibrations"}
              </Text>
            </View>
            <Switch
              value={isHapticsEnabled}
              onValueChange={toggleHaptics}
              trackColor={{
                false: theme.colors.cardBorder,
                true: theme.colors.primaryLight,
              }}
              thumbColor={
                isHapticsEnabled ? theme.colors.primary : theme.colors.textLight
              }
            />
          </View>

      <View style={{ marginTop: 20, display: isHapticsEnabled ? "flex" : "none" }}>
        <Text style={styles.subLabel}>
          {t(language, "intensity") || "Intensity"}
        </Text>
        <AnimatedSegmentedControl
          theme={theme}
          activeOption={intensity}
          onSelect={(val) =>
            setIntensity(val as "light" | "medium" | "heavy")
          }
          options={[
            { id: "light", label: t(language, "light") || "Light" },
            { id: "medium", label: t(language, "medium") || "Medium" },
            { id: "heavy", label: t(language, "heavy") || "Heavy" },
          ]}
        />
      </View>

          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="flash-outline"
                size={22}
                color={theme.colors.textMuted}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.settingLabel}>
                {t(language, "fastBot") || "Fast bot throw"}
              </Text>
            </View>
            <Switch
              value={isFastBotEnabled}
              onValueChange={toggleFastBot}
              trackColor={{
                false: theme.colors.cardBorder,
                true: theme.colors.primaryLight,
              }}
              thumbColor={
                isFastBotEnabled ? theme.colors.primary : theme.colors.textLight
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrapper}>
              <Ionicons
                name="save-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {t(language, "dataManagement") || "Data Management"}
            </Text>
          </View>

          <AnimatedPressable style={styles.actionButton} onPress={handleExport}>
            <View style={styles.actionIconWrapper}>
              <Ionicons
                name="cloud-upload-outline"
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>
                {t(language, "exportData") || "Export Backup"}
              </Text>
              <Text style={styles.actionDesc}>
                {t(language, "exportDesc") || "Save a backup to a file"}
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable style={styles.actionButton} onPress={handleImport}>
            <View style={styles.actionIconWrapper}>
              <Ionicons
                name="cloud-download-outline"
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>
                {t(language, "importData") || "Import Backup"}
              </Text>
              <Text style={styles.actionDesc}>
                {t(language, "importDesc") || "Restore data from file"}
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.actionButton, { borderBottomWidth: 0 }]}
            onPress={handleHardReset}
          >
            <View
              style={[
                styles.actionIconWrapper,
                {
                  backgroundColor:
                    theme.colors.dangerLight || "rgba(255, 59, 48, 0.15)",
                },
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={theme.colors.danger || "#ff3b30"}
              />
            </View>
            <View style={styles.actionTextContainer}>
              <Text
                style={[
                  styles.actionTitle,
                  { color: theme.colors.danger || "#ff3b30" },
                ]}
              >
                {t(language, "hardReset") || "Wipe All Data"}
              </Text>
              <Text style={styles.actionDesc}>
                {t(language, "hardResetDesc") ||
                  "Permanently delete all players, history, and settings"}
              </Text>
            </View>
          </AnimatedPressable>
        </View>

        <View style={styles.infoFooter}>
          <Text style={styles.versionText}>Count Your Darts v1.0.0</Text>
        </View>
      </ScrollView>

      <Modal
        visible={isLangModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeModal()}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.backdrop,
              { opacity: backdropOpacity },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => closeModal()}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetContent,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {t(language, "selectLanguage") || "Select Language"}
              </Text>
            </View>

            {availableLanguages.map((lang) => {
              const isSelected = language === lang;
              return (
                <AnimatedPressable
                  key={lang}
                  style={[
                    styles.langOption,
                    isSelected && styles.langOptionActive,
                  ]}
                  onPress={() => {
                    closeModal(() => changeLanguage(lang));
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{languageFlags[lang]}</Text>
                    <Text
                      style={[
                        styles.langOptionText,
                        isSelected && styles.langOptionTextActive,
                      ]}
                    >
                      {languageNames[lang]}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.colors.primary}
                    />
                  )}
                </AnimatedPressable>
              );
            })}
          </Animated.View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onRequestClose={() => {
          setAlertVisible(false);
          if (alertConfig.onDismiss) {
            alertConfig.onDismiss();
          }
        }}
      />
    </View>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    dropdownTrigger: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    dropdownValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    subLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    actionIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    actionTextContainer: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textMain,
      marginBottom: 2,
    },
    actionDesc: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    infoFooter: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 40,
    },
    versionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textLight,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      backgroundColor: "#000",
    },
    sheetContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    sheetHeader: {
      alignItems: "center",
      marginBottom: 20,
    },
    sheetHandle: {
      width: 40,
      height: 5,
      backgroundColor: theme.colors.cardBorder,
      borderRadius: 3,
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    langOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      marginBottom: 8,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    langOptionActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.05)",
    },
    langOptionText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    langOptionTextActive: {
      color: theme.colors.primary,
      fontWeight: "800",
    },
  });
