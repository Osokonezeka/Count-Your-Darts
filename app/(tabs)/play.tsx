import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import CustomAlert, { AlertButton } from "../../components/CustomAlert";
import { useGame } from "../../context/GameContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePlayers } from "../../context/PlayersContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const STORAGE_KEY_PLAYERS = "@last_selected_players";
const STORAGE_KEY_CONFIG = "@last_game_config";

const IN_LABELS: any = {
  straight: "straightIn",
  double: "doubleIn",
  master: "masterIn",
};
const OUT_LABELS: any = {
  straight: "straightOut",
  double: "doubleOut",
  master: "masterOut",
};

const shufflePlayers = (list: string[]) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function Play() {
  const { setPlayers, setSettings } = useGame();
  const router = useRouter();
  const navigation = useNavigation();

  const { players, addPlayer, removePlayer, updatePlayer } = usePlayers();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [gameMode, setGameMode] = useState<"X01" | "Cricket" | "Training">(
    "X01",
  );
  const [trainingMode, setTrainingMode] = useState<
    "around_the_clock" | "100_darts" | "bobs_27"
  >("around_the_clock");

  const [points, setPoints] = useState(501);
  const [isCustomPoints, setIsCustomPoints] = useState(false);
  const [customPointsVal, setCustomPointsVal] = useState("1001");
  const [legs, setLegs] = useState(1);
  const [sets, setSets] = useState(1);
  const [inRule, setInRule] = useState<"straight" | "double" | "master">(
    "straight",
  );
  const [outRule, setOutRule] = useState<"straight" | "double" | "master">(
    "double",
  );
  const [cricketMode, setCricketMode] = useState<"standard" | "no-score">(
    "standard",
  );

  const [isLoaded, setIsLoaded] = useState(false);

  const [isManageVisible, setManageVisible] = useState(false);
  const [isAddPopupVisible, setAddPopupVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(
    null,
  );
  const animManageValue = useRef(new Animated.Value(0)).current;

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

  const showAlert = (
    title: string,
    message: string,
    buttons?: AlertButton[],
  ) => {
    setAlertConfig({
      title,
      message,
      buttons: buttons || [{ text: "OK", style: "default" }],
    });
    setAlertVisible(true);
  };

  const allPlayersSelected =
    players.length > 0 && players.length === selectedPlayers.length;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openManagePanel}
          style={{ marginRight: 16, padding: 4 }}
        >
          <Ionicons
            name="people-circle-outline"
            size={28}
            color={theme.colors.primary}
          />
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  const openManagePanel = () => {
    setManageVisible(true);
    Animated.timing(animManageValue, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.back(0.5)),
      useNativeDriver: true,
    }).start();
  };

  const closeManagePanel = () => {
    Animated.timing(animManageValue, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => setManageVisible(false));
  };

  const manageBackdropOpacity = animManageValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  const manageTranslateY = animManageValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const handleSavePlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;

    if (editingPlayerName) {
      updatePlayer(editingPlayerName, name);
      const newSelection = selectedPlayers.map((p) =>
        p === editingPlayerName ? name : p,
      );
      setSelectedPlayers(newSelection);
    } else {
      if (players.includes(name)) {
        showAlert(
          t(language, "error") || "Error",
          t(language, "playerAlreadyExists") ||
            "Player with this name already exists.",
        );
        return;
      }
      addPlayer(name);
    }
    setNewPlayerName("");
    setEditingPlayerName(null);
    setAddPopupVisible(false);
  };

  const handleDeletePlayer = (name: string) => {
    showAlert(
      t(language, "delete") || "Delete",
      (t(language, "deletePlayer") || "Delete player") + ` ${name}?`,
      [
        { text: t(language, "cancel") || "Cancel", style: "cancel" },
        {
          text: t(language, "delete") || "Delete",
          style: "destructive",
          onPress: () => {
            removePlayer(name);
            const newSelection = selectedPlayers.filter((p) => p !== name);
            setSelectedPlayers(newSelection);
          },
        },
      ],
    );
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
        if (savedConfig !== null) {
          const config = JSON.parse(savedConfig);
          if (config.gameMode) setGameMode(config.gameMode);
          if (config.trainingMode) setTrainingMode(config.trainingMode);
          if (config.points) setPoints(config.points);
          if (config.isCustomPoints !== undefined)
            setIsCustomPoints(config.isCustomPoints);
          if (config.customPointsVal)
            setCustomPointsVal(config.customPointsVal);
          if (config.legs) setLegs(config.legs);
          if (config.sets) setSets(config.sets);
          if (config.inRule) setInRule(config.inRule);
          if (config.outRule) setOutRule(config.outRule);
          if (config.cricketMode) setCricketMode(config.cricketMode);
        }
        const savedPlayers = await AsyncStorage.getItem(STORAGE_KEY_PLAYERS);
        if (savedPlayers !== null) {
          const parsed = JSON.parse(savedPlayers);
          setSelectedPlayers(
            parsed.filter((name: string) => players.includes(name)),
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoaded(true);
        await SplashScreen.hideAsync();
      }
    };
    loadConfig();
  }, [players]);

  useEffect(() => {
    if (!isLoaded) return;
    const saveAll = async () => {
      const config = {
        gameMode,
        trainingMode,
        points,
        isCustomPoints,
        customPointsVal,
        legs,
        sets,
        inRule,
        outRule,
        cricketMode,
      };
      try {
        await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
        await AsyncStorage.setItem(
          STORAGE_KEY_PLAYERS,
          JSON.stringify(selectedPlayers),
        );
      } catch (e) {
        console.error(e);
      }
    };
    saveAll();
  }, [
    isLoaded,
    gameMode,
    trainingMode,
    points,
    isCustomPoints,
    customPointsVal,
    legs,
    sets,
    inRule,
    outRule,
    cricketMode,
    selectedPlayers,
  ]);

  useEffect(() => {
    setPlayerOrder(selectedPlayers);
  }, [selectedPlayers]);

  const HorizontalStepper = ({ value, setValue, label }: any) => (
    <View style={styles.stepperContainer}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => value > 1 && setValue(value - 1)}
        >
          <Ionicons name="remove" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => value < 30 && setValue(value + 1)}
        >
          <Ionicons name="add" size={20} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t(language, "mode") || "Mode"}
          </Text>
          <View style={styles.segmentedControl}>
            {[
              { id: "X01" as const, label: t(language, "x01") || "X01" },
              {
                id: "Cricket" as const,
                label: t(language, "cricket") || "Cricket",
              },
              {
                id: "Training" as const,
                label: t(language, "training") || "Training",
              },
            ].map((mode) => (
              <Pressable
                key={mode.id}
                onPress={() => setGameMode(mode.id)}
                style={[
                  styles.segmentBtn,
                  gameMode === mode.id && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    gameMode === mode.id && styles.segmentTextActive,
                  ]}
                >
                  {mode.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {gameMode === "X01" && (
            <>
              <Text style={styles.subTitle}>
                {t(language, "points") || "Points"}
              </Text>
              <View style={styles.segmentedControl}>
                {[301, 501, 701, "custom"].map((p) => {
                  const isCustomBtn = p === "custom";
                  const isActive = isCustomBtn
                    ? isCustomPoints
                    : !isCustomPoints && points === p;
                  return (
                    <Pressable
                      key={p.toString()}
                      onPress={() => {
                        if (isCustomBtn) setIsCustomPoints(true);
                        else {
                          setIsCustomPoints(false);
                          setPoints(p as number);
                        }
                      }}
                      style={[
                        styles.segmentBtn,
                        isActive && styles.segmentBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isActive && styles.segmentTextActive,
                        ]}
                      >
                        {isCustomBtn ? t(language, "custom") || "Custom" : p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {isCustomPoints && (
                <View style={styles.customInputContainer}>
                  <Text style={styles.customInputLabel}>
                    {t(language, "enterCustomPoints") || "Enter the points"}
                  </Text>
                  <TextInput
                    style={styles.customInput}
                    keyboardType="number-pad"
                    value={customPointsVal}
                    onChangeText={setCustomPointsVal}
                    placeholder="1001"
                    placeholderTextColor={theme.colors.textLight}
                    maxLength={5}
                  />
                </View>
              )}
            </>
          )}

          {gameMode === "Cricket" && (
            <>
              <Text style={styles.subTitle}>
                {t(language, "scoring") || "Scoring"}
              </Text>
              <View style={styles.segmentedControl}>
                {[
                  { id: "standard", l: t(language, "withScore") || "Score" },
                  {
                    id: "no-score",
                    l: t(language, "withoutScore") || "No score",
                  },
                ].map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setCricketMode(m.id as any)}
                    style={[
                      styles.segmentBtn,
                      cricketMode === m.id && styles.segmentBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        cricketMode === m.id && styles.segmentTextActive,
                      ]}
                    >
                      {m.l}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {gameMode === "Training" && (
            <>
              <Text style={styles.subTitle}>
                {t(language, "exercise") || "Exercise"}
              </Text>
              <View style={{ gap: 8 }}>
                {[
                  {
                    id: "around_the_clock",
                    title: t(language, "aroundTheClock") || "Around the Clock",
                    desc:
                      t(language, "aroundTheClockDesc") ||
                      "Hit numbers 1-20 sequentially.",
                  },
                  {
                    id: "100_darts",
                    title: t(language, "100Darts") || "100 Darts (Scoring)",
                    desc:
                      t(language, "100DartsDesc") ||
                      "Throw 100 darts for highest score.",
                  },
                  {
                    id: "bobs_27",
                    title: t(language, "bobs27") || "Bob's 27",
                    desc:
                      t(language, "bobs27Desc") ||
                      "Double training game by Bob Anderson.",
                  },
                ].map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => setTrainingMode(exercise.id as any)}
                    style={[
                      styles.trainingCard,
                      trainingMode === exercise.id && styles.trainingCardActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.trainingTitle,
                        trainingMode === exercise.id &&
                          styles.trainingTitleActive,
                      ]}
                    >
                      {exercise.title}
                    </Text>
                    <Text
                      style={[
                        styles.trainingDesc,
                        trainingMode === exercise.id &&
                          styles.trainingDescActive,
                      ]}
                    >
                      {exercise.desc}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {gameMode !== "Training" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t(language, "match") || "Match"}
            </Text>
            <View style={styles.stepperRow}>
              <HorizontalStepper
                value={legs}
                setValue={setLegs}
                label={t(language, "legs") || "Legs"}
              />
              <View style={styles.divider} />
              <HorizontalStepper
                value={sets}
                setValue={setSets}
                label={t(language, "sets") || "Sets"}
              />
            </View>
          </View>
        )}

        <Pressable
          onPress={() => {
            if (playerOrder.length === 0) {
              showAlert(
                t(language, "error") || "Error",
                t(language, "noPlayersSelected") || "Please select players.",
              );
              return;
            }
            setPlayers(playerOrder);
            const finalPoints = isCustomPoints
              ? parseInt(customPointsVal) || 501
              : points;
            setSettings({
              inRule,
              outRule,
              startPoints: finalPoints,
              legs,
              sets,
              gameMode,
              cricketMode,
              trainingMode,
            });

            if (gameMode === "X01") router.push("/dart");
            else if (gameMode === "Cricket") router.push("/cricket");
            else if (gameMode === "Training") {
              if (trainingMode === "around_the_clock")
                router.push("/aroundtheclock" as any);
              else if (trainingMode === "100_darts")
                router.push("/hundreddarts" as any);
              else if (trainingMode === "bobs_27")
                router.push("/bobstwentyseven" as any);
            }
          }}
          style={[
            styles.startBtn,
            playerOrder.length === 0 && styles.startBtnDisabled,
          ]}
        >
          <Text style={styles.startBtnText}>
            {t(language, "startBtn") || "Start"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>

        <View style={styles.card}>
          <View style={styles.playersHeader}>
            <Text style={styles.sectionTitle}>
              {t(language, "players") || "Players"}
            </Text>
            <View style={styles.playersActions}>
              {playerOrder.length > 1 && (
                <Pressable
                  onPress={() =>
                    setSelectedPlayers(shufflePlayers(selectedPlayers))
                  }
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name="shuffle"
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  if (allPlayersSelected) return;
                  if (players.length === 0) openManagePanel();
                  else {
                    setTempSelected([]);
                    setModalVisible(true);
                  }
                }}
                style={[
                  styles.iconBtnPrimary,
                  allPlayersSelected && styles.iconBtnDisabled,
                ]}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
          <View style={styles.playersList}>
            {playerOrder.length === 0 ? (
              <Pressable
                onPress={
                  players.length === 0
                    ? openManagePanel
                    : () => setModalVisible(true)
                }
                style={styles.emptyPlayers}
              >
                <Ionicons
                  name="people-outline"
                  size={40}
                  color={theme.colors.textLight}
                />
                <Text style={styles.emptyPlayersText}>
                  {players.length === 0
                    ? t(language, "addInRightCorner") ||
                      "Add players in top-right corner"
                    : t(language, "addPlayersToGame") ||
                      "Press + to add players to the game"}
                </Text>
              </Pressable>
            ) : (
              playerOrder.map((p, i) => (
                <View key={p} style={styles.playerItem}>
                  <Text style={styles.playerItemText}>
                    <Text
                      style={{
                        fontWeight: "800",
                        color: theme.colors.textLight,
                      }}
                    >
                      {i + 1}.{" "}
                    </Text>
                    {p}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setSelectedPlayers(selectedPlayers.filter((x) => x !== p))
                    }
                    style={{ padding: 6, marginRight: -2 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={theme.colors.danger}
                    />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

        {gameMode === "X01" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t(language, "inOutRules") || "In / Out Rules"}
            </Text>
            <View style={styles.segmentedControl}>
              {(["straight", "double", "master"] as const).map((rule) => (
                <Pressable
                  key={rule}
                  onPress={() => setInRule(rule)}
                  style={[
                    styles.segmentBtn,
                    inRule === rule && styles.segmentBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      inRule === rule && styles.segmentTextActive,
                    ]}
                  >
                    {t(language, IN_LABELS[rule])}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentedControl, { marginTop: 10 }]}>
              {(["double", "master", "straight"] as const).map((rule) => (
                <Pressable
                  key={rule}
                  onPress={() => setOutRule(rule)}
                  style={[
                    styles.segmentBtn,
                    outRule === rule && styles.segmentBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      outRule === rule && styles.segmentTextActive,
                    ]}
                  >
                    {t(language, OUT_LABELS[rule])}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}
          >
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitle}>
                {t(language, "selectPlayers") || "Select players"}
              </Text>
              <ScrollView
                style={{ maxHeight: 300 }}
                keyboardShouldPersistTaps="handled"
              >
                {players
                  .filter((p: string) => !selectedPlayers.includes(p))
                  .map((p: string) => {
                    const checked = tempSelected.includes(p);
                    return (
                      <Pressable
                        key={p}
                        onPress={() => {
                          if (checked)
                            setTempSelected(
                              tempSelected.filter((x) => x !== p),
                            );
                          else setTempSelected([...tempSelected, p]);
                        }}
                        style={styles.modalPlayerRow}
                      >
                        <Text
                          style={[
                            styles.modalPlayerName,
                            checked && {
                              color: theme.colors.success,
                              fontWeight: "bold",
                            },
                          ]}
                        >
                          {p}
                        </Text>
                        <View
                          style={[
                            styles.checkbox,
                            checked && styles.checkboxActive,
                          ]}
                        >
                          {checked && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={styles.modalBtnCancel}
                >
                  <Text style={styles.modalBtnCancelText}>
                    {t(language, "cancel") || "Cancel"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedPlayers([...selectedPlayers, ...tempSelected]);
                    setModalVisible(false);
                  }}
                  style={styles.modalBtnAdd}
                >
                  <Text style={styles.modalBtnAddText}>
                    {t(language, "add") || "Add"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={isManageVisible}
          transparent
          animationType="none"
          onRequestClose={closeManagePanel}
        >
          <View style={styles.sheetOverlay}>
            <Pressable style={{ flex: 1 }} onPress={closeManagePanel} />
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.sheetBackdrop,
                { opacity: manageBackdropOpacity },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.sheetContent,
                { transform: [{ translateY: manageTranslateY }] },
              ]}
            >
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>
                  {t(language, "managePlayers") || "Manage players"}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: SCREEN_HEIGHT * 0.5, marginBottom: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {players.length === 0 ? (
                  <View style={styles.emptyPlayers}>
                    <Ionicons
                      name="person-outline"
                      size={40}
                      color={theme.colors.textLight}
                    />
                    <Text style={styles.emptyPlayersText}>
                      {t(language, "noPlayers") || "No more players"}
                    </Text>
                  </View>
                ) : (
                  players.map((p: string) => (
                    <View key={p} style={styles.dbPlayerRow}>
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => {
                          setEditingPlayerName(p);
                          setNewPlayerName(p);
                          setAddPopupVisible(true);
                        }}
                      >
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <Text style={styles.dbPlayerName}>{p}</Text>
                          <Ionicons
                            name="pencil"
                            size={14}
                            color={theme.colors.textLight}
                            style={{ marginLeft: 8 }}
                          />
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeletePlayer(p)}
                        style={styles.dbDeleteBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={theme.colors.danger}
                        />
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
              <Pressable
                style={styles.addNewPlayerBtn}
                onPress={() => {
                  setEditingPlayerName(null);
                  setNewPlayerName("");
                  setAddPopupVisible(true);
                }}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.addNewPlayerText}>
                  {t(language, "addNewPlayer") || "Add new player"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>

        <Modal
          visible={isAddPopupVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setAddPopupVisible(false);
            setNewPlayerName("");
            setEditingPlayerName(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <Pressable
              style={[styles.modalOverlay, { flexGrow: 1 }]}
              onPress={() => {
                setAddPopupVisible(false);
                setNewPlayerName("");
                setEditingPlayerName(null);
              }}
            >
              <View
                style={styles.modalContent}
                onStartShouldSetResponder={() => true}
              >
                <Text style={styles.modalTitle}>
                  {editingPlayerName
                    ? t(language, "editPlayer") || "Edit player"
                    : t(language, "newPlayer") || "New player"}
                </Text>
                <TextInput
                  style={styles.addPlayerInput}
                  placeholder={t(language, "enterName") || "Enter the name"}
                  placeholderTextColor={theme.colors.textLight}
                  value={newPlayerName}
                  onChangeText={setNewPlayerName}
                  autoFocus
                  maxLength={15}
                  onSubmitEditing={handleSavePlayer}
                  returnKeyType="done"
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => {
                      setAddPopupVisible(false);
                      setNewPlayerName("");
                      setEditingPlayerName(null);
                    }}
                    style={styles.modalBtnCancel}
                  >
                    <Text style={styles.modalBtnCancelText}>
                      {t(language, "cancel") || "Cancel"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSavePlayer}
                    style={styles.modalBtnAdd}
                  >
                    <Text style={styles.modalBtnAddText}>
                      {t(language, "save") || "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onRequestClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 12,
    },
    subTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textMuted,
      marginTop: 16,
      marginBottom: 8,
      textTransform: "uppercase",
    },
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

    trainingCard: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    trainingCardActive: {
      backgroundColor: theme.colors.primaryDark,
      borderColor: theme.colors.primaryDark,
      elevation: 2,
    },
    trainingTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textMain,
      marginBottom: 2,
    },
    trainingTitleActive: { color: "#fff" },
    trainingDesc: {
      fontSize: 13,
      color: theme.colors.textLight,
      fontWeight: "500",
    },
    trainingDescActive: { color: "rgba(255,255,255,0.7)" },

    customInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    customInputLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    customInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      textAlign: "right",
      paddingVertical: 8,
      paddingLeft: 10,
    },
    stepperRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stepperContainer: { flex: 1, alignItems: "center" },
    stepperLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "600",
      marginBottom: 6,
      textTransform: "uppercase",
    },
    stepperControls: { flexDirection: "row", alignItems: "center", gap: 15 },
    stepperBtn: {
      backgroundColor: theme.colors.background,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    stepperValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.textMain,
      minWidth: 24,
      textAlign: "center",
    },
    divider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.cardBorder,
      marginHorizontal: 10,
    },

    startBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 16,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    startBtnDisabled: {
      backgroundColor: theme.colors.primaryDisabled,
      shadowOpacity: 0,
      elevation: 0,
    },
    startBtnText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
    },

    playersHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    playersActions: { flexDirection: "row", gap: 10 },
    iconBtn: {
      padding: 8,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: 8,
    },
    iconBtnPrimary: {
      padding: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
    },
    iconBtnDisabled: {
      backgroundColor: theme.colors.primaryDisabled,
      opacity: 0.7,
    },
    playersList: { marginTop: 4 },
    emptyPlayers: { alignItems: "center", paddingVertical: 20, gap: 8 },
    emptyPlayersText: {
      color: theme.colors.textLight,
      fontSize: 14,
      fontStyle: "italic",
      textAlign: "center",
    },
    playerItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    playerItemText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      elevation: 10,
      width: "100%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
      textAlign: "center",
    },
    modalPlayerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    modalPlayerName: {
      fontSize: 16,
      color: theme.colors.textMain,
      fontWeight: "600",
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.textLight,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxActive: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 24,
    },
    modalBtnCancel: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    modalBtnCancelText: { color: theme.colors.textMuted, fontWeight: "700" },
    modalBtnAdd: {
      backgroundColor: theme.colors.success,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    modalBtnAddText: { color: "#fff", fontWeight: "700" },
    sheetOverlay: { flex: 1, justifyContent: "flex-end" },
    sheetBackdrop: { backgroundColor: "#000" },
    sheetContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      maxHeight: "85%",
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
    dbPlayerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    dbPlayerName: {
      fontSize: 17,
      color: theme.colors.textMain,
      fontWeight: "600",
    },
    dbDeleteBtn: {
      padding: 6,
      backgroundColor: theme.colors.dangerLight,
      borderRadius: 8,
    },
    addNewPlayerBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.success,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 10,
    },
    addNewPlayerText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    addPlayerInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.colors.textMain,
      fontWeight: "600",
    },
  });
