import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CustomAlert from "../../components/CustomAlert";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

type TournamentFormat =
  | "single_knockout"
  | "double_knockout"
  | "round_robin"
  | "groups_and_knockout"
  | "groups_and_double_knockout";
type TeamSize = "single" | "team";
type BracketOrder = "top_to_bottom" | "bottom_to_top";

export default function TournamentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = getStyles(theme);
  const navigation = useNavigation();

  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [isSavedModalVisible, setSavedModalVisible] = useState(false);
  const [deleteAlert, setDeleteAlert] = useState({
    visible: false,
    title: "",
    message: "",
    buttons: [] as any[],
  });
  const [mode, setMode] = useState<"none" | "local" | "multi" | "host">("none");
  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const isExiting = useRef(false);

  const nameInputRef = useRef<TextInput>(null);
  const [nameError, setNameError] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState(new Date());

  const [config, setConfig] = useState({
    name: "",
    desc: "",
    startDate: new Date(),
    format: "single_knockout" as TournamentFormat,
    teamSize: "single" as TeamSize,
    targetSets: 1,
    targetLegs: 3,
    startingPoints: 501,
    customGroups: false,
    groupSets: 1,
    groupLegs: 2,
    groupPoints: 501,
    customSemis: false,
    semiSets: 1,
    semiLegs: 4,
    customFinals: false,
    finalSets: 1,
    finalLegs: 5,
    thirdPlaceMatch: false,
    bracketOrder: "top_to_bottom" as BracketOrder,
  });

  useFocusEffect(
    useCallback(() => {
      const loadTournaments = async () => {
        try {
          const savedArr = await AsyncStorage.getItem("@active_tournaments");
          if (savedArr) {
            setActiveTournaments(JSON.parse(savedArr));
          } else {
            const oldSaved = await AsyncStorage.getItem("@active_tournament");
            if (oldSaved) {
              const parsed = JSON.parse(oldSaved);
              setActiveTournaments([parsed]);
              await AsyncStorage.setItem(
                "@active_tournaments",
                JSON.stringify([parsed]),
              );
              await AsyncStorage.removeItem("@active_tournament");
            } else {
              setActiveTournaments([]);
            }
          }
        } catch (error) {
          console.error("Błąd podczas ładowania turniejów", error);
        }
      };
      loadTournaments();
    }, []),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current) {
        return;
      }

      if (mode === "none") {
        return;
      }

      e.preventDefault();
      handleBackFromSettings();
    });
    return unsubscribe;
  }, [navigation, mode]);

  const handleDeleteTournament = (tName: string) => {
    setDeleteAlert({
      visible: true,
      title: t(language, "deleteTournament") || "Delete tournament",
      message:
        t(language, "deleteTournamentPrompt")?.replace("{{name}}", tName) ||
        `Are you sure you want to delete tournament '${tName}'? All results will be permanently lost.`,
      buttons: [
        {
          text: t(language, "cancel") || "Cancel",
          style: "cancel",
          onPress: () =>
            setDeleteAlert((prev: any) => ({ ...prev, visible: false })),
        },
        {
          text: t(language, "delete") || "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleteAlert((prev: any) => ({ ...prev, visible: false }));

            const updated = activeTournaments.filter(
              (t) => t.settings.name !== tName,
            );
            setActiveTournaments(updated);
            await AsyncStorage.setItem(
              "@active_tournaments",
              JSON.stringify(updated),
            );

            const bracketKey = `bracket_structure_${tName.replace(/\s/g, "_")}`;
            const selectedPlayersKey = `@dart_selected_players_${tName.replace(/\s/g, "_")}`;
            const keysToRemove = [bracketKey, selectedPlayersKey];

            const bracketStr = await AsyncStorage.getItem(bracketKey);
            if (bracketStr) {
              const bracket = JSON.parse(bracketStr);
              if (Array.isArray(bracket)) {
                bracket.forEach((m: any) =>
                  keysToRemove.push(`match_save_${m.id}`),
                );
              }
            }
            await AsyncStorage.multiRemove(keysToRemove);

            if (updated.length === 0) setSavedModalVisible(false);
            isExiting.current = true;
          },
        },
      ],
    });
  };

  const updateConfig = (key: keyof typeof config, value: any) =>
    setConfig((prev: any) => ({ ...prev, [key]: value }));

  const resetSettings = () => {
    setConfig({
      name: "",
      desc: "",
      startDate: new Date(),
      format: "single_knockout",
      teamSize: "single",
      targetSets: 1,
      targetLegs: 3,
      startingPoints: 501,
      customGroups: false,
      groupSets: 1,
      groupLegs: 2,
      groupPoints: 501,
      customSemis: false,
      semiSets: 1,
      semiLegs: 4,
      customFinals: false,
      finalSets: 1,
      finalLegs: 5,
      thirdPlaceMatch: false,
      bracketOrder: "top_to_bottom",
    });
    setNameError(false);
  };

  const handleBackFromSettings = () => {
    resetSettings();
    if (mode === "host") setMode("multi");
    else setMode("none");
  };

  const openDatePicker = () => {
    setTempDate(config.startDate);
    if (Platform.OS === "android") setPickerMode("date");
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "ios") {
      if (selectedDate) setTempDate(selectedDate);
      return;
    }
    if (event.type === "set" && selectedDate) {
      if (pickerMode === "date") {
        const newDate = new Date(config.startDate);
        newDate.setFullYear(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        );
        updateConfig("startDate", newDate);
        setShowDatePicker(false);
        setPickerMode("time");
        setTimeout(() => setShowDatePicker(true), 50);
      } else {
        const newDate = new Date(config.startDate);
        newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
        updateConfig("startDate", newDate);
        setShowDatePicker(false);
      }
    } else setShowDatePicker(false);
  };

  const isKnockoutFormat = config.format.includes("knockout");

  if (mode === "none") {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitleMain}>
          {t(language, "selectTournamentMode") || "Select tournament mode"}
        </Text>
        <TouchableOpacity
          style={styles.modeCard}
          activeOpacity={0.7}
          onPress={() => {
            resetSettings();
            setMode("local");
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="people" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.modeTitle}>
            {t(language, "localGame") || "Local game"}
          </Text>
          <Text style={styles.modeDesc}>
            {t(language, "localGameDesc") ||
              "Play on the same device. Perfect for playing at one board."}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modeCard}
          activeOpacity={0.7}
          onPress={() => setMode("multi")}
        >
          <View style={styles.iconWrapper}>
            <Ionicons
              name="phone-portrait-outline"
              size={48}
              color={theme.colors.primary}
            />
            <View style={styles.wifiIconSub}>
              <Ionicons name="wifi" size={20} color={theme.colors.card} />
            </View>
          </View>
          <Text style={styles.modeTitle}>
            {t(language, "multiGame") || "Multiplayer game"}
          </Text>
          <Text style={styles.modeDesc}>
            {t(language, "multiGameDesc") ||
              "Each player uses their own phone. Create a room and invite friends."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.historyBtn}
          activeOpacity={0.8}
          onPress={() => router.push("/tournament/history")}
        >
          <Ionicons
            name="archive-outline"
            size={24}
            color={theme.colors.primary}
          />
          <Text style={styles.historyBtnText}>
            {t(language, "tournamentHistory") || "Tournament History"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === "multi") {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            onPress={() => setMode("none")}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.textMain}
            />
            <Text style={styles.backButtonText}>
              {t(language, "changeMode") || "Change mode"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitleMain}>
            {t(language, "multiplayerOptions") || "Multiplayer options"}
          </Text>
          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.7}
            onPress={() => {
              resetSettings();
              setMode("host");
            }}
          >
            <View style={styles.iconWrapper}>
              <Ionicons
                name="add-circle"
                size={48}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.modeTitle}>
              {t(language, "hostGame") || "Host game"}
            </Text>
            <Text style={styles.modeDesc}>
              {t(language, "hostGameDesc") ||
                "Create a new room, set rules and share the code with friends."}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modeCard}
            activeOpacity={0.7}
            onPress={() => setJoinModalVisible(true)}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="log-in" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.modeTitle}>
              {t(language, "joinGame") || "Join game"}
            </Text>
            <Text style={styles.modeDesc}>
              {t(language, "joinGameDesc") ||
                "Already have a code from a friend? Enter it here to join the lobby."}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <TouchableOpacity
          onPress={handleBackFromSettings}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === "host"
            ? t(language, "newRoom") || "New room"
            : t(language, "newTournament") || "New tournament"}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTournaments.length > 0 && (
          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.8}
            onPress={() => setSavedModalVisible(true)}
          >
            <Ionicons name="list" size={24} color="#fff" />
            <Text style={styles.continueBtnText}>
              {t(language, "unfinishedTournaments") || "Unfinished tournaments"}{" "}
              ({activeTournaments.length})
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t(language, "basicInfo") || "Basic information"}
          </Text>

          <Text
            style={[
              styles.inputLabel,
              nameError && { color: theme.colors.danger || "red" },
            ]}
          >
            {t(language, "tournamentName") || "Tournament name"}{" "}
            {nameError && "*"}
          </Text>
          <TextInput
            ref={nameInputRef}
            style={[styles.textInput, nameError && styles.textInputError]}
            placeholder={
              t(language, "tournamentNamePlaceholder") ||
              "e.g. Garage Championship 2024"
            }
            placeholderTextColor={
              nameError ? "rgba(220, 53, 69, 0.5)" : theme.colors.textMuted
            }
            value={config.name}
            onChangeText={(text) => {
              updateConfig("name", text);
              if (nameError) setNameError(false);
            }}
          />

          <Text style={styles.inputLabel}>
            {t(language, "startDate") || "Start date"}
          </Text>
          <TouchableOpacity
            style={styles.dateSelector}
            activeOpacity={0.7}
            onPress={openDatePicker}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.dateText}>
              {config.startDate.toLocaleDateString()}{" "}
              {config.startDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </TouchableOpacity>

          <View style={styles.descHeader}>
            <Text style={styles.inputLabel}>
              {t(language, "description") || "Description"}
            </Text>
            <Text style={styles.charCount}>{config.desc.length}/500</Text>
          </View>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder={
              t(language, "tournamentDescPlaceholder") ||
              "Additional info, prizes, rules of conduct..."
            }
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
            value={config.desc}
            onChangeText={(text) => updateConfig("desc", text)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t(language, "structure") || "Structure"}
          </Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                config.teamSize === "single" && styles.segmentBtnActive,
              ]}
              onPress={() => updateConfig("teamSize", "single")}
            >
              <Text
                style={[
                  styles.segmentText,
                  config.teamSize === "single" && styles.segmentTextActive,
                ]}
              >
                {t(language, "singleFormat") || "1 vs 1 (Single)"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                config.teamSize === "team" && styles.segmentBtnActive,
              ]}
              onPress={() => updateConfig("teamSize", "team")}
            >
              <Text
                style={[
                  styles.segmentText,
                  config.teamSize === "team" && styles.segmentTextActive,
                ]}
              >
                {t(language, "pairsFormat") || "2 vs 2 (Pairs)"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.formatGrid, { marginTop: 16 }]}>
            {(
              [
                "single_knockout",
                "double_knockout",
                "round_robin",
                "groups_and_knockout",
              ] as TournamentFormat[]
            ).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.formatBtn,
                  config.format === f && styles.formatBtnActive,
                ]}
                onPress={() => updateConfig("format", f)}
              >
                <Text
                  style={[
                    styles.formatText,
                    config.format === f && styles.formatTextActive,
                  ]}
                >
                  {f === "single_knockout" &&
                    (t(language, "singleKnockout") || "Single Knockout")}
                  {f === "double_knockout" &&
                    (t(language, "doubleKnockout") || "Double Knockout")}
                  {f === "round_robin" &&
                    (t(language, "roundRobin") || "Round Robin")}
                  {f === "groups_and_knockout" &&
                    (t(language, "groupsAndKnockout") || "Groups + Knockout")}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.formatBtn,
                styles.formatBtnFull,
                config.format === "groups_and_double_knockout" &&
                  styles.formatBtnActive,
              ]}
              onPress={() =>
                updateConfig("format", "groups_and_double_knockout")
              }
            >
              <Text
                style={[
                  styles.formatText,
                  config.format === "groups_and_double_knockout" &&
                    styles.formatTextActive,
                ]}
              >
                {t(language, "groupsAndDoubleKnockout") ||
                  "Groups + Double Knockout"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isKnockoutFormat && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t(language, "seeding") || "Seeding"}
            </Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  config.bracketOrder === "top_to_bottom" &&
                    styles.segmentBtnActive,
                ]}
                onPress={() => updateConfig("bracketOrder", "top_to_bottom")}
              >
                <Ionicons
                  name="arrow-down"
                  size={16}
                  color={
                    config.bracketOrder === "top_to_bottom"
                      ? "#fff"
                      : theme.colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.segmentText,
                    config.bracketOrder === "top_to_bottom" &&
                      styles.segmentTextActive,
                  ]}
                >
                  {" "}
                  {t(language, "topToBottom") || "Top to bottom"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  config.bracketOrder === "bottom_to_top" &&
                    styles.segmentBtnActive,
                ]}
                onPress={() => updateConfig("bracketOrder", "bottom_to_top")}
              >
                <Ionicons
                  name="arrow-up"
                  size={16}
                  color={
                    config.bracketOrder === "bottom_to_top"
                      ? "#fff"
                      : theme.colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.segmentText,
                    config.bracketOrder === "bottom_to_top" &&
                      styles.segmentTextActive,
                  ]}
                >
                  {" "}
                  {t(language, "bottomToTop") || "Bottom to top"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t(language, "matchRules") || "Match rules"}
          </Text>
          <View style={styles.stepperRow}>
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperLabel}>
                {t(language, "sets") || "Sets"}
              </Text>
              <View style={styles.stepperControlsCompact}>
                <TouchableOpacity
                  style={styles.stepperBtnCompact}
                  onPress={() =>
                    updateConfig(
                      "targetSets",
                      Math.max(1, config.targetSets - 1),
                    )
                  }
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
                <Text style={styles.stepperValueCompact}>
                  {config.targetSets}
                </Text>
                <TouchableOpacity
                  style={styles.stepperBtnCompact}
                  onPress={() =>
                    updateConfig("targetSets", config.targetSets + 1)
                  }
                >
                  <Ionicons name="add" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperLabel}>
                {t(language, "legs") || "Legs"}
              </Text>
              <View style={styles.stepperControlsCompact}>
                <TouchableOpacity
                  style={styles.stepperBtnCompact}
                  onPress={() =>
                    updateConfig(
                      "targetLegs",
                      Math.max(1, config.targetLegs - 1),
                    )
                  }
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
                <Text style={styles.stepperValueCompact}>
                  {config.targetLegs}
                </Text>
                <TouchableOpacity
                  style={styles.stepperBtnCompact}
                  onPress={() =>
                    updateConfig("targetLegs", config.targetLegs + 1)
                  }
                >
                  <Ionicons name="add" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperLabel}>
                {t(language, "points") || "Points"}
              </Text>
              <View style={styles.stepperControlsCompact}>
                <TouchableOpacity
                  style={styles.stepperBtnCompact}
                  onPress={() =>
                    updateConfig(
                      "startingPoints",
                      Math.max(101, config.startingPoints - 200),
                    )
                  }
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
                <Text style={styles.stepperValueCompact}>
                  {config.startingPoints}
                </Text>
                <TouchableOpacity
                  style={styles.stepperBtnCompact}
                  onPress={() =>
                    updateConfig("startingPoints", config.startingPoints + 200)
                  }
                >
                  <Ionicons name="add" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {isKnockoutFormat && (
            <>
              {(config.format === "groups_and_knockout" ||
                config.format === "groups_and_double_knockout") && (
                <>
                  <View style={styles.horizontalDivider} />

                  <TouchableOpacity
                    style={styles.toggleRow}
                    activeOpacity={0.7}
                    onPress={() =>
                      updateConfig("customGroups", !config.customGroups)
                    }
                  >
                    <View
                      style={[
                        styles.checkboxSmall,
                        config.customGroups && styles.checkboxSmallActive,
                      ]}
                    >
                      {config.customGroups && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.toggleText}>
                      {t(language, "customGroupsToggle") ||
                        "Different for groups?"}
                    </Text>
                  </TouchableOpacity>

                  {config.customGroups && (
                    <View style={styles.stepperRowSub}>
                      <View style={styles.stepperContainer}>
                        <Text style={styles.stepperLabel}>
                          {t(language, "setsGroup") || "Sets (Groups)"}
                        </Text>
                        <View style={styles.stepperControlsCompact}>
                          <TouchableOpacity
                            style={styles.stepperBtnCompact}
                            onPress={() =>
                              updateConfig(
                                "groupSets",
                                Math.max(1, config.groupSets - 1),
                              )
                            }
                          >
                            <Ionicons
                              name="remove"
                              size={18}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                          <Text style={styles.stepperValueCompact}>
                            {config.groupSets}
                          </Text>
                          <TouchableOpacity
                            style={styles.stepperBtnCompact}
                            onPress={() =>
                              updateConfig("groupSets", config.groupSets + 1)
                            }
                          >
                            <Ionicons
                              name="add"
                              size={18}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.stepperContainer}>
                        <Text style={styles.stepperLabel}>
                          {t(language, "legsGroup") || "Legs (Groups)"}
                        </Text>
                        <View style={styles.stepperControlsCompact}>
                          <TouchableOpacity
                            style={styles.stepperBtnCompact}
                            onPress={() =>
                              updateConfig(
                                "groupLegs",
                                Math.max(1, config.groupLegs - 1),
                              )
                            }
                          >
                            <Ionicons
                              name="remove"
                              size={18}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                          <Text style={styles.stepperValueCompact}>
                            {config.groupLegs}
                          </Text>
                          <TouchableOpacity
                            style={styles.stepperBtnCompact}
                            onPress={() =>
                              updateConfig("groupLegs", config.groupLegs + 1)
                            }
                          >
                            <Ionicons
                              name="add"
                              size={18}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}

              <View style={styles.horizontalDivider} />

              <TouchableOpacity
                style={styles.toggleRow}
                activeOpacity={0.7}
                onPress={() => updateConfig("customSemis", !config.customSemis)}
              >
                <View
                  style={[
                    styles.checkboxSmall,
                    config.customSemis && styles.checkboxSmallActive,
                  ]}
                >
                  {config.customSemis && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.toggleText}>
                  {t(language, "customSemisToggle") ||
                    "Different for semifinals?"}
                </Text>
              </TouchableOpacity>

              {config.customSemis && (
                <View style={styles.stepperRowSub}>
                  <View style={styles.stepperContainer}>
                    <Text style={styles.stepperLabel}>
                      {t(language, "setsSemi") || "Sets (1/2)"}
                    </Text>
                    <View style={styles.stepperControlsCompact}>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig(
                            "semiSets",
                            Math.max(1, config.semiSets - 1),
                          )
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                      <Text style={styles.stepperValueCompact}>
                        {config.semiSets}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig("semiSets", config.semiSets + 1)
                        }
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.stepperContainer}>
                    <Text style={styles.stepperLabel}>
                      {t(language, "legsSemi") || "Legs (1/2)"}
                    </Text>
                    <View style={styles.stepperControlsCompact}>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig(
                            "semiLegs",
                            Math.max(1, config.semiLegs - 1),
                          )
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                      <Text style={styles.stepperValueCompact}>
                        {config.semiLegs}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig("semiLegs", config.semiLegs + 1)
                        }
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.horizontalDivider} />

              <TouchableOpacity
                style={styles.toggleRow}
                activeOpacity={0.7}
                onPress={() =>
                  updateConfig("customFinals", !config.customFinals)
                }
              >
                <View
                  style={[
                    styles.checkboxSmall,
                    config.customFinals && styles.checkboxSmallActive,
                  ]}
                >
                  {config.customFinals && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.toggleText}>
                  {t(language, "customFinalsToggle") || "Different for final?"}
                </Text>
              </TouchableOpacity>

              {config.customFinals && (
                <View style={styles.stepperRowSub}>
                  <View style={styles.stepperContainer}>
                    <Text style={styles.stepperLabel}>
                      {t(language, "setsFinal") || "Sets (Final)"}
                    </Text>
                    <View style={styles.stepperControlsCompact}>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig(
                            "finalSets",
                            Math.max(1, config.finalSets - 1),
                          )
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                      <Text style={styles.stepperValueCompact}>
                        {config.finalSets}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig("finalSets", config.finalSets + 1)
                        }
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.stepperContainer}>
                    <Text style={styles.stepperLabel}>
                      {t(language, "legsFinal") || "Legs (Final)"}
                    </Text>
                    <View style={styles.stepperControlsCompact}>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig(
                            "finalLegs",
                            Math.max(1, config.finalLegs - 1),
                          )
                        }
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                      <Text style={styles.stepperValueCompact}>
                        {config.finalLegs}
                      </Text>
                      <TouchableOpacity
                        style={styles.stepperBtnCompact}
                        onPress={() =>
                          updateConfig("finalLegs", config.finalLegs + 1)
                        }
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.horizontalDivider} />

              <TouchableOpacity
                style={styles.toggleRow}
                activeOpacity={0.7}
                onPress={() =>
                  updateConfig("thirdPlaceMatch", !config.thirdPlaceMatch)
                }
              >
                <View
                  style={[
                    styles.checkboxSmall,
                    config.thirdPlaceMatch && styles.checkboxSmallActive,
                  ]}
                >
                  {config.thirdPlaceMatch && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.toggleText}>
                  {t(language, "thirdPlaceMatchToggle") || "3rd place match?"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.startBtn}
          activeOpacity={0.8}
          onPress={() => {
            const trimmedName = config.name.trim();
            if (!trimmedName) {
              setNameError(true);
              nameInputRef.current?.focus();
              return;
            }

            const nameExists = activeTournaments.some(
              (tItem) =>
                tItem.settings.name.toLowerCase() === trimmedName.toLowerCase(),
            );

            if (nameExists) {
              setDeleteAlert({
                visible: true,
                title: t(language, "error") || "Error",
                message:
                  t(language, "tournamentExists") ||
                  "A tournament with this name already exists. Please choose a different name.",
                buttons: [
                  {
                    text: t(language, "ok") || "OK",
                    onPress: () =>
                      setDeleteAlert((prev: any) => ({
                        ...prev,
                        visible: false,
                      })),
                  },
                ],
              });
              return;
            }

            router.push({
              pathname: "/tournament/players",
              params: {
                tournamentData: JSON.stringify({
                  ...config,
                  name: trimmedName,
                }),
              },
            });
          }}
        >
          <Text style={styles.startBtnText}>
            {t(language, "nextStep") || "Next step"}
          </Text>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isSavedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedModalVisible(false)}
      >
        <View style={styles.modalOverlayList}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSavedModalVisible(false)}
          />

          <View style={styles.modalContentList}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleList}>
                {t(language, "resumeTournament") || "Resume tournament"}
              </Text>
              <TouchableOpacity
                onPress={() => setSavedModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {activeTournaments.map((tItem, idx) => (
                <View key={idx} style={styles.savedTournamentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedTName} numberOfLines={1}>
                      {tItem.settings.name}
                    </Text>
                    <Text style={styles.savedTDesc}>
                      {tItem.players?.length || 0}{" "}
                      {t(language, "playersShort") || "players"} •{" "}
                      {tItem.settings.startingPoints}{" "}
                      {t(language, "ptsShort") || "pts"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={styles.actionBtnPlay}
                      onPress={() => {
                        setSavedModalVisible(false);
                        router.push({
                          pathname: "/tournament/bracket",
                          params: {
                            tournamentData: JSON.stringify(tItem.settings),
                            playersData: JSON.stringify(tItem.players),
                          },
                        });
                      }}
                    >
                      <Ionicons name="play" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() =>
                        handleDeleteTournament(tItem.settings.name)
                      }
                    >
                      <Ionicons name="trash" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={deleteAlert.visible}
        title={deleteAlert.title}
        message={deleteAlert.message}
        onRequestClose={() =>
          setDeleteAlert((prev) => ({ ...prev, visible: false }))
        }
        buttons={deleteAlert.buttons}
      />
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },

    modalOverlayList: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContentList: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      maxHeight: "80%",
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitleList: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    closeModalBtn: {
      padding: 4,
      backgroundColor: theme.colors.card,
      borderRadius: 20,
    },

    savedTournamentRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    savedTName: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 4,
    },
    savedTDesc: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },

    actionBtnPlay: {
      backgroundColor: theme.colors.primary,
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    actionBtnDelete: {
      backgroundColor: theme.colors.danger || "#dc3545",
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },

    continueBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.warning || "#f0ad4e",
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 20,
      shadowColor: theme.colors.warning || "#f0ad4e",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    continueBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

    sectionTitleMain: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 24,
      marginTop: 8,
      textAlign: "center",
    },
    customHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerBtn: { padding: 4 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 8,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textMain,
    },

    inputLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    textInput: {
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 12,
      color: theme.colors.textMain,
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: 16,
    },
    textInputError: {
      borderColor: theme.colors.danger || "red",
      borderWidth: 1.5,
    },
    textArea: { height: 100, textAlignVertical: "top" },
    descHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    charCount: { fontSize: 12, color: theme.colors.textLight, marginBottom: 8 },
    dateSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      gap: 10,
      marginBottom: 16,
    },
    dateText: { fontSize: 16, color: theme.colors.textMain, fontWeight: "600" },

    segmentedControl: {
      flexDirection: "row",
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 8,
      flexDirection: "row",
      justifyContent: "center",
    },
    segmentBtnActive: {
      backgroundColor: theme.colors.primaryDark,
      elevation: 1,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    segmentTextActive: { color: "#fff", fontWeight: "700" },
    formatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    formatBtn: {
      width: "48%",
      backgroundColor: theme.colors.background,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    formatBtnFull: { width: "100%" },
    formatBtnActive: {
      backgroundColor: theme.colors.primaryDark,
      borderColor: theme.colors.primaryDark,
    },
    formatText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    formatTextActive: { color: "#fff", fontWeight: "700" },
    horizontalDivider: {
      height: 1,
      backgroundColor: theme.colors.cardBorder,
      marginVertical: 16,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      gap: 12,
    },
    toggleText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    checkboxSmall: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.colors.textLight,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxSmallActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    stepperRowSub: {
      flexDirection: "row",
      justifyContent: "space-evenly",
      alignItems: "center",
      marginTop: 12,
      marginBottom: 8,
      backgroundColor: theme.colors.background,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    stepperRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
    },
    stepperContainer: { flex: 1, alignItems: "center" },
    stepperLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: "700",
      marginBottom: 8,
      textTransform: "uppercase",
    },
    stepperControlsCompact: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    stepperBtnCompact: {
      backgroundColor: theme.colors.background,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    stepperValueCompact: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      minWidth: 26,
      textAlign: "center",
    },
    divider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.cardBorder,
      marginHorizontal: 4,
      marginTop: 20,
    },

    startBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 16,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    startBtnText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    modeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    iconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    wifiIconSub: {
      position: "absolute",
      bottom: -4,
      right: -4,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 4,
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
    modeTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 8,
      textAlign: "center",
    },
    modeDesc: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "500",
      textAlign: "center",
      lineHeight: 20,
    },
    historyBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    historyBtnText: {
      color: theme.colors.textMain,
      fontSize: 16,
      fontWeight: "800",
      textTransform: "uppercase",
    },
  });
