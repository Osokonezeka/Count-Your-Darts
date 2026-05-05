import { Ionicons } from "@expo/vector-icons";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useHaptics } from "../../context/HapticsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSpeech } from "../../context/SpeechContext";
import { useTerminology } from "../../context/TerminologyContext";
import { useTheme } from "../../context/ThemeContext";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { availableLanguages, t } from "../../lib/i18n";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const languageNames: Record<string, string> = {
  en: "English",
  pl: "Polski",
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
            <Text style={styles.dropdownValue}>{languageNames[language]}</Text>
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
            activeOption={tripleTerm}
            onSelect={setTripleTerm}
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
            activeOption={missTerm}
            onSelect={setMissTerm}
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
            activeOption={bullTerm}
            onSelect={setBullTerm}
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
            activeOption={themeMode}
            onSelect={setThemeMode}
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

          {isHapticsEnabled && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.subLabel}>
                {t(language, "intensity") || "Intensity"}
              </Text>
              <AnimatedSegmentedControl
                theme={theme}
                activeOption={intensity}
                onSelect={setIntensity}
                options={[
                  { id: "light", label: t(language, "light") || "Light" },
                  { id: "medium", label: t(language, "medium") || "Medium" },
                  { id: "heavy", label: t(language, "heavy") || "Heavy" },
                ]}
              />
            </View>
          )}

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

        <View style={styles.infoFooter}>
          <Text style={styles.versionText}>Dart App v1.0.0</Text>
        </View>
      </ScrollView>

      <Modal
        visible={isLangModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeModal()}
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
                <Pressable
                  key={lang}
                  style={[
                    styles.langOption,
                    isSelected && styles.langOptionActive,
                  ]}
                  onPress={() => {
                    closeModal(() => changeLanguage(lang));
                  }}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      isSelected && styles.langOptionTextActive,
                    ]}
                  >
                    {languageNames[lang]}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingTop: 20, paddingBottom: 40 },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    iconWrapper: {
      width: 32,
      height: 32,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.textMain,
    },
    subLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
      marginBottom: 6,
      marginLeft: 4,
      textTransform: "uppercase",
    },
    dropdownTrigger: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    dropdownValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },

    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },

    infoFooter: { alignItems: "center", marginTop: 20 },
    versionText: {
      color: theme.colors.textLight,
      fontSize: 13,
      fontWeight: "500",
    },

    modalOverlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: { backgroundColor: "#000" },
    sheetContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      maxHeight: "80%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 20,
    },
    sheetHeader: { alignItems: "center", marginBottom: 20 },
    sheetHandle: {
      width: 40,
      height: 5,
      backgroundColor: theme.colors.cardBorder,
      borderRadius: 3,
      marginBottom: 12,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    langOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    langOptionActive: { backgroundColor: theme.colors.primaryLight },
    langOptionText: {
      fontSize: 16,
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    langOptionTextActive: { color: theme.colors.textMain, fontWeight: "700" },
  });
