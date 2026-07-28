import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../hooks/useAlert";
import { t } from "../../lib/i18n";
import CustomAlert from "../../components/modals/CustomAlert";
import {
  connectToDynamicFirebase,
  parseConnectionString,
  cancelFirebaseRoom,
} from "../../lib/firebaseDynamic";

export default function TournamentLobbyScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();

  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );

  const { roomId, connectionString, isHost } = useLocalSearchParams();

  const [roomData, setRoomData] = useState<any>(null);
  const [firebaseError, setFirebaseError] = useState(false);

  const isStartingRef = useRef(false);
  const isExitingRef = useRef(false);
  const hasNavigatedToBracketRef = useRef(false);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>("");
  const deviceIdRef = useRef<string | null>(null);
  const registered = useRef(false);

  const { showAlert, alertProps } = useAlert(language);

  const parsedConfig = useMemo(() => {
    if (connectionString) {
      return parseConnectionString(connectionString as string);
    }
    return null;
  }, [connectionString]);

  const handleExitLobby = async () => {
    isExitingRef.current = true;
    if (isHost === "true" && parsedConfig) {
      await cancelFirebaseRoom(parsedConfig.configStr, parsedConfig.roomId);
    }
    await AsyncStorage.removeItem("@current_multiplayer_session");
    router.navigate("/(tabs)/tournaments");
  };

  const confirmExitLobby = () => {
    if (isHost === "true") {
      showAlert(
        t(language, "leaveLobbyTitle"),
        t(language, "leaveLobbyHostMsg"),
        [
          { text: t(language, "cancel"), style: "cancel" },
          {
            text: t(language, "leave"),
            style: "destructive",
            onPress: handleExitLobby,
          },
        ],
      );
    } else {
      handleExitLobby();
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isStartingRef.current || isExitingRef.current) return;

      if (e.data.action.type === "GO_BACK") {
        e.preventDefault();
        confirmExitLobby();
      }
    });
    return unsubscribe;
  }, [navigation, isHost, parsedConfig]);

  useEffect(() => {
    const initDevice = async () => {
      let id = await AsyncStorage.getItem("@device_id");
      let name = await AsyncStorage.getItem("@device_name");
      if (!id) {
        id =
          "dev_" +
          Date.now().toString(36) +
          Math.random().toString(36).substring(2);
        await AsyncStorage.setItem("@device_id", id);
      }
      if (!name) {
        name = `${Platform.OS === "ios" ? "iOS" : "Android"} Device ${Math.floor(Math.random() * 1000)}`;
        await AsyncStorage.setItem("@device_name", name);
      }
      setDeviceId(id);
      setDeviceName(name);
      deviceIdRef.current = id;

      await AsyncStorage.removeItem("@bracket_needs_sync");
    };
    initDevice();
  }, []);

  useEffect(() => {
    if (!parsedConfig || !parsedConfig.roomId) {
      setFirebaseError(true);
      return;
    }

    const connection = connectToDynamicFirebase(parsedConfig.configStr);
    if (!connection) {
      setFirebaseError(true);
      return;
    }

    const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const isStaleCache =
            docSnap.metadata.fromCache && !docSnap.metadata.hasPendingWrites;

          setRoomData(data);

          if (
            isHost === "true" &&
            data.pingRequest &&
            data.pingRequest !== data.pingResponse
          ) {
            updateDoc(roomRef, { pingResponse: data.pingRequest }).catch(
              () => {},
            );
          }

          if (!isStaleCache) {
            if (data.status === "in_progress") {
              AsyncStorage.setItem(
                "@current_multiplayer_session",
                JSON.stringify({
                  roomId: parsedConfig.roomId,
                  connectionString: connectionString as string,
                  tournamentName: data.settings?.name || "Tournament",
                  timestamp: Date.now(),
                  isHost: isHost as string,
                }),
              );
            } else if (isHost === "false") {
              AsyncStorage.removeItem("@current_multiplayer_session");
            }
          }

          if (data.status === "cancelled" && !isStaleCache) {
            AsyncStorage.removeItem("@current_multiplayer_session");
            if (isHost === "false") {
              showAlert(
                t(language, "hostLeftTitle"),
                t(language, "hostLeftMessage"),
                undefined,
                () => router.navigate("/(tabs)/tournaments"),
              );
            }
            return;
          }

          const banTimestamp = data.kickedBans?.[deviceIdRef.current as string];
          const isTemporarilyBanned =
            banTimestamp && Date.now() - banTimestamp < 3 * 60 * 1000;
          if (
            isHost === "false" &&
            deviceIdRef.current &&
            (data.kickedDevices?.includes(deviceIdRef.current) ||
              isTemporarilyBanned) &&
            !isStaleCache
          ) {
            AsyncStorage.removeItem("@current_multiplayer_session");
            showAlert(
              t(language, "kickedAlertTitle"),
              t(language, "kickedAlertMessage"),
              undefined,
              () => router.navigate("/(tabs)/tournaments"),
            );
            return;
          }

          if (data.status === "in_progress" && !isStaleCache) {
            if (!hasNavigatedToBracketRef.current) {
              hasNavigatedToBracketRef.current = true;
              isStartingRef.current = true;
              router.replace({
                pathname: "/tournament/bracket",
                params: {
                  tournamentData: JSON.stringify(data.settings),
                  playersData: JSON.stringify(data.players),
                  roomId: parsedConfig.roomId,
                  connectionString: connectionString as string,
                  isHost: isHost as string,
                },
              });
            }
          }
        } else {
          setFirebaseError(true);
        }
      },
      (error) => {
        console.error("Lobby listener error:", error);
        setFirebaseError(true);
      },
    );

    return () => unsubscribe();
  }, [parsedConfig, connectionString, isHost, router, language, showAlert]);

  useEffect(() => {
    if (
      isHost === "false" &&
      parsedConfig &&
      deviceId &&
      deviceName &&
      !registered.current
    ) {
      registered.current = true;

      const registerDevice = async () => {
        const connection = connectToDynamicFirebase(parsedConfig.configStr);
        if (!connection) return;
        const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);

        const docSnap = await getDoc(roomRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const banTimestamp = data.kickedBans?.[deviceId];
          const isTemporarilyBanned =
            banTimestamp && Date.now() - banTimestamp < 3 * 60 * 1000;
          if (data.kickedDevices?.includes(deviceId) || isTemporarilyBanned) {
            return;
          }
        }

        await updateDoc(roomRef, {
          connectedDevices: arrayUnion({ id: deviceId, name: deviceName }),
        });
      };
      registerDevice().catch((e) => console.log(e));

      return () => {
        if (isStartingRef.current) return;
        const connection = connectToDynamicFirebase(parsedConfig.configStr);
        if (connection) {
          const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
          updateDoc(roomRef, {
            connectedDevices: arrayRemove({ id: deviceId, name: deviceName }),
          }).catch((e) => console.log(e));
        }
      };
    }
  }, [isHost, parsedConfig, deviceId, deviceName]);

  const handleStartTournament = async () => {
    if (!parsedConfig) return;
    isStartingRef.current = true;
    const connection = connectToDynamicFirebase(parsedConfig.configStr);
    if (!connection) return;

    const roomRef = doc(connection.db, "rooms", parsedConfig.roomId);
    await updateDoc(roomRef, {
      status: "in_progress",
    });
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

  if (firebaseError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons
          name="warning-outline"
          size={64}
          color={theme.colors.danger}
        />
        <Text style={styles.errorText}>
          {t(language, "roomConnectionError")}
        </Text>
        <AnimatedPrimaryButton
          title={t(language, "goBack")}
          theme={theme}
          onPress={handleExitLobby}
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  if (!roomData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>
          {t(language, "connectingToServer")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top > 0 ? insets.top + 10 : 16 },
        ]}
      >
        <AnimatedPressable onPress={confirmExitLobby} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </AnimatedPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isHost === "true"
            ? `Lobby (${roomData.settings?.name})`
            : `${deviceName} - Lobby - (${roomData.settings?.name})`}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isHost === "true" && (
          <View style={styles.qrCard}>
            <Text style={styles.sectionTitleCenter}>
              {t(language, "scanToJoin")}
            </Text>
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
          </View>
        )}

        <View style={styles.playersCard}>
          <View style={styles.playersHeader}>
            <Text style={styles.sectionTitle}>
              {t(language, "participants")}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {roomData.players?.length || 0}
              </Text>
            </View>
          </View>
          {roomData.players?.map((player: any, index: number) => (
            <View key={player.id} style={styles.playerRow}>
              <Text style={styles.playerRank}>{index + 1}.</Text>
              <Text style={styles.playerName}>{player.name}</Text>
              {player.isTeam && player.members && (
                <Text style={styles.playerMembers}>
                  ({player.members.join(" & ")})
                </Text>
              )}
            </View>
          ))}
        </View>

        {roomData.connectedDevices && roomData.connectedDevices.length > 0 && (
          <View style={styles.playersCard}>
            <View style={styles.playersHeader}>
              <Text style={styles.sectionTitle}>
                {t(language, "connectedDevices")}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {roomData.connectedDevices.length}
                </Text>
              </View>
            </View>
            {roomData.connectedDevices.map((device: any, index: number) => (
              <View key={device.id} style={styles.playerRow}>
                <Text style={styles.playerRank}>{index + 1}.</Text>
                <Text
                  style={[styles.playerName, { flex: 1 }]}
                  numberOfLines={1}
                >
                  {device.name}
                </Text>
                {isHost === "true" && (
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
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.fixedBottomContainer}>
        {isHost === "true" ? (
          <AnimatedPrimaryButton
            title={t(language, "startTournament")}
            iconName="play"
            theme={theme}
            fontSize={18}
            onPress={handleStartTournament}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.waitingText}>
              {t(language, "waitingForHost")}
            </Text>
          </View>
        )}
      </View>

      <CustomAlert {...alertProps} />
    </View>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    centered: { justifyContent: "center", alignItems: "center", padding: 20 },
    loadingText: {
      color: theme.colors.textMuted,
      marginTop: 16,
      fontSize: 16,
      fontWeight: "600",
    },
    errorText: {
      color: theme.colors.textMain,
      marginTop: 16,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    qrCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    sectionTitleCenter: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 20,
      textTransform: "uppercase",
    },
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
    },
    copyHint: {
      fontSize: 10,
      color: theme.colors.textLight,
      marginTop: 8,
      fontStyle: "italic",
    },
    playersCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    playersHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    countBadge: {
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    countBadgeText: {
      color: theme.colors.primary,
      fontWeight: "900",
      fontSize: 14,
    },
    playerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    playerRank: {
      width: 30,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textLight,
    },
    playerName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textMain,
      marginRight: 8,
    },
    playerMembers: { fontSize: 13, color: theme.colors.textMuted },
    kickBtn: {
      padding: 6,
      backgroundColor: theme.colors.dangerLight,
      borderRadius: 8,
    },
    fixedBottomContainer: {
      padding: 16,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
    },
    waitingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      gap: 12,
    },
    waitingText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
  });
