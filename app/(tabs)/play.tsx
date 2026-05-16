import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useLayoutEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { AnimatedSegmentedControl } from "../../components/common/AnimatedSegmentedControl";
import { AnimatedStepper } from "../../components/common/AnimatedStepper";
import { AnimatedVerticalSelect } from "../../components/common/AnimatedVerticalSelect";
import { AddBotModal } from "../../components/modals/AddBotModal";
import CustomAlert, { AlertButton } from "../../components/modals/CustomAlert";
import { ManagePlayersModal } from "../../components/modals/ManagePlayersModal";
import { PlayerModal } from "../../components/modals/PlayerModal";
import { SelectPlayersModal } from "../../components/modals/SelectPlayersModal";
import { useGame } from "../../context/GameContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePlayers } from "../../context/PlayersContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { isBot } from "../../lib/statsUtils";

const STORAGE_KEY_PLAYERS = "@last_selected_players";
const STORAGE_KEY_CONFIG = "@last_game_config";

const IN_LABELS: Record<string, string> = {
  straight: "straightIn",
  double: "doubleIn",
  master: "masterIn",
};
const OUT_LABELS: Record<string, string> = {
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

const TRAINING_CONFIG = [
  {
    id: "around_the_clock",
    tKey: "aroundTheClock",
    dKey: "aroundTheClockDesc",
    icon: "time-outline",
    route: "/gamemodes/aroundtheclock",
  },
  {
    id: "100_darts",
    tKey: "100Darts",
    dKey: "100DartsDesc",
    icon: "stats-chart-outline",
    route: "/gamemodes/hundreddarts",
  },
  {
    id: "bobs_27",
    tKey: "bobs27",
    dKey: "bobs27Desc",
    icon: "disc-outline",
    route: "/gamemodes/bobstwentyseven",
  },
  {
    id: "catch_40",
    tKey: "catch40",
    dKey: "catch40Desc",
    icon: "flash-outline",
    route: "/gamemodes/catchforty",
  },
  {
    id: "jdc_challenge",
    tKey: "jdcChallenge",
    dKey: "jdcChallengeDesc",
    icon: "star-outline",
    route: "/gamemodes/jdcchallenge",
  },
  {
    id: "bermuda_triangle",
    tKey: "bermudaTriangle",
    dKey: "bermudaTriangleDesc",
    icon: "boat-outline",
    route: "/gamemodes/bermudatriangle",
  },
  {
    id: "shanghai",
    tKey: "shanghai",
    dKey: "shanghaiDesc",
    icon: "medal-outline",
    route: "/gamemodes/shanghai",
  },
  {
    id: "halve_it",
    tKey: "halveIt",
    dKey: "halveItDesc",
    icon: "star-half-outline",
    route: "/gamemodes/halveit",
  },
  {
    id: "baseball",
    tKey: "baseball",
    dKey: "baseballDesc",
    icon: "baseball-outline",
    route: "/gamemodes/baseball",
  },
  {
    id: "chase_the_dragon",
    tKey: "chaseTheDragon",
    dKey: "chaseTheDragonDesc",
    icon: "footsteps-outline",
    route: "/gamemodes/chasethedragon",
  },
  {
    id: "121_checkout",
    tKey: "121Checkout",
    dKey: "121CheckoutDesc",
    icon: "arrow-up-circle-outline",
    route: "/gamemodes/onetwoone",
  },
  {
    id: "killer",
    tKey: "killer",
    dKey: "killerDesc",
    icon: "skull-outline",
    route: "/gamemodes/killer",
  },
  {
    id: "score_clash",
    tKey: "scoreClash",
    dKey: "scoreClashDesc",
    icon: "flame-outline",
    route: "/gamemodes/scoreclash",
  },
] as const;

export default function Play() {
  const { setPlayers, setSettings } = useGame();
  const router = useRouter();
  const navigation = useNavigation();

  const { players, isPlayersLoaded, addPlayer, removePlayer, updatePlayer } =
    usePlayers();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [isBotModalVisible, setBotModalVisible] = useState(false);

  const [gameMode, setGameMode] = useState<"X01" | "Cricket" | "Training">(
    "X01",
  );
  const [trainingMode, setTrainingMode] = useState<
    | "around_the_clock"
    | "100_darts"
    | "bobs_27"
    | "catch_40"
    | "jdc_challenge"
    | "bermuda_triangle"
    | "shanghai"
    | "halve_it"
    | "baseball"
    | "chase_the_dragon"
    | "121_checkout"
    | "killer"
    | "score_clash"
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
  const [lives, setLives] = useState(3);
  const [killerAssignMode, setKillerAssignMode] = useState<"random" | "throw">(
    "random",
  );
  const [killerMode, setKillerMode] = useState<"double" | "treble" | "any">(
    "double",
  );
  const [killerSelfPenalty, setKillerSelfPenalty] = useState(false);
  const [scoreClashDartsPerRound, setScoreClashDartsPerRound] = useState(3);
  const [scoreClashTargetPoints, setScoreClashTargetPoints] = useState(3);
  const [scoreClashTieRule, setScoreClashTieRule] = useState<
    "points" | "tiebreaker"
  >("points");

  const [isLoaded, setIsLoaded] = useState(false);

  const [isManageVisible, setManageVisible] = useState(false);
  const [isAddPopupVisible, setAddPopupVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(
    null,
  );

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
          onPress={() => setManageVisible(true)}
          style={{ marginRight: 16, padding: 4 }}
        >
          <Ionicons name="person-add" size={24} color={theme.colors.primary} />
        </AnimatedPressable>
      ),
    });
  }, [navigation, theme]);

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

  const handleAddBot = (difficulty: number) => {
    let baseName = "";
    if (difficulty === 0) {
      baseName = `${t(language, "bot") || "Bot"} (${t(language, "adaptive") || "Adaptive"})`;
    } else {
      const level = (difficulty - 20) / 5;
      baseName = `${t(language, "bot") || "Bot"} (Lvl ${level})`;
    }

    let finalName = baseName;
    let counter = 1;
    while (selectedPlayers.includes(finalName)) {
      counter++;
      finalName = `${baseName} #${counter}`;
    }

    setSelectedPlayers([...selectedPlayers, finalName]);
    setBotModalVisible(false);
  };

  useEffect(() => {
    if (!isPlayersLoaded || isLoaded) return;

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
          if (config.lives) setLives(config.lives);
          if (config.killerAssignMode)
            setKillerAssignMode(config.killerAssignMode);
          if (config.killerMode) setKillerMode(config.killerMode);
          if (config.killerSelfPenalty !== undefined)
            setKillerSelfPenalty(config.killerSelfPenalty);
          if (config.scoreClashDartsPerRound)
            setScoreClashDartsPerRound(config.scoreClashDartsPerRound);
          if (config.scoreClashTargetPoints)
            setScoreClashTargetPoints(config.scoreClashTargetPoints);
          if (config.scoreClashTieRule)
            setScoreClashTieRule(config.scoreClashTieRule);
          if (config.isRandomizeEnabled !== undefined)
            setIsRandomizeEnabled(config.isRandomizeEnabled);
        }
        const savedPlayers = await AsyncStorage.getItem(STORAGE_KEY_PLAYERS);
        if (savedPlayers !== null) {
          const parsed = JSON.parse(savedPlayers);
          setSelectedPlayers(
            parsed.filter(
              (name: string) => players.includes(name) || isBot(name),
            ),
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
  }, [players, isPlayersLoaded, isLoaded]);

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
        lives,
        killerAssignMode,
        killerMode,
        killerSelfPenalty,
        scoreClashDartsPerRound,
        scoreClashTargetPoints,
        scoreClashTieRule,
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
    lives,
    killerAssignMode,
    killerMode,
    killerSelfPenalty,
    scoreClashDartsPerRound,
    scoreClashTargetPoints,
    scoreClashTieRule,
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
                onSelect={(val: any) =>
                  setGameMode(val as "X01" | "Cricket" | "Training")
                }
                options={[
                  {
                    id: "X01",
                    label: t(language, "x01") || "X01",
                    icon: (isActive: boolean) => (
                      <Ionicons
                        name="contract-outline"
                        size={16}
                        color={isActive ? "#fff" : theme.colors.textMuted}
                      />
                    ),
                  },
                  {
                    id: "Cricket",
                    label: t(language, "cricket") || "Cricket",
                    icon: (isActive: boolean) => (
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={isActive ? "#fff" : theme.colors.textMuted}
                      />
                    ),
                  },
                  {
                    id: "Training",
                    label: t(language, "training") || "Training",
                    icon: (isActive: boolean) => (
                      <Ionicons
                        name="barbell-outline"
                        size={16}
                        color={isActive ? "#fff" : theme.colors.textMuted}
                      />
                    ),
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
                    onSelect={(val: string) =>
                      setTrainingMode(
                        val as
                          | "around_the_clock"
                          | "100_darts"
                          | "bobs_27"
                          | "catch_40"
                          | "jdc_challenge"
                          | "bermuda_triangle"
                          | "shanghai"
                          | "halve_it"
                          | "baseball"
                          | "chase_the_dragon",
                      )
                    }
                    options={[
                      {
                        id: "around_the_clock",
                        title:
                          t(language, "aroundTheClock") || "Around the Clock",
                        desc:
                          t(language, "aroundTheClockDesc") ||
                          "Hit numbers 1-20 sequentially.",
                        icon: (
                          <Ionicons
                            name="time-outline"
                            size={24}
                            color={
                              trainingMode === "around_the_clock"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "100_darts",
                        title: t(language, "100Darts") || "100 Darts (Scoring)",
                        desc:
                          t(language, "100DartsDesc") ||
                          "Throw 100 darts for highest score.",
                        icon: (
                          <Ionicons
                            name="stats-chart-outline"
                            size={24}
                            color={
                              trainingMode === "100_darts"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "bobs_27",
                        title: t(language, "bobs27") || "Bob's 27",
                        desc:
                          t(language, "bobs27Desc") ||
                          "Double training game by Bob Anderson.",
                        icon: (
                          <Ionicons
                            name="disc-outline"
                            size={24}
                            color={
                              trainingMode === "bobs_27"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "catch_40",
                        title: t(language, "catch40") || "Catch 40",
                        desc:
                          t(language, "catch40Desc") ||
                          "Checkout numbers 61 to 100 with max 6 darts each.",
                        icon: (
                          <Ionicons
                            name="flash-outline"
                            size={24}
                            color={
                              trainingMode === "catch_40"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "jdc_challenge",
                        title: t(language, "jdcChallenge") || "JDC Challenge",
                        desc:
                          t(language, "jdcChallengeDesc") ||
                          "Official JDC 57-dart routine: Scoring, Doubles, Scoring.",
                        icon: (
                          <Ionicons
                            name="star-outline"
                            size={24}
                            color={
                              trainingMode === "jdc_challenge"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "bermuda_triangle",
                        title:
                          t(language, "bermudaTriangle") || "Bermuda Triangle",
                        desc:
                          t(language, "bermudaTriangleDesc") ||
                          "Hit specific targets. Miss with all 3 darts and your score is halved!",
                        icon: (
                          <Ionicons
                            name="boat-outline"
                            size={24}
                            color={
                              trainingMode === "bermuda_triangle"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "shanghai",
                        title: t(language, "shanghai") || "Shanghai",
                        desc:
                          t(language, "shanghaiDesc") ||
                          "Hit 1-20 in order. Hit S, D, T in one round for an instant win!",
                        icon: (
                          <Ionicons
                            name="medal-outline"
                            size={24}
                            color={
                              trainingMode === "shanghai"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "halve_it",
                        title: t(language, "halveIt") || "Halve-It",
                        desc:
                          t(language, "halveItDesc") ||
                          "Start with 40 pts. Hit the target or your score is halved!",
                        icon: (
                          <Ionicons
                            name="star-half-outline"
                            size={24}
                            color={
                              trainingMode === "halve_it"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "baseball",
                        title: t(language, "baseball") || "Baseball",
                        desc:
                          t(language, "baseballDesc") ||
                          "Play 9 innings (targets 1-9). Single=1, Double=2, Treble=3 runs.",
                        icon: (
                          <Ionicons
                            name="baseball-outline"
                            size={24}
                            color={
                              trainingMode === "baseball"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "chase_the_dragon",
                        title:
                          t(language, "chaseTheDragon") || "Chase the Dragon",
                        desc:
                          t(language, "chaseTheDragonDesc") ||
                          "Hit 10-20 Singles, then Trebles, Doubles, and Bulls in order.",
                        icon: (
                          <Ionicons
                            name="footsteps-outline"
                            size={24}
                            color={
                              trainingMode === "chase_the_dragon"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "121_checkout",
                        title: t(language, "121Checkout") || "121 Checkout",
                        desc:
                          t(language, "121CheckoutDesc") ||
                          "Finish the score starting from 121 in 9 darts.",
                        icon: (
                          <Ionicons
                            name="arrow-up-circle-outline"
                            size={24}
                            color={
                              trainingMode === "121_checkout"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "killer",
                        title: t(language, "killer") || "Killer",
                        desc:
                          t(language, "killerDesc") ||
                          "Hit your double to become a Killer and eliminate others!",
                        icon: (
                          <Ionicons
                            name="skull-outline"
                            size={24}
                            color={
                              trainingMode === "killer"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                      {
                        id: "score_clash",
                        title: t(language, "scoreClash") || "Score Clash",
                        desc:
                          t(language, "scoreClashDesc") ||
                          "Win rounds by scoring the most points.",
                        icon: (
                          <Ionicons
                            name="flame-outline"
                            size={24}
                            color={
                              trainingMode === "score_clash"
                                ? "#fff"
                                : theme.colors.textMuted
                            }
                          />
                        ),
                      },
                    ]}
                  />
                </>
              )}
            </View>

            {gameMode === "Training" && trainingMode === "killer" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {t(language, "matchRules") || "Match rules"}
                </Text>
                <View
                  style={{ flexDirection: "row", justifyContent: "center" }}
                >
                  <AnimatedStepper
                    theme={theme}
                    value={lives}
                    setValue={setLives}
                    label={t(language, "lives") || "Lives"}
                    min={1}
                    max={15}
                  />
                </View>

                <Text style={[styles.subTitle, { marginTop: 16 }]}>
                  {t(language, "assignNumbers") || "Assign numbers"}
                </Text>
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={killerAssignMode}
                  onSelect={(val) =>
                    setKillerAssignMode(val as "random" | "throw")
                  }
                  options={[
                    { id: "random", label: t(language, "random") || "Random" },
                    {
                      id: "throw",
                      label: t(language, "byThrow") || "By throw",
                    },
                  ]}
                />

                <Text style={[styles.subTitle, { marginTop: 16 }]}>
                  {t(language, "becomeKiller") || "Become Killer"}
                </Text>
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={killerMode}
                  onSelect={(val) =>
                    setKillerMode(val as "double" | "treble" | "any")
                  }
                  options={[
                    {
                      id: "double",
                      label: t(language, "doubleOnly") || "Double only",
                    },
                    {
                      id: "treble",
                      label: t(language, "trebleOnly") || "Treble only",
                    },
                    { id: "any", label: t(language, "anyHit") || "Any hit" },
                  ]}
                />

                <Text style={[styles.subTitle, { marginTop: 16 }]}>
                  {t(language, "selfPenalty") || "Self penalty"}
                </Text>
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={killerSelfPenalty ? "yes" : "no"}
                  onSelect={(val) => setKillerSelfPenalty(val === "yes")}
                  options={[
                    { id: "yes", label: t(language, "yes") || "Yes" },
                    { id: "no", label: t(language, "no") || "No" },
                  ]}
                />
              </View>
            )}

            {gameMode === "Training" && trainingMode === "score_clash" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {t(language, "matchRules") || "Match rules"}
                </Text>
                <View style={styles.stepperRow}>
                  <AnimatedStepper
                    theme={theme}
                    value={scoreClashTargetPoints}
                    setValue={setScoreClashTargetPoints}
                    label={t(language, "targetPoints") || "Target points"}
                    min={1}
                    max={20}
                  />
                  <View style={styles.divider} />
                  <AnimatedStepper
                    theme={theme}
                    value={scoreClashDartsPerRound}
                    setValue={setScoreClashDartsPerRound}
                    label={t(language, "dartsPerRound") || "Darts/Round"}
                    min={3}
                    max={15}
                    step={3}
                  />
                </View>

                <Text style={[styles.subTitle, { marginTop: 16 }]}>
                  {t(language, "tieRule") || "Tie rule"}
                </Text>
                <AnimatedSegmentedControl
                  theme={theme}
                  activeOption={scoreClashTieRule}
                  onSelect={(val) =>
                    setScoreClashTieRule(val as "points" | "tiebreaker")
                  }
                  options={[
                    {
                      id: "points",
                      label: t(language, "pointsForAll") || "Points for all",
                    },
                    {
                      id: "tiebreaker",
                      label: t(language, "tiebreaker") || "Tiebreaker",
                    },
                  ]}
                />
              </View>
            )}

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
                  lives,
                  killerAssignMode,
                  killerMode,
                  killerSelfPenalty,
                  scoreClashDartsPerRound,
                  scoreClashTargetPoints,
                  scoreClashTieRule,
                  trainingMode,
                });

                if (gameMode === "X01") router.push("/gamemodes/dart");
                else if (gameMode === "Cricket")
                  router.push("/gamemodes/cricket");
                else if (gameMode === "Training") {
                  const route = TRAINING_CONFIG.find(
                    (tc) => tc.id === trainingMode,
                  )?.route;
                  if (route) router.push(route as any);
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
                    onPress={() => setBotModalVisible(true)}
                    style={styles.iconBtn}
                  >
                    <Ionicons
                      name="hardware-chip"
                      size={24}
                      color={theme.colors.primary}
                    />
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => {
                      if (allPlayersSelected) return;
                      if (players.length === 0) setManageVisible(true);
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
                        ? () => setManageVisible(true)
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
        renderItem={({
          item,
          drag,
          isActive,
          getIndex,
        }: RenderItemParams<string>) => {
          const index = getIndex ? (getIndex() ?? 0) : 0;
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
                        {isBot(item as string) ? `🤖 ${item}` : item}
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
                  onSelect={(val) =>
                    setInRule(val as "straight" | "double" | "master")
                  }
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
                  onSelect={(val) =>
                    setOutRule(val as "straight" | "double" | "master")
                  }
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

      <ManagePlayersModal
        visible={isManageVisible}
        onClose={() => setManageVisible(false)}
        title={t(language, "managePlayers") || "Manage players"}
        players={players.map((p: string) => ({ id: p, name: p }))}
        onAddPress={() => {
          setEditingPlayerName(null);
          setNewPlayerName("");
          setAddPopupVisible(true);
        }}
        onEditPress={(p: { name: string }) => {
          setEditingPlayerName(p.name);
          setNewPlayerName(p.name);
          setAddPopupVisible(true);
        }}
        onDeletePress={(p: { name: string }) => handleDeletePlayer(p.name)}
        addLabel={t(language, "addNewPlayer") || "Add new player"}
        emptyText={t(language, "noPlayers") || "No more players"}
        theme={theme}
      />

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

      <AddBotModal
        visible={isBotModalVisible}
        onClose={() => setBotModalVisible(false)}
        onAdd={handleAddBot}
        theme={theme}
        language={language}
        gameMode={gameMode}
        trainingMode={trainingMode}
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

const getStyles = (theme: { colors: Record<string, string> }) =>
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
  });
