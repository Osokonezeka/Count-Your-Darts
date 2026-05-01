import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import CustomAlert, { AlertButton } from "../../components/modals/CustomAlert";
import { useGame } from "../../context/GameContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePlayers } from "../../context/PlayersContext";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { useTheme } from "../../context/ThemeContext";
import { PlayerModal } from "../../components/modals/PlayerModal";
import { SelectPlayersModal } from "../../components/modals/SelectPlayersModal";
import { AnimatedVerticalSelect } from "../../components/common/AnimatedVerticalSelect";
import { AnimatedStepper } from "../../components/common/AnimatedStepper";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
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

  const [isRandomizeEnabled, setIsRandomizeEnabled] = useState(false);

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
      buttons: buttons || [
        { text: t(language, "ok") || "OK", style: "default" },
      ],
    });
    setAlertVisible(true);
  };

  const allPlayersSelected =
    players.length > 0 && players.length === selectedPlayers.length;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <AnimatedPressable
          onPress={openManagePanel}
          style={{ marginRight: 16, padding: 4 }}
        >
          <Ionicons name="person-add" size={24} color={theme.colors.primary} />
        </AnimatedPressable>
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
          if (config.legs) setLegs(config.legs);
          if (config.sets) setSets(config.sets);
          if (config.inRule) setInRule(config.inRule);
          if (config.outRule) setOutRule(config.outRule);
          if (config.cricketMode) setCricketMode(config.cricketMode);
          if (config.isRandomizeEnabled !== undefined)
            setIsRandomizeEnabled(config.isRandomizeEnabled);
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
        legs,
        sets,
        inRule,
        outRule,
        cricketMode,
        isRandomizeEnabled,
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
    legs,
    sets,
    inRule,
    outRule,
    cricketMode,
    isRandomizeEnabled,
    selectedPlayers,
  ]);

  useEffect(() => {
    setPlayerOrder(selectedPlayers);
  }, [selectedPlayers]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <DraggableFlatList
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        data={playerOrder}
        keyExtractor={(item) => item as string}
        onDragEnd={({ data }) => setSelectedPlayers(data as string[])}
        ListHeaderComponent={
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t(language, "mode") || "Mode"}
              </Text>
              <AnimatedSegmentedControl
                theme={theme}
                activeOption={gameMode}
                onSelect={setGameMode}
                options={[
                  { id: "X01", label: t(language, "x01") || "X01" },
                  { id: "Cricket", label: t(language, "cricket") || "Cricket" },
                  {
                    id: "Training",
                    label: t(language, "training") || "Training",
                  },
                ]}
              />

              {gameMode === "Training" && (
                <>
                  <Text style={styles.subTitle}>
                    {t(language, "exercise") || "Exercise"}
                  </Text>
                  <AnimatedVerticalSelect
                    theme={theme}
                    activeOption={trainingMode}
                    onSelect={(val: any) => setTrainingMode(val)}
                    options={[
                      {
                        id: "around_the_clock",
                        title:
                          t(language, "aroundTheClock") || "Around the Clock",
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
                    ]}
                  />
                </>
              )}
            </View>

            {gameMode !== "Training" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {t(language, "matchRules") || "Match rules"}
                </Text>
                <View style={styles.stepperRow}>
                  <AnimatedStepper
                    theme={theme}
                    value={sets}
                    setValue={setSets}
                    label={t(language, "sets") || "Sets"}
                    max={30}
                  />
                  <View style={styles.divider} />
                  <AnimatedStepper
                    theme={theme}
                    value={legs}
                    setValue={setLegs}
                    label={t(language, "legs") || "Legs"}
                    max={30}
                  />
                  {gameMode === "X01" && (
                    <>
                      <View style={styles.divider} />
                      <AnimatedStepper
                        theme={theme}
                        value={points}
                        setValue={setPoints}
                        label={t(language, "points") || "Points"}
                        min={101}
                        step={200}
                      />
                    </>
                  )}
                  {gameMode === "Cricket" && (
                    <>
                      <View style={styles.divider} />
                      <AnimatedStepper
                        theme={theme}
                        value={cricketMode}
                        displayValue={
                          cricketMode === "standard"
                            ? t(language, "withScore") || "Score"
                            : t(language, "withoutScore") || "No score"
                        }
                        onLeftPress={() =>
                          setCricketMode(
                            cricketMode === "standard"
                              ? "no-score"
                              : "standard",
                          )
                        }
                        onRightPress={() =>
                          setCricketMode(
                            cricketMode === "standard"
                              ? "no-score"
                              : "standard",
                          )
                        }
                        label={t(language, "scoring") || "Scoring"}
                      />
                    </>
                  )}
                </View>
              </View>
            )}

            <AnimatedPrimaryButton
              title={t(language, "startBtn") || "Start"}
              iconName="arrow-forward"
              theme={theme}
              disabled={playerOrder.length === 0}
              fontSize={18}
              style={{ marginBottom: 16 }}
              onPress={() => {
                if (playerOrder.length === 0) {
                  showAlert(
                    t(language, "error") || "Error",
                    t(language, "noPlayersSelected") ||
                      "Please select players.",
                  );
                  return;
                }
                setPlayers(
                  isRandomizeEnabled
                    ? shufflePlayers(playerOrder)
                    : playerOrder,
                );
                setSettings({
                  inRule,
                  outRule,
                  startPoints: points,
                  legs,
                  sets,
                  gameMode,
                  cricketMode,
                  trainingMode,
                });

                if (gameMode === "X01") router.push("/gamemodes/dart");
                else if (gameMode === "Cricket")
                  router.push("/gamemodes/cricket");
                else if (gameMode === "Training") {
                  if (trainingMode === "around_the_clock")
                    router.push("/gamemodes/aroundtheclock" as any);
                  else if (trainingMode === "100_darts")
                    router.push("/gamemodes/hundreddarts" as any);
                  else if (trainingMode === "bobs_27")
                    router.push("/gamemodes/bobstwentyseven" as any);
                }
              }}
            />

            <View
              style={[
                styles.card,
                styles.playersCardTop,
                playerOrder.length === 0 && styles.playersCardFull,
              ]}
            >
              <View style={styles.playersHeader}>
                <Text style={styles.sectionTitle}>
                  {t(language, "players") || "Players"}
                </Text>
                <View style={styles.playersActions}>
                  {playerOrder.length > 1 && (
                    <AnimatedPressable
                      onPress={() => setIsRandomizeEnabled(!isRandomizeEnabled)}
                      style={[
                        styles.iconBtn,
                        !isRandomizeEnabled && {
                          backgroundColor: theme.colors.dangerLight,
                        },
                      ]}
                    >
                      <Ionicons
                        name="shuffle"
                        size={22}
                        color={
                          !isRandomizeEnabled
                            ? theme.colors.danger
                            : theme.colors.primary
                        }
                      />
                    </AnimatedPressable>
                  )}
                  <AnimatedPressable
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
                    <Ionicons name="add" size={24} color="#fff" />
                  </AnimatedPressable>
                </View>
              </View>

              {playerOrder.length === 0 && (
                <View style={styles.playersList}>
                  <AnimatedPressable
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
                  </AnimatedPressable>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item, drag, isActive, getIndex }: any) => {
          const index = getIndex ? getIndex() : 0;
          return (
            <ScaleDecorator activeScale={1.03}>
              <View style={styles.playersCardMiddle} collapsable={false}>
                <View
                  style={{ paddingBottom: 8, overflow: "visible" }}
                  collapsable={false}
                >
                  <View
                    style={[
                      styles.playerItem,
                      { marginBottom: 0 },
                      isActive && {
                        backgroundColor: theme.colors.background,
                        elevation: 8,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 6,
                        borderColor: theme.colors.primary,
                        zIndex: 999,
                      },
                    ]}
                  >
                    <AnimatedPressable
                      onLongPress={!isRandomizeEnabled ? drag : undefined}
                      delayLongPress={100}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <Ionicons
                        name="reorder-two"
                        size={24}
                        color={theme.colors.textLight}
                        style={{
                          marginRight: 8,
                          opacity: isRandomizeEnabled
                            ? 0.15
                            : isActive
                              ? 0.3
                              : 1,
                        }}
                      />
                      <Text style={styles.playerItemText}>
                        <Text
                          style={{
                            fontWeight: "800",
                            color: theme.colors.textLight,
                          }}
                        >
                          {index + 1}.{" "}
                        </Text>
                        {item}
                      </Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() =>
                        setSelectedPlayers(
                          selectedPlayers.filter((x) => x !== item),
                        )
                      }
                      style={{ padding: 6, marginRight: -2 }}
                      hitSlop={{
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10,
                      }}
                    >
                      <Ionicons
                        name="close"
                        size={24}
                        color={theme.colors.danger}
                      />
                    </AnimatedPressable>
                  </View>
                </View>
              </View>
            </ScaleDecorator>
          );
        }}
        ListFooterComponent={
          <>
            {playerOrder.length > 0 && (
              <View style={styles.playersCardBottom} />
            )}

            {gameMode === "X01" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {t(language, "inOutRules") || "In / Out Rules"}
                </Text>
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={inRule}
                  onSelect={setInRule}
                  options={(["straight", "double", "master"] as const).map(
                    (rule) => ({
                      id: rule,
                      label: t(language, IN_LABELS[rule]),
                    }),
                  )}
                />
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={outRule}
                  onSelect={setOutRule}
                  style={{ marginTop: 10 }}
                  options={(["double", "master", "straight"] as const).map(
                    (rule) => ({
                      id: rule,
                      label: t(language, OUT_LABELS[rule]),
                    }),
                  )}
                />
              </View>
            )}
          </>
        }
      />

      <SelectPlayersModal
        visible={modalVisible}
        title={t(language, "selectPlayers") || "Select players"}
        players={players.filter((p: string) => !selectedPlayers.includes(p))}
        selectedPlayers={tempSelected}
        onTogglePlayer={(p: string) => {
          if (tempSelected.includes(p))
            setTempSelected(tempSelected.filter((x) => x !== p));
          else setTempSelected([...tempSelected, p]);
        }}
        onClose={() => setModalVisible(false)}
        onConfirm={() => {
          setSelectedPlayers([...selectedPlayers, ...tempSelected]);
          setModalVisible(false);
        }}
        confirmText={t(language, "add") || "Add"}
        cancelText={t(language, "cancel") || "Cancel"}
        theme={theme}
        language={language}
      />

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
                    <AnimatedPressable
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
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => handleDeletePlayer(p)}
                      style={styles.dbDeleteBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={theme.colors.danger}
                      />
                    </AnimatedPressable>
                  </View>
                ))
              )}
            </ScrollView>
            <AnimatedPressable
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
            </AnimatedPressable>
          </Animated.View>
        </View>
      </Modal>

      <PlayerModal
        visible={isAddPopupVisible}
        title={
          editingPlayerName
            ? t(language, "editPlayer") || "Edit player"
            : t(language, "newPlayer") || "New player"
        }
        value={newPlayerName}
        onChangeText={setNewPlayerName}
        onClose={() => {
          setAddPopupVisible(false);
          setNewPlayerName("");
          setEditingPlayerName(null);
        }}
        onSave={handleSavePlayer}
        theme={theme}
        language={language}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onRequestClose={() => setAlertVisible(false)}
      />
    </GestureHandlerRootView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 40, overflow: "visible" },
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
      overflow: "visible",
    },
    playersCardTop: {
      marginBottom: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingBottom: 4,
      shadowOpacity: 0,
      elevation: 0,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.cardBorder,
    },
    playersCardMiddle: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderColor: theme.colors.cardBorder,
    },
    playersCardBottom: {
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: theme.colors.cardBorder,
      height: 16,
    },
    playersCardFull: {
      marginBottom: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
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

    stepperRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    divider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.cardBorder,
      marginHorizontal: 4,
      marginTop: 20,
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
    playersList: { marginTop: 4, overflow: "visible" },
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
  });
