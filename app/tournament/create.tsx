import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import CustomAlert from "../../components/modals/CustomAlert";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { AnimatedVerticalSelect } from "../../components/common/AnimatedVerticalSelect";
import { AnimatedStepper } from "../../components/common/AnimatedStepper";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { useLanguage } from "../../context/LanguageContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export default function TournamentCreateScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme);
  const { isHost } = useLocalSearchParams();

  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [isSavedModalVisible, setSavedModalVisible] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const [nameError, setNameError] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState(new Date());

  const [deleteAlert, setDeleteAlert] = useState({
    visible: false,
    title: "",
    message: "",
    buttons: [] as any[],
  });

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
            setActiveTournaments([]);
          }
        } catch (error) {
          console.error("Błąd podczas ładowania turniejów", error);
        }
      };
      loadTournaments();
    }, []),
  );

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
          },
        },
      ],
    });
  };

  const updateConfig = (key: keyof typeof config, value: any) =>
    setConfig((prev: any) => ({ ...prev, [key]: value }));

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

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.customHeader,
          { paddingTop: insets.top > 0 ? insets.top + 10 : 16 },
        ]}
      >
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>
          {isHost === "true"
            ? t(language, "newRoom") || "New room"
            : t(language, "newTournament") || "New tournament"}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTournaments.length > 0 && (
          <AnimatedPrimaryButton
            title={`${t(language, "unfinishedTournaments") || "Unfinished tournaments"} (${activeTournaments.length})`}
            iconName="list"
            iconPosition="left"
            color={theme.colors.warning || "#f0ad4e"}
            theme={theme}
            style={{ marginBottom: 16 }}
            onPress={() => setSavedModalVisible(true)}
          />
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
          <AnimatedPressable
            style={styles.dateSelector}
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
          </AnimatedPressable>

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
          <AnimatedSegmentedControl
            theme={theme}
            activeOption={config.teamSize}
            onSelect={(val: any) => updateConfig("teamSize", val)}
            options={[
              {
                id: "single",
                label: t(language, "singleFormat") || "1 vs 1 (Single)",
              },
              {
                id: "team",
                label: t(language, "pairsFormat") || "2 vs 2 (Pairs)",
              },
            ]}
          />
          <View style={{ marginTop: 16 }}>
            <AnimatedVerticalSelect
              theme={theme}
              activeOption={config.format}
              onSelect={(val: any) => updateConfig("format", val)}
              options={[
                {
                  id: "single_knockout",
                  title: t(language, "singleKnockout") || "Single Knockout",
                  desc:
                    t(language, "singleKnockoutDesc") ||
                    "Players are eliminated after one loss.",
                },
                {
                  id: "double_knockout",
                  title: t(language, "doubleKnockout") || "Double Knockout",
                  desc:
                    t(language, "doubleKnockoutDesc") ||
                    "Players are eliminated after two losses.",
                },
                {
                  id: "round_robin",
                  title: t(language, "roundRobin") || "Round Robin",
                  desc:
                    t(language, "roundRobinDesc") ||
                    "Every player plays against everyone else.",
                },
                {
                  id: "groups_and_knockout",
                  title:
                    t(language, "groupsAndKnockout") || "Groups + Knockout",
                  desc:
                    t(language, "groupsAndKnockoutDesc") ||
                    "Group stage followed by single elimination.",
                },
                {
                  id: "groups_and_double_knockout",
                  title:
                    t(language, "groupsAndDoubleKnockout") ||
                    "Groups + Double Knockout",
                  desc:
                    t(language, "groupsAndDoubleKnockoutDesc") ||
                    "Group stage followed by double elimination.",
                },
              ]}
            />
          </View>
        </View>

        {isKnockoutFormat && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t(language, "seeding") || "Seeding"}
            </Text>
            <AnimatedSegmentedControl
              theme={theme}
              activeOption={config.bracketOrder}
              onSelect={(val: any) => updateConfig("bracketOrder", val)}
              options={[
                {
                  id: "top_to_bottom",
                  label: t(language, "topToBottom") || "Top to bottom",
                  icon: (isActive: boolean) => (
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color={isActive ? "#fff" : theme.colors.textMuted}
                    />
                  ),
                },
                {
                  id: "bottom_to_top",
                  label: t(language, "bottomToTop") || "Bottom to top",
                  icon: (isActive: boolean) => (
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={isActive ? "#fff" : theme.colors.textMuted}
                    />
                  ),
                },
              ]}
            />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t(language, "matchRules") || "Match rules"}
          </Text>
          <View style={styles.stepperRow}>
            <AnimatedStepper
              theme={theme}
              label={t(language, "sets") || "Sets"}
              value={config.targetSets}
              setValue={(val: number) => updateConfig("targetSets", val)}
              max={30}
            />
            <View style={styles.divider} />
            <AnimatedStepper
              theme={theme}
              label={t(language, "legs") || "Legs"}
              value={config.targetLegs}
              setValue={(val: number) => updateConfig("targetLegs", val)}
              max={30}
            />
            <View style={styles.divider} />
            <AnimatedStepper
              theme={theme}
              label={t(language, "points") || "Points"}
              value={config.startingPoints}
              setValue={(val: number) => updateConfig("startingPoints", val)}
              min={101}
              step={200}
            />
          </View>

          {isKnockoutFormat && (
            <>
              {(config.format === "groups_and_knockout" ||
                config.format === "groups_and_double_knockout") && (
                <>
                  <View style={styles.horizontalDivider} />

                  <AnimatedPressable
                    style={styles.toggleRow}
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
                  </AnimatedPressable>

                  {config.customGroups && (
                    <View style={styles.stepperRowSub}>
                      <AnimatedStepper
                        theme={theme}
                        label={t(language, "setsGroup") || "Sets (Groups)"}
                        value={config.groupSets}
                        setValue={(val: number) =>
                          updateConfig("groupSets", val)
                        }
                        max={30}
                      />
                      <View style={styles.divider} />
                      <AnimatedStepper
                        theme={theme}
                        label={t(language, "legsGroup") || "Legs (Groups)"}
                        value={config.groupLegs}
                        setValue={(val: number) =>
                          updateConfig("groupLegs", val)
                        }
                        max={30}
                      />
                    </View>
                  )}
                </>
              )}

              <View style={styles.horizontalDivider} />

              <AnimatedPressable
                style={styles.toggleRow}
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
              </AnimatedPressable>

              {config.customSemis && (
                <View style={styles.stepperRowSub}>
                  <AnimatedStepper
                    theme={theme}
                    label={t(language, "setsSemi") || "Sets (1/2)"}
                    value={config.semiSets}
                    setValue={(val: number) => updateConfig("semiSets", val)}
                    max={30}
                  />
                  <View style={styles.divider} />
                  <AnimatedStepper
                    theme={theme}
                    label={t(language, "legsSemi") || "Legs (1/2)"}
                    value={config.semiLegs}
                    setValue={(val: number) => updateConfig("semiLegs", val)}
                    max={30}
                  />
                </View>
              )}

              <View style={styles.horizontalDivider} />

              <AnimatedPressable
                style={styles.toggleRow}
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
              </AnimatedPressable>

              {config.customFinals && (
                <View style={styles.stepperRowSub}>
                  <AnimatedStepper
                    theme={theme}
                    label={t(language, "setsFinal") || "Sets (Final)"}
                    value={config.finalSets}
                    setValue={(val: number) => updateConfig("finalSets", val)}
                    max={30}
                  />
                  <View style={styles.divider} />
                  <AnimatedStepper
                    theme={theme}
                    label={t(language, "legsFinal") || "Legs (Final)"}
                    value={config.finalLegs}
                    setValue={(val: number) => updateConfig("finalLegs", val)}
                    max={30}
                  />
                </View>
              )}

              <View style={styles.horizontalDivider} />

              <AnimatedPressable
                style={styles.toggleRow}
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
              </AnimatedPressable>
            </>
          )}
        </View>

        <AnimatedPrimaryButton
          title={t(language, "nextStep") || "Next step"}
          iconName="arrow-forward"
          theme={theme}
          fontSize={18}
          style={{ marginTop: 16 }}
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
        />
      </ScrollView>

      <Modal
        visible={isSavedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedModalVisible(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalOverlayList}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSavedModalVisible(false)}
          />

          <View
            style={[
              styles.modalContentList,
              { paddingBottom: insets.bottom > 0 ? insets.bottom + 20 : 40 },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleList}>
                {t(language, "resumeTournament") || "Resume tournament"}
              </Text>
              <AnimatedPressable
                onPress={() => setSavedModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textMuted}
                />
              </AnimatedPressable>
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
                    <AnimatedPressable
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
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={styles.actionBtnDelete}
                      onPress={() =>
                        handleDeleteTournament(tItem.settings.name)
                      }
                    >
                      <Ionicons name="trash" size={18} color="#fff" />
                    </AnimatedPressable>
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
    divider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.cardBorder,
      marginHorizontal: 4,
      marginTop: 20,
    },
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
  });
