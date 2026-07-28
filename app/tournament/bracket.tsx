import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  useNavigation,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";
import CustomAlert from "../../components/modals/CustomAlert";
import DoubleKnockout from "../../components/tournament/DoubleKnockout";
import GroupsAndKnockout from "../../components/tournament/GroupsAndKnockout";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { SharedMatch } from "../../components/tournament/MatchCard";
import RoundRobin from "../../components/tournament/RoundRobin";
import SingleKnockout from "../../components/tournament/SingleKnockout";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../hooks/useAlert";
import { t } from "../../lib/i18n";
import {
  Match,
  MatchStatItem,
  PlayerMatchStats,
  TournamentSettings,
} from "../../lib/statsUtils";
import { useMatchStore } from "../../store/useMatchStore";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayRemove,
  arrayUnion,
} from "firebase/firestore";
import {
  connectToDynamicFirebase,
  parseConnectionString,
  cancelFirebaseRoom,
} from "../../lib/firebaseDynamic";

export default function TournamentBracketScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const isExitingRef = useRef(false);
  const {
    tournamentData,
    playersData,
    bracketData,
    isHistoryView,
    roomId,
    connectionString,
    isHost,
  } = useLocalSearchParams();

  const settings = useMemo<TournamentSettings | null>(
    () => (tournamentData ? JSON.parse(tournamentData as string) : null),
    [tournamentData],
  );
  const players = useMemo<PlayerMatchStats[]>(
    () => (playersData ? JSON.parse(playersData as string) : []),
    [playersData],
  );
  const initialBracket = useMemo<SharedMatch[] | null>(
    () => (bracketData ? JSON.parse(bracketData as string) : null),
    [bracketData],
  );

  const parsedConfig = useMemo(() => {
    if (connectionString) {
      return parseConnectionString(connectionString as string);
    }
    return null;
  }, [connectionString]);

  const isHostBool = isHost !== "false";

  const deviceIdRef = useRef<string | null>(null);
  const registered = useRef(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>("");
  const [firebaseBracket, setFirebaseBracket] = useState<SharedMatch[] | null>(
    null,
  );
  const [connectedDevices, setConnectedDevices] = useState<
    { id: string; name: string }[]
  >([]);
  const [isDevicesModalVisible, setDevicesModalVisible] = useState(false);
  const { showAlert, alertProps } = useAlert(language);

  useEffect(() => {
    const initDevice = async () => {
      const id = await AsyncStorage.getItem("@device_id");
      const name = await AsyncStorage.getItem("@device_name");
      deviceIdRef.current = id;
      setDeviceId(id);
      setDeviceName(name || "Unknown Device");
    };
    initDevice();
  }, []);

  useEffect(() => {
    if (
      !isHostBool &&
      parsedConfig &&
      deviceId &&
      deviceName &&
      isHistoryView !== "true" &&
      !registered.current
    ) {
      registered.current = true;

      const registerDevice = async () => {
        const connection = connectToDynamicFirebase(parsedConfig.configStr);
        if (!connection) return;
        const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);

        await updateDoc(roomRef, {
          connectedDevices: arrayUnion({ id: deviceId, name: deviceName }),
        });
      };
      registerDevice().catch((e) => console.log(e));

      return () => {
        const connection = connectToDynamicFirebase(parsedConfig.configStr);
        if (connection) {
          const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
          updateDoc(roomRef, {
            connectedDevices: arrayRemove({ id: deviceId, name: deviceName }),
          }).catch((e) => console.log(e));
        }
      };
    }
  }, [isHostBool, parsedConfig, deviceId, deviceName, isHistoryView]);

  useEffect(() => {
    if (!parsedConfig || !parsedConfig.roomId) return;
    const connection = connectToDynamicFirebase(parsedConfig.configStr);
    if (!connection) return;

    const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isStaleCache =
          docSnap.metadata.fromCache && !docSnap.metadata.hasPendingWrites;

        if (
          !isStaleCache &&
          (data.status === "completed" || data.status === "cancelled")
        ) {
          await AsyncStorage.removeItem("@current_multiplayer_session");
        }

        if (data.connectedDevices) {
          setConnectedDevices(data.connectedDevices);
        }

        if (
          isHostBool &&
          data.pingRequest &&
          data.pingRequest !== data.pingResponse
        ) {
          updateDoc(roomRef, { pingResponse: data.pingRequest }).catch(
            () => {},
          );
        }

        if (deviceIdRef.current && !isHostBool) {
          const banTimestamp = data.kickedBans?.[deviceIdRef.current];
          const isTemporarilyBanned =
            banTimestamp && Date.now() - banTimestamp < 3 * 60 * 1000;
          if (
            (data.kickedDevices?.includes(deviceIdRef.current) ||
              isTemporarilyBanned) &&
            !isStaleCache
          ) {
            DeviceEventEmitter.emit("force_exit_match");
            showAlert(
              t(language, "kickedAlertTitle"),
              t(language, "kickedAlertMessage"),
              [{ text: t(language, "ok"), style: "default" }],
              () => router.navigate("/(tabs)/tournaments"),
            );
            return;
          }
        }

        if (data.bracket) {
          const needsSync = await AsyncStorage.getItem("@bracket_needs_sync");
          if (needsSync === "true") return;

          setFirebaseBracket(data.bracket);

          Promise.resolve().then(async () => {
            const keysToRemove: string[] = [];
            const storeState = useMatchStore.getState() as {
              matches?: Record<string, unknown>;
              games?: Record<string, unknown>;
            };
            const targetKey = storeState.matches
              ? "matches"
              : storeState.games
                ? "games"
                : null;
            const stateUpdates: Record<string, unknown> = {};

            for (const m of data.bracket) {
              const hasScore =
                m.score &&
                (m.score.p1Sets > 0 ||
                  m.score.p1Legs > 0 ||
                  m.score.p2Sets > 0 ||
                  m.score.p2Legs > 0);
              if (!m.hasProgress && !hasScore && !m.isInProgress) {
                keysToRemove.push(`match_save_${m.id}`);
              } else if (m.gameState) {
                await AsyncStorage.setItem(
                  `match_save_${m.id}`,
                  JSON.stringify(m.gameState),
                );
                if (targetKey && !m.isInProgress) {
                  stateUpdates[m.id] = m.gameState;
                }
              }
            }

            if (Object.keys(stateUpdates).length > 0 && targetKey) {
              if (targetKey === "matches") {
                useMatchStore.setState({
                  matches: {
                    ...(storeState.matches || {}),
                    ...stateUpdates,
                  },
                } as unknown as Partial<
                  ReturnType<typeof useMatchStore.getState>
                >);
              } else if (targetKey === "games") {
                useMatchStore.setState({
                  games: {
                    ...(storeState.games || {}),
                    ...stateUpdates,
                  },
                } as unknown as Partial<
                  ReturnType<typeof useMatchStore.getState>
                >);
              }
            }

            if (keysToRemove.length > 0) {
              await AsyncStorage.multiRemove(keysToRemove);
              useMatchStore
                .getState()
                .clearMultipleMatches(
                  keysToRemove.map((k: string) => k.replace("match_save_", "")),
                );
            }
            const bKey = `bracket_structure_${String(data.settings?.name || "").replace(/\s/g, "_")}`;
            await AsyncStorage.setItem(bKey, JSON.stringify(data.bracket));
          });
        }
      }
    });
    return () => unsubscribe();
  }, [parsedConfig]);

  useFocusEffect(
    useCallback(() => {
      const syncHostBracket = async () => {
        if (parsedConfig && settings) {
          const bKey = `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`;
          const savedStr = await AsyncStorage.getItem(bKey);
          const needsSync = await AsyncStorage.getItem("@bracket_needs_sync");

          if (savedStr) {
            let parsedBracket = JSON.parse(savedStr);
            let hasStuckMatches = false;

            if (deviceIdRef.current) {
              parsedBracket = parsedBracket.map((m: SharedMatch) => {
                if (
                  m.isInProgress &&
                  m.inProgressDeviceId === deviceIdRef.current
                ) {
                  hasStuckMatches = true;
                  return {
                    ...m,
                    isInProgress: false,
                    inProgressDeviceName: null,
                    inProgressDeviceId: null,
                  };
                }
                return m;
              });
            }

            if (needsSync === "true" || hasStuckMatches) {
              if (hasStuckMatches && needsSync !== "true") {
                await AsyncStorage.setItem(bKey, JSON.stringify(parsedBracket));
              }
              setFirebaseBracket(parsedBracket);
              const connection = connectToDynamicFirebase(
                parsedConfig.configStr,
              );
              if (connection) {
                const roomRef = doc(
                  connection.db,
                  "rooms",
                  parsedConfig.roomId,
                );
                const sanitizedData = JSON.parse(JSON.stringify(parsedBracket));
                await updateDoc(roomRef, { bracket: sanitizedData });
              }
            }
          }
          if (needsSync === "true") {
            await AsyncStorage.removeItem("@bracket_needs_sync");
          }
        }
      };
      syncHostBracket();
    }, [parsedConfig, settings]),
  );

  const handleExitTournament = async () => {
    isExitingRef.current = true;
    if (isHostBool && parsedConfig) {
      await cancelFirebaseRoom(parsedConfig.configStr, parsedConfig.roomId);
    }
    await AsyncStorage.removeItem("@current_multiplayer_session");
    router.navigate("/(tabs)/tournaments");
  };

  const confirmExitTournament = () => {
    if (isHostBool && parsedConfig) {
      showAlert(
        t(language, "leaveTournamentTitle"),
        t(language, "leaveTournamentHostMsg"),
        [
          { text: t(language, "cancel"), style: "cancel" },
          {
            text: t(language, "leave"),
            style: "destructive",
            onPress: handleExitTournament,
          },
        ],
      );
    } else {
      handleExitTournament();
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isHistoryView === "true" || isExitingRef.current) return;

      if (e.data.action.type === "GO_BACK") {
        e.preventDefault();
        confirmExitTournament();
      }
    });
    return unsubscribe;
  }, [navigation, isHistoryView, isHostBool, parsedConfig]);

  const pushBracketToFirebase = async (bracketData: SharedMatch[]) => {
    if (parsedConfig) {
      const connection = connectToDynamicFirebase(parsedConfig.configStr);
      if (connection) {
        const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
        const sanitizedData = JSON.parse(JSON.stringify(bracketData));
        await updateDoc(roomRef, { bracket: sanitizedData });
      }
    }
  };

  const executeKickDevice = async (device: { id: string; name: string }) => {
    if (!parsedConfig) return;
    const connection = connectToDynamicFirebase(parsedConfig.configStr);
    if (!connection) return;
    const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
    await updateDoc(roomRef, {
      connectedDevices: arrayRemove(device),
      [`kickedBans.${device.id}`]: Date.now(),
    });
  };

  const confirmKickDevice = (device: { id: string; name: string }) => {
    showAlert(
      t(language, "kickDeviceTitle"),
      t(language, "kickDeviceMessage")?.replace("{{name}}", device.name) ||
        `Are you sure you want to disconnect device '${device.name}' from the tournament?`,
      [
        { text: t(language, "cancel"), style: "cancel" },
        {
          text: t(language, "delete"),
          style: "destructive",
          onPress: () => executeKickDevice(device),
        },
      ],
    );
  };

  const statLabels: Record<string, string> = useMemo(
    () => ({
      Legs: t(language, "legs"),
      "Darts Thrown": t(language, "dartsThrown"),
      "3 Darts": t(language, "threeDartsAvg"),
      "First 9": t(language, "firstNine"),
      "High Finish": t(language, "highFinish"),
      "100+ Finishes": t(language, "hundredPlusFinishes"),
      "Best Leg": t(language, "bestLeg"),
      "Worst Leg": t(language, "worstLeg"),
      "Checkout %": t(language, "checkoutPct"),
    }),
    [language],
  );

  const [viewMode, setViewMode] = useState<"list" | "tree">("tree");
  const [isQrModalVisible, setQrModalVisible] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isStatsModalVisible, setStatsModalVisible] = useState(false);

  const [isSaved, setIsSaved] = useState(false);
  const [rrViewMode, setRrViewMode] = useState<"matches" | "standings">(
    "matches",
  );
  const [phaseView, setPhaseView] = useState<"group" | "knockout">("group");

  useEffect(() => {
    const checkFinished = async () => {
      if (!settings || isHistoryView === "true" || isSaved) return;
      try {
        let bracket = firebaseBracket;
        if (!bracket) {
          const bracketStorageKey = `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`;
          const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
          if (savedBracketStr) bracket = JSON.parse(savedBracketStr);
        }
        if (bracket && Array.isArray(bracket)) {
          let isFinished = false;
          if (settings.format === "round_robin") {
            isFinished =
              bracket.length > 0 &&
              bracket.every((m: SharedMatch) => m.winner !== null || m.isBye);
          } else if (
            settings.format === "groups_and_knockout" ||
            settings.format === "groups_and_double_knockout"
          ) {
            const koMatches = bracket.filter(
              (m: SharedMatch) => m.phase === "knockout",
            );
            const relevantKoMatches =
              settings.format === "groups_and_double_knockout"
                ? koMatches.filter((m: SharedMatch) => m.bracket === "gf")
                : koMatches;
            if (relevantKoMatches.length > 0) {
              const totalR = Math.max(
                ...relevantKoMatches.map((m: SharedMatch) => m.round || 0),
              );
              const finalRoundMatches = relevantKoMatches.filter(
                (m: SharedMatch) => m.round === totalR,
              );
              isFinished =
                finalRoundMatches.length > 0 &&
                finalRoundMatches.every(
                  (m: SharedMatch) => m.winner !== null || m.isBye,
                );
            }
          } else {
            const relevantMatches =
              settings.format === "double_knockout"
                ? bracket.filter((m: SharedMatch) => m.bracket === "gf")
                : bracket;
            const totalR = Math.max(
              ...relevantMatches.map((m: SharedMatch) => m.round || 0),
            );
            const finalRoundMatches = relevantMatches.filter(
              (m: SharedMatch) => m.round === totalR,
            );
            isFinished =
              finalRoundMatches.length > 0 &&
              finalRoundMatches.every(
                (m: SharedMatch) => m.winner !== null || m.isBye,
              );
          }
          if (isFinished) {
            showAlert(
              t(language, "tournamentFinishedTitle"),
              t(language, "tournamentFinishedMsg"),
              [{ text: t(language, "ok"), onPress: handleSaveAndStay }],
            );
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    checkFinished();
  }, [settings, isHistoryView, isSaved, firebaseBracket]);

  const handleSaveAndStay = async () => {
    setIsSaved(true);
    if (!settings) return;
    try {
      const bracketStorageKey = `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`;
      const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
      const bracket = savedBracketStr ? JSON.parse(savedBracketStr) : [];

      const historyItem = {
        id: Date.now().toString(),
        finishedAt: dayjs().toISOString(),
        settings,
        players,
        bracket,
      };

      const historyStr = await AsyncStorage.getItem("@tournament_history");
      const historyArr = historyStr ? JSON.parse(historyStr) : [];
      historyArr.unshift(historyItem);
      await AsyncStorage.setItem(
        "@tournament_history",
        JSON.stringify(historyArr),
      );

      const selectedPlayersKey = `@dart_selected_players_${String(settings.name || "").replace(/\s/g, "_")}`;
      const keysToRemove = [bracketStorageKey, selectedPlayersKey];
      const matchIdsToRemove: string[] = [];
      if (Array.isArray(bracket)) {
        bracket.forEach((match: Match) => {
          matchIdsToRemove.push(match.id);
        });
      }
      await AsyncStorage.multiRemove(keysToRemove);
      useMatchStore.getState().clearMultipleMatches(matchIdsToRemove);

      const savedArrStr = await AsyncStorage.getItem("@active_tournaments");
      if (savedArrStr) {
        let savedArr = JSON.parse(savedArrStr);
        savedArr = savedArr.filter(
          (t: { settings: { name: string } }) =>
            t.settings.name !== settings.name,
        );
        await AsyncStorage.setItem(
          "@active_tournaments",
          JSON.stringify(savedArr),
        );
      }

      if (isHostBool && parsedConfig) {
        const connection = connectToDynamicFirebase(parsedConfig.configStr);
        if (connection) {
          const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
          await updateDoc(roomRef, { status: "completed" });
        }
      }
      await AsyncStorage.removeItem("@current_multiplayer_session");
    } catch (e) {
      console.error("Error saving to history:", e);
    }
  };

  const handleMatchPress = (match: SharedMatch | Match) => {
    setSelectedMatch(match as Match);
    setStatsModalVisible(true);
  };

  if (!settings || !players || players.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: theme.colors.textMain }}>
          {t(language, "tournamentLoadError")}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (isHistoryView === "true") router.back();
            else router.navigate("/(tabs)/tournaments");
          }}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: theme.colors.primary }}>
            {t(language, "goBack")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isHistoryView === "true") router.back();
            else confirmExitTournament();
          }}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {settings.name ||
            t(language, "tournamentBracket")}
        </Text>

        <View style={styles.headerRight}>
          {isHostBool && parsedConfig && (
            <TouchableOpacity
              onPress={() => setQrModalVisible(true)}
              style={styles.headerBtn}
            >
              <Ionicons
                name="qr-code-outline"
                size={24}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}

          {(settings.format === "single_knockout" ||
            settings.format === "double_knockout" ||
            ((settings.format === "groups_and_knockout" ||
              settings.format === "groups_and_double_knockout") &&
              phaseView === "knockout")) && (
            <TouchableOpacity
              onPress={() =>
                setViewMode((v: "list" | "tree") =>
                  v === "list" ? "tree" : "list",
                )
              }
              style={styles.headerBtn}
            >
              <Ionicons
                name={viewMode === "list" ? "git-network-outline" : "list"}
                size={26}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}

          {(settings.format === "round_robin" ||
            ((settings.format === "groups_and_knockout" ||
              settings.format === "groups_and_double_knockout") &&
              phaseView === "group")) && (
            <TouchableOpacity
              onPress={() =>
                setRrViewMode((v: "matches" | "standings") =>
                  v === "matches" ? "standings" : "matches",
                )
              }
              style={styles.headerBtn}
            >
              <Ionicons
                name={rrViewMode === "matches" ? "podium-outline" : "list"}
                size={26}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!!settings.desc && (
        <Pressable
          style={{ paddingHorizontal: 16, paddingBottom: 10 }}
          onPress={() => setIsDescExpanded(!isDescExpanded)}
        >
          <Text
            style={{
              fontSize: 13,
              color: theme.colors.textMain,
              lineHeight: 18,
            }}
            numberOfLines={isDescExpanded ? undefined : 2}
          >
            {settings.desc}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: theme.colors.primary,
              marginTop: 4,
            }}
          >
            {isDescExpanded
              ? t(language, "showLess")
              : t(language, "showMore")}
          </Text>
        </Pressable>
      )}

      {settings.format === "groups_and_knockout" ||
      settings.format === "groups_and_double_knockout" ? (
        <GroupsAndKnockout
          players={players}
          settings={settings}
          onMatchPress={handleMatchPress}
          initialBracket={firebaseBracket || initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
          activeTab={rrViewMode}
          viewMode={viewMode}
          isHost={isHostBool}
          onBracketGenerated={pushBracketToFirebase}
          phaseView={phaseView}
          setPhaseView={setPhaseView}
        />
      ) : settings.format === "double_knockout" ? (
        <DoubleKnockout
          players={players}
          settings={settings}
          viewMode={viewMode}
          onMatchPress={handleMatchPress}
          initialBracket={firebaseBracket || initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
          isHost={isHostBool}
          onBracketGenerated={pushBracketToFirebase}
        />
      ) : settings.format === "round_robin" ? (
        <RoundRobin
          players={players}
          settings={settings}
          onMatchPress={handleMatchPress}
          initialBracket={firebaseBracket || initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
          activeTab={rrViewMode}
          isHost={isHostBool}
          onBracketGenerated={pushBracketToFirebase}
        />
      ) : (
        <SingleKnockout
          players={players}
          settings={settings}
          viewMode={viewMode}
          onMatchPress={handleMatchPress}
          initialBracket={firebaseBracket || initialBracket}
          isReadOnly={isHistoryView === "true" || isSaved}
          isHost={isHostBool}
          onBracketGenerated={pushBracketToFirebase}
        />
      )}

      <Modal
        visible={isStatsModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setStatsModalVisible(false)}
          />

          {selectedMatch && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t(language, "matchStatsTitle")}
                </Text>
                <AnimatedPressable
                  onPress={() => setStatsModalVisible(false)}
                  style={styles.closeModalBtn}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.textMuted}
                  />
                </AnimatedPressable>
              </View>

              <View style={styles.playersTitleRow}>
                <Text
                  style={[
                    styles.playerHeaderName,
                    selectedMatch.winner?.id === selectedMatch.player1?.id &&
                      styles.winnerName,
                  ]}
                >
                  {selectedMatch.player1?.name}
                </Text>
                <Text style={styles.vsText}>VS</Text>
                <Text
                  style={[
                    styles.playerHeaderName,
                    selectedMatch.winner?.id === selectedMatch.player2?.id &&
                      styles.winnerName,
                  ]}
                >
                  {selectedMatch.player2?.name}
                </Text>
              </View>

              <ScrollView
                style={styles.statsScroll}
                showsVerticalScrollIndicator={false}
              >
                {selectedMatch.stats && selectedMatch.stats.length > 0 ? (
                  selectedMatch.stats.map(
                    (stat: MatchStatItem, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.statRow,
                          idx % 2 === 0 && styles.statRowAlternate,
                        ]}
                      >
                        <Text style={styles.statValueLeft}>{stat.p1}</Text>
                        <Text style={styles.statLabelCenter}>
                          {statLabels[stat.label] || stat.label}
                        </Text>
                        <Text style={styles.statValueRight}>{stat.p2}</Text>
                      </View>
                    ),
                  )
                ) : (
                  <View style={{ padding: 30, alignItems: "center" }}>
                    <Ionicons
                      name="analytics-outline"
                      size={40}
                      color={theme.colors.textMuted}
                    />
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        marginTop: 10,
                        textAlign: "center",
                      }}
                    >
                      {t(language, "noStatsData")}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {selectedMatch.logs && selectedMatch.logs.length > 0 ? (
                <AnimatedPressable
                  style={styles.showLogsBtn}
                  onPress={() => {
                    setStatsModalVisible(false);
                    router.push({
                      pathname: "/tournament/match-logs",
                      params: {
                        matchData: JSON.stringify(selectedMatch),
                        settingsData: JSON.stringify(settings),
                      },
                    });
                  }}
                >
                  <Ionicons name="list-outline" size={18} color="#fff" />
                  <Text style={styles.showLogsBtnText}>
                    {t(language, "showPlayedLegs")}
                  </Text>
                </AnimatedPressable>
              ) : (
                <Text style={styles.disclaimerText}>
                  {t(language, "statsDisclaimer")}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={isQrModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setQrModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.qrModalHeader}>
              <AnimatedPressable
                onPress={() => setQrModalVisible(false)}
                style={styles.qrCloseBtn}
              >
                <Ionicons
                  name="close"
                  size={28}
                  color={theme.colors.textMain}
                />
              </AnimatedPressable>
              <Text style={styles.qrModalTitle}>
                {t(language, "scanToJoin")}
              </Text>
              <View style={{ width: 28 }} />
            </View>
            <View style={{ alignItems: "center", width: "100%" }}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={connectionString as string}
                  size={200}
                  color={theme.colors.textMain}
                  backgroundColor={theme.colors.card}
                />
              </View>
              <Text style={styles.connectionStringCode} selectable={true}>
                {connectionString}
              </Text>
              <Text style={styles.copyHint}>
                {t(language, "copyHint")}
              </Text>

              <AnimatedPrimaryButton
                title={t(language, "viewDevices")}
                theme={theme}
                onPress={() => {
                  setQrModalVisible(false);
                  setDevicesModalVisible(true);
                }}
                style={{ marginTop: 24, width: "100%" }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isDevicesModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setDevicesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setDevicesModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.qrModalHeader}>
              <AnimatedPressable
                onPress={() => setDevicesModalVisible(false)}
                style={styles.qrCloseBtn}
              >
                <Ionicons
                  name="close"
                  size={28}
                  color={theme.colors.textMain}
                />
              </AnimatedPressable>
              <Text style={styles.qrModalTitle}>
                {t(language, "connectedDevices")}
              </Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={{ maxHeight: 300, width: "100%" }}>
              {connectedDevices.length === 0 ? (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    textAlign: "center",
                    marginTop: 20,
                  }}
                >
                  {t(language, "noDevices")}
                </Text>
              ) : (
                connectedDevices.map((device, index) => (
                  <View key={device.id} style={styles.deviceRow}>
                    <Text style={styles.deviceRank}>{index + 1}.</Text>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {device.name}
                    </Text>
                    {isHostBool && (
                      <AnimatedPressable
                        onPress={() => confirmKickDevice(device)}
                        style={styles.kickBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={theme.colors.danger}
                        />
                      </AnimatedPressable>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert {...alertProps} />
    </View>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      textAlign: "center",
      marginHorizontal: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
    },
    playersTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary,
      paddingBottom: 16,
      marginBottom: 8,
    },
    playerHeaderName: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    winnerName: { color: theme.colors.success },
    vsText: {
      width: 40,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    statsScroll: { flexGrow: 0 },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    statRowAlternate: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
    },
    statValueLeft: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    statLabelCenter: {
      flex: 1.5,
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    statValueRight: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textMain,
      textAlign: "center",
    },
    disclaimerText: {
      textAlign: "center",
      fontSize: 11,
      color: theme.colors.textLight,
      marginTop: 16,
      fontStyle: "italic",
    },
    showLogsBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 16,
      gap: 8,
    },
    showLogsBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    qrModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 24,
    },
    qrModalTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.textMain,
      textTransform: "uppercase",
    },
    qrCloseBtn: { padding: 2 },
    qrWrapper: {
      padding: 16,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    connectionStringCode: {
      marginTop: 20,
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: "center",
      backgroundColor: theme.colors.background,
      padding: 10,
      borderRadius: 8,
      overflow: "hidden",
      width: "100%",
    },
    copyHint: {
      fontSize: 10,
      color: theme.colors.textLight,
      marginTop: 8,
      fontStyle: "italic",
      textAlign: "center",
    },
    deviceRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
      width: "100%",
    },
    deviceRank: {
      width: 30,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textLight,
    },
    deviceName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textMain,
      marginRight: 8,
    },
    kickBtn: {
      padding: 6,
      backgroundColor: theme.colors.dangerLight,
      borderRadius: 8,
    },
  });
