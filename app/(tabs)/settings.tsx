import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Linking,
  TextInput,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  DevSettings,
} from "react-native";

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { getSharedScreenStyles } from "../../components/common/SharedScreenStyles";
import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSpeech } from "../../context/SpeechContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { availableLanguages, t, Lang } from "../../lib/i18n";
import CustomAlert from "../../components/modals/CustomAlert";
import { useAlert } from "../../hooks/useAlert";
import { exportBackup, importBackup } from "../../lib/backupUtils";
import * as Updates from "expo-updates";
import { parseFirebaseConfig } from "../../lib/firebaseDynamic";

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

  const [isConfigModalVisible, setConfigModalVisible] = useState(false);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState("");
  const [isDeviceNameModalVisible, setDeviceNameModalVisible] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState("");

  const { showAlert, hideAlert, alertProps } = useAlert(language);

  const [localTriple, setLocalTriple] = useState(tripleTerm);
  const [localMiss, setLocalMiss] = useState(missTerm);
  const [localBull, setLocalBull] = useState(bullTerm);
  const [localThemeMode, setLocalThemeMode] = useState(themeMode);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    terminology: false,
    preferences: true,
    dataManagement: false,
    multiplayer: false,
  });

  useEffect(() => setLocalTriple(tripleTerm), [tripleTerm]);
  useEffect(() => setLocalMiss(missTerm), [missTerm]);
  useEffect(() => setLocalBull(bullTerm), [bullTerm]);
  useEffect(() => setLocalThemeMode(themeMode), [themeMode]);

  useEffect(() => {
    AsyncStorage.getItem("@fast_bot_enabled").then((val) =>
      setIsFastBotEnabled(val === "true"),
    );
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("@settings_sections_open").then((val) => {
      if (val) setOpenSections((prev) => ({ ...prev, ...JSON.parse(val) }));
    });
  }, []);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const newState = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem("@settings_sections_open", JSON.stringify(newState));
      return newState;
    });
  };

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

  const handleExport = async () => {
    const result = await exportBackup(language as Lang);
    if (result.success) {
      showAlert(
        t(language, "dataManagement"),
        t(language, "exportSuccess"),
      );
    } else if (result.error) {
      showAlert(t(language, "error"), result.error);
    }
  };

  const handleImport = async () => {
    const result = await importBackup(language as Lang);
    if (result.success) {
      showAlert(
        t(language, "dataManagement"),
        t(language, "importSuccess"),
        [
          {
            text: t(language, "restartApp"),
            style: "default",
            onPress: handleRestartApp,
          },
        ],
        handleRestartApp,
      );
    } else if (result.error) {
      showAlert(t(language, "error"), result.error);
    }
  };

  const handleHardReset = () => {
    showAlert(
      t(language, "hardResetConfirmTitle"),
      t(language, "hardResetConfirmMessage"),
      [
        {
          text: t(language, "cancel"),
          style: "cancel",
          onPress: hideAlert,
        },
        {
          text: t(language, "deletePermanently"),
          style: "destructive",
          onPress: async () => {
            hideAlert();
            await AsyncStorage.clear();
            showAlert(
              t(language, "hardReset"),
              t(language, "hardResetSuccess"),
              [
                {
                  text: t(language, "restartApp"),
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

  const openHostConfig = async () => {
    const savedConfig = await AsyncStorage.getItem("@firebase_host_config");
    if (savedConfig) setFirebaseConfigStr(savedConfig);
    else setFirebaseConfigStr("");
    setConfigModalVisible(true);
  };

  const saveHostConfig = async () => {
    if (firebaseConfigStr.trim().length > 0) {
      try {
        const parsed = parseFirebaseConfig(firebaseConfigStr);
        await AsyncStorage.setItem(
          "@firebase_host_config",
          JSON.stringify(parsed, null, 2),
        );
      } catch (error) {
        setConfigModalVisible(false);
        setTimeout(
          () =>
            showAlert(
              t(language, "error"),
              t(language, "invalidFirebaseConfig"),
            ),
          400,
        );
        return;
      }
    } else {
      await AsyncStorage.removeItem("@firebase_host_config");
    }
    setConfigModalVisible(false);
  };

  const openDeviceNameConfig = async () => {
    const name = await AsyncStorage.getItem("@device_name");
    if (name) setDeviceNameInput(name);
    else
      setDeviceNameInput(
        `${Platform.OS === "ios" ? "iOS" : "Android"} Device ${Math.floor(Math.random() * 1000)}`,
      );
    setDeviceNameModalVisible(true);
  };

  const saveDeviceNameConfig = async () => {
    const trimmed = deviceNameInput.trim();
    if (trimmed.length > 0) await AsyncStorage.setItem("@device_name", trimmed);
    else await AsyncStorage.removeItem("@device_name");
    setDeviceNameModalVisible(false);
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
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {t(language, "language")}
              </Text>
            </View>
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
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {t(language, "theme")}
              </Text>
            </View>
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
                label: t(language, "lightTheme"),
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
                label: t(language, "autoTheme"),
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
                label: t(language, "darkTheme"),
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
          <Pressable
            style={[
              styles.cardHeader,
              !openSections.preferences && { marginBottom: 0 },
            ]}
            onPress={() => toggleSection("preferences")}
          >
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {t(language, "preferences")}
              </Text>
            </View>
            <Ionicons
              name={openSections.preferences ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {openSections.preferences && (
            <>
              <View style={styles.settingRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="volume-high-outline"
                    size={22}
                    color={theme.colors.textMuted}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.settingLabel}>
                    {t(language, "speech")}
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
                    isSpeechEnabled
                      ? theme.colors.primary
                      : theme.colors.textLight
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
                    {t(language, "vibrations")}
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
                    isHapticsEnabled
                      ? theme.colors.primary
                      : theme.colors.textLight
                  }
                />
              </View>

              <View
                style={{
                  marginTop: 20,
                  display: isHapticsEnabled ? "flex" : "none",
                }}
              >
                <Text style={styles.subLabel}>
                  {t(language, "intensity")}
                </Text>
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={intensity}
                  onSelect={(val) =>
                    setIntensity(val as "light" | "medium" | "heavy")
                  }
                  options={[
                    { id: "light", label: t(language, "light") },
                    { id: "medium", label: t(language, "medium") },
                    { id: "heavy", label: t(language, "heavy") },
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
                    {t(language, "fastBot")}
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
                    isFastBotEnabled
                      ? theme.colors.primary
                      : theme.colors.textLight
                  }
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Pressable
            style={[
              styles.cardHeader,
              !openSections.terminology && { marginBottom: 0 },
            ]}
            onPress={() => toggleSection("terminology")}
          >
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="text-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {t(language, "terminology")}
              </Text>
            </View>
            <Ionicons
              name={openSections.terminology ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {openSections.terminology && (
            <>
              <Text style={styles.subLabel}>
                {t(language, "x3Multiplier")}
              </Text>
              <AnimatedSegmentedControl
                theme={theme}
                activeOption={localTriple}
                onSelect={(val) => {
                  setLocalTriple(val as "Triple" | "Treble");
                  setTimeout(
                    () => setTripleTerm(val as "Triple" | "Treble"),
                    50,
                  );
                }}
                options={[
                  { id: "Triple", label: t(language, "triple") },
                  { id: "Treble", label: t(language, "treble") },
                ]}
              />

              <Text style={[styles.subLabel, { marginTop: 16 }]}>
                {t(language, "miss")}
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
                  { id: "Miss", label: t(language, "miss") },
                ]}
              />

              <Text style={[styles.subLabel, { marginTop: 16 }]}>
                {t(language, "bullseye")}
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
                  { id: "Bull", label: t(language, "bull") },
                ]}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Pressable
            style={[
              styles.cardHeader,
              !openSections.multiplayer && { marginBottom: 0 },
            ]}
            onPress={() => toggleSection("multiplayer")}
          >
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {t(language, "multiplayerOptions")}
              </Text>
            </View>
            <Ionicons
              name={openSections.multiplayer ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {openSections.multiplayer && (
            <>
              <AnimatedPressable
                style={styles.actionButton}
                onPress={openDeviceNameConfig}
              >
                <View style={styles.actionIconWrapper}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>
                    {t(language, "setDeviceName")}
                  </Text>
                  <Text style={styles.actionDesc}>
                    {t(language, "deviceNameDesc")}
                  </Text>
                </View>
              </AnimatedPressable>

              <AnimatedPressable
                style={[styles.actionButton, { borderBottomWidth: 0 }]}
                onPress={openHostConfig}
              >
                <View style={styles.actionIconWrapper}>
                  <Ionicons
                    name="server-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>
                    {t(language, "configureHostServer")}
                  </Text>
                  <Text style={styles.actionDesc}>
                    {t(language, "firebaseConfigDesc")}
                  </Text>
                </View>
              </AnimatedPressable>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Pressable
            style={[
              styles.cardHeader,
              !openSections.dataManagement && { marginBottom: 0 },
            ]}
            onPress={() => toggleSection("dataManagement")}
          >
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>
                {t(language, "dataManagement")}
              </Text>
            </View>
            <Ionicons
              name={openSections.dataManagement ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {openSections.dataManagement && (
            <>
              <AnimatedPressable
                style={styles.actionButton}
                onPress={handleExport}
              >
                <View style={styles.actionIconWrapper}>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>
                    {t(language, "exportData")}
                  </Text>
                  <Text style={styles.actionDesc}>
                    {t(language, "exportDesc")}
                  </Text>
                </View>
              </AnimatedPressable>

              <AnimatedPressable
                style={styles.actionButton}
                onPress={handleImport}
              >
                <View style={styles.actionIconWrapper}>
                  <Ionicons
                    name="cloud-download-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>
                    {t(language, "importData")}
                  </Text>
                  <Text style={styles.actionDesc}>
                    {t(language, "importDesc")}
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
                      backgroundColor: theme.colors.dangerLight,
                    },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color={theme.colors.danger}
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text
                    style={[
                      styles.actionTitle,
                      { color: theme.colors.danger },
                    ]}
                  >
                    {t(language, "hardReset")}
                  </Text>
                  <Text style={styles.actionDesc}>
                    {t(language, "hardResetDesc")}
                  </Text>
                </View>
              </AnimatedPressable>
            </>
          )}
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
                {t(language, "selectLanguage")}
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

      <Modal
        visible={isDeviceNameModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlayCenter}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setDeviceNameModalVisible(false)}
          />
          <View style={styles.modalContentCenter}>
            <Text style={styles.modalTitleCenter}>
              {t(language, "deviceNameConfig")}
            </Text>
            <Text style={styles.modalDescCenter}>
              {t(language, "deviceNameDesc")}
            </Text>
            <TextInput
              style={styles.deviceNameInput}
              placeholder={
                t(language, "deviceNamePlaceholder")
              }
              placeholderTextColor={theme.colors.textMuted}
              value={deviceNameInput}
              onChangeText={setDeviceNameInput}
              maxLength={30}
            />
            <View style={styles.modalActions}>
              <AnimatedPressable
                style={styles.modalBtnCancel}
                onPress={() => setDeviceNameModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>
                  {t(language, "cancel")}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.modalBtnSave}
                onPress={saveDeviceNameConfig}
              >
                <Text style={styles.modalBtnSaveText}>
                  {t(language, "save")}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isConfigModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlayCenter}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setConfigModalVisible(false)}
          />
          <View style={styles.modalContentCenter}>
            <Text style={styles.modalTitleCenter}>
              {t(language, "databaseConfigHost")}
            </Text>
            <Text style={styles.modalDescCenter}>
              {t(language, "firebaseConfigDesc")}
            </Text>
            <TextInput
              style={styles.configInput}
              multiline
              placeholder='{"apiKey": "...", "projectId": "..."}'
              placeholderTextColor={theme.colors.textMuted}
              value={firebaseConfigStr}
              onChangeText={setFirebaseConfigStr}
            />
            <View style={styles.modalActions}>
              <AnimatedPressable
                style={styles.modalBtnTutorial}
                onPress={() => Linking.openURL("https://example.com/tutorial")}
              >
                <Text style={styles.modalBtnTutorialText}>
                  {t(language, "tutorial")}
                </Text>
              </AnimatedPressable>
              <View style={styles.modalActionsRight}>
                <AnimatedPressable
                  style={styles.modalBtnCancel}
                  onPress={() => setConfigModalVisible(false)}
                >
                  <Text style={styles.modalBtnCancelText}>
                    {t(language, "cancel")}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.modalBtnSave}
                  onPress={saveHostConfig}
                >
                  <Text style={styles.modalBtnSaveText}>
                    {t(language, "save")}
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert {...alertProps} />
    </View>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) => {
  const shared = getSharedScreenStyles(theme);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
      ...shared.card,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    cardHeader: {
      ...shared.cardHeader,
      marginBottom: 16,
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryLight,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    sectionTitle: {
      ...shared.sectionTitle,
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
      backgroundColor: theme.colors.primaryLight,
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
    modalOverlayCenter: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      padding: 20,
    },
    modalContentCenter: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
    },
    modalTitleCenter: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
      marginBottom: 10,
    },
    modalDescCenter: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginBottom: 20,
    },
    configInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      height: 150,
      color: theme.colors.textMain,
      textAlignVertical: "top",
    },
    deviceNameInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      color: theme.colors.textMain,
      fontSize: 16,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
    },
    modalActionsRight: {
      flexDirection: "row",
      gap: 12,
    },
    modalBtnTutorial: { padding: 12, borderRadius: 8 },
    modalBtnTutorialText: {
      color: theme.colors.primary,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    modalBtnCancel: { padding: 12, borderRadius: 8 },
    modalBtnCancelText: { color: theme.colors.textMuted, fontWeight: "700" },
    modalBtnSave: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    modalBtnSaveText: { color: "#fff", fontWeight: "700" },
  });
};
