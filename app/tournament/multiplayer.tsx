import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../hooks/useAlert";
import { t } from "../../lib/i18n";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CustomAlert from "../../components/modals/CustomAlert";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import {
  connectToDynamicFirebase,
  parseConnectionString,
  parseFirebaseConfig,
} from "../../lib/firebaseDynamic";
import {
  doc,
  getDocFromServer,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

interface MultiplayerSession {
  roomId: string;
  connectionString: string;
  tournamentName: string;
  timestamp: number;
  isHost?: string;
}

export default function MultiplayerScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );

  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [isConfigModalVisible, setConfigModalVisible] = useState(false);
  const [isDeviceNameModalVisible, setDeviceNameModalVisible] = useState(false);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const { showAlert, alertProps } = useAlert(language);
  const [activeSession, setActiveSession] = useState<MultiplayerSession | null>(
    null,
  );
  const [isResuming, setIsResuming] = useState(false);

  const [pendingHost, setPendingHost] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [isSoftPrompting, setIsSoftPrompting] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleJoin = (code: string) => {
    const parsed = parseConnectionString(code);
    if (!parsed) {
      setJoinCode(code);
      setIsScanning(false);
      setIsSoftPrompting(false);
      setJoinModalVisible(false);
      setTimeout(
        () =>
          showAlert(t(language, "error"), t(language, "invalidJoinCode"), [
            { text: t(language, "ok"), style: "default" },
          ]),
        400,
      );
      return;
    }
    setJoinModalVisible(false);
    setIsScanning(false);
    setIsSoftPrompting(false);
    router.push({
      pathname: "/tournament/lobby",
      params: {
        roomId: parsed.roomId,
        connectionString: code,
        isHost: "false",
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@current_multiplayer_session").then((data) => {
        if (data) {
          setActiveSession(JSON.parse(data));
        } else setActiveSession(null);
      });
    }, []),
  );

  const openHostConfig = async (isHostFlow = false) => {
    setPendingHost(isHostFlow);
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
              [{ text: t(language, "ok"), style: "default" }],
            ),
          400,
        );
        return;
      }
    } else {
      await AsyncStorage.removeItem("@firebase_host_config");
    }
    setConfigModalVisible(false);

    if (pendingHost && firebaseConfigStr.trim().length > 0) {
      setPendingHost(false);
      setTimeout(() => {
        router.push({
          pathname: "/tournament/create",
          params: { isHost: "true" },
        });
      }, 400);
    }
  };

  const openDeviceNameConfig = async (isJoinFlow = false) => {
    setPendingJoin(isJoinFlow);
    const name = await AsyncStorage.getItem("@device_name");
    if (name) {
      setDeviceNameInput(name);
    } else {
      setDeviceNameInput(
        `${Platform.OS === "ios" ? "iOS" : "Android"} Device ${Math.floor(Math.random() * 1000)}`,
      );
    }
    setDeviceNameModalVisible(true);
  };

  const saveDeviceNameConfig = async () => {
    const trimmed = deviceNameInput.trim();
    if (trimmed.length > 0) {
      await AsyncStorage.setItem("@device_name", trimmed);
    }
    setDeviceNameModalVisible(false);

    if (pendingJoin && trimmed.length > 0) {
      setPendingJoin(false);
      setTimeout(() => {
        setJoinModalVisible(true);
      }, 400);
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession) return;
    setIsResuming(true);
    try {
      const parsed = parseConnectionString(activeSession.connectionString);
      if (!parsed) throw new Error("Invalid");

      const connection = connectToDynamicFirebase(parsed.configStr);
      if (!connection) throw new Error("No connection");

      const docRef = doc(connection.db, "rooms", parsed.roomId);
      const snap = await getDocFromServer(docRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "completed" || data.status === "cancelled") {
          throw new Error("Ended");
        }

        const isHostSession = activeSession.isHost === "true";

        if (!isHostSession) {
          const pingId = Date.now().toString();
          await updateDoc(docRef, { pingRequest: pingId }).catch(() => {});

          let unsub: Unsubscribe | undefined;
          const isHostAlive = await new Promise((resolve) => {
            unsub = onSnapshot(docRef, (docSnap) => {
              if (docSnap.exists() && docSnap.data().pingResponse === pingId) {
                resolve(true);
              }
            });
            setTimeout(() => resolve(false), 3000);
          });
          if (unsub) unsub();

          if (!isHostAlive) throw new Error("HostOffline");
        }

        if (data.status === "in_progress") {
          router.push({
            pathname: "/tournament/bracket",
            params: {
              roomId: activeSession.roomId,
              connectionString: activeSession.connectionString,
              isHost: activeSession.isHost || "false",
              tournamentData: JSON.stringify(data.settings),
              playersData: JSON.stringify(data.players),
            },
          });
        } else {
          router.push({
            pathname: "/tournament/lobby",
            params: {
              roomId: activeSession.roomId,
              connectionString: activeSession.connectionString,
              isHost: activeSession.isHost || "false",
            },
          });
        }
      } else throw new Error("Not found");
    } catch (e) {
      showAlert(t(language, "sessionEndedTitle"), t(language, "sessionEndedMsg"), [
        { text: t(language, "ok"), style: "default" },
      ]);
      await AsyncStorage.removeItem("@current_multiplayer_session");
      setActiveSession(null);
    }
    setIsResuming(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top > 0 ? insets.top + 16 : 16 },
        ]}
      >
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textMain} />
          <Text style={styles.backButtonText}>
            {t(language, "changeMode")}
          </Text>
        </AnimatedPressable>
        <Text style={styles.sectionTitleMain}>
          {t(language, "multiplayerOptions")}
        </Text>

        {activeSession && (
          <AnimatedPrimaryButton
            title={
              isResuming
                ? t(language, "resuming")
                : t(language, "resumeMultiplayerSession")?.replace(
                    "{{name}}",
                    activeSession.tournamentName,
                  )
            }
            iconName="reload"
            iconPosition="left"
            color={theme.colors.warning}
            theme={theme}
            disabled={isResuming}
            style={{ marginBottom: 20 }}
            onPress={handleResumeSession}
          />
        )}

        <AnimatedPressable
          style={styles.modeCard}
          onPress={async () => {
            const config = await AsyncStorage.getItem("@firebase_host_config");
            if (!config) {
              openHostConfig(true);
            } else {
              router.push({
                pathname: "/tournament/create",
                params: { isHost: "true" },
              });
            }
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
            {t(language, "hostGame")}
          </Text>
          <Text style={styles.modeDesc}>
            {t(language, "hostGameDesc")}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.modeCard}
          onPress={async () => {
            const name = await AsyncStorage.getItem("@device_name");
            if (!name) {
              openDeviceNameConfig(true);
            } else {
              setJoinModalVisible(true);
            }
          }}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="log-in" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.modeTitle}>
            {t(language, "joinGame")}
          </Text>
          <Text style={styles.modeDesc}>
            {t(language, "joinGameDesc")}
          </Text>
        </AnimatedPressable>
      </ScrollView>

      <Modal
        visible={isDeviceNameModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setDeviceNameModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t(language, "deviceNameConfig")}
            </Text>
            <Text style={styles.modalDesc}>
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
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setConfigModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t(language, "databaseConfigHost")}
            </Text>
            <Text style={styles.modalDesc}>
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
                onPress={() =>
                  Linking.openURL("https://firebase.google.com/docs/web/setup")
                }
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

      <Modal
        visible={isJoinModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setJoinModalVisible(false);
              setIsScanning(false);
              setIsSoftPrompting(false);
              setJoinCode("");
            }}
          />
          {isScanning ? (
            <View style={styles.scannerContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => handleJoin(data)}
              />
              <AnimatedPressable
                style={styles.closeScannerBtn}
                onPress={() => setIsScanning(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </AnimatedPressable>
              <View style={styles.scannerOverlay}>
                <Text style={styles.scannerText}>
                  {t(language, "pointCameraAtQr")}
                </Text>
              </View>
            </View>
          ) : isSoftPrompting ? (
            <View style={styles.modalContent}>
              <View style={styles.softPromptIcon}>
                <Ionicons
                  name="camera-outline"
                  size={36}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.modalTitle}>
                {t(language, "cameraAccess")}
              </Text>
              <Text style={styles.modalDesc}>
                {t(language, "cameraAccessDesc")}
              </Text>
              <View style={styles.modalActions}>
                <AnimatedPressable
                  style={styles.modalBtnCancel}
                  onPress={() => setIsSoftPrompting(false)}
                >
                  <Text style={styles.modalBtnCancelText}>
                    {t(language, "cancel")}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.modalBtnSave}
                  onPress={async () => {
                    const result = await requestPermission();
                    if (result.granted) {
                      setIsSoftPrompting(false);
                      setIsScanning(true);
                    } else {
                      setJoinModalVisible(false);
                      setIsSoftPrompting(false);
                      setTimeout(
                        () =>
                          showAlert(
                            t(language, "error"),
                            t(language, "cameraPermissionDenied"),
                            [
                              {
                                text: t(language, "cancel"),
                                style: "cancel",
                              },
                              {
                                text: t(language, "settings"),
                                style: "default",
                                onPress: () => Linking.openSettings(),
                              },
                            ],
                          ),
                        400,
                      );
                    }
                  }}
                >
                  <Text style={styles.modalBtnSaveText}>
                    {t(language, "continue")}
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {t(language, "joinGame")}
              </Text>
              <Text style={styles.modalDesc}>
                {t(language, "joinGameModalDesc")}
              </Text>
              <View style={styles.joinInputContainer}>
                <TextInput
                  style={styles.joinInputFlexible}
                  placeholder={t(language, "pasteCode")}
                  placeholderTextColor={theme.colors.textMuted}
                  value={joinCode}
                  onChangeText={setJoinCode}
                />
                <AnimatedPressable
                  style={styles.scanBtn}
                  onPress={async () => {
                    if (!permission) return;
                    if (permission.granted) {
                      setIsScanning(true);
                    } else if (permission.status === "denied") {
                      setJoinModalVisible(false);
                      setTimeout(
                        () =>
                          showAlert(
                            t(language, "error"),
                            t(language, "cameraPermissionDenied"),
                            [
                              {
                                text: t(language, "cancel"),
                                style: "cancel",
                              },
                              {
                                text: t(language, "settings"),
                                style: "default",
                                onPress: () => Linking.openSettings(),
                              },
                            ],
                          ),
                        400,
                      );
                    } else {
                      setIsSoftPrompting(true);
                    }
                  }}
                >
                  <Ionicons
                    name="qr-code"
                    size={24}
                    color={theme.colors.primary}
                  />
                </AnimatedPressable>
              </View>
              <View style={styles.modalActions}>
                <AnimatedPressable
                  style={styles.modalBtnCancel}
                  onPress={() => {
                    setJoinModalVisible(false);
                    setJoinCode("");
                  }}
                >
                  <Text style={styles.modalBtnCancelText}>
                    {t(language, "cancel")}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.modalBtnSave, !joinCode && { opacity: 0.5 }]}
                  disabled={!joinCode}
                  onPress={() => handleJoin(joinCode)}
                >
                  <Text style={styles.modalBtnSaveText}>
                    {t(language, "join")}
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <CustomAlert {...alertProps} />
    </View>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
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
    sectionTitleMain: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 24,
      marginTop: 8,
      textAlign: "center",
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
    configBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      padding: 16,
      borderRadius: 14,
      marginBottom: 20,
      justifyContent: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderStyle: "dashed",
    },
    configBtnText: {
      color: theme.colors.textMain,
      fontWeight: "700",
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.textMain,
      marginBottom: 10,
    },
    modalDesc: {
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
    joinInputContainer: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },
    joinInputFlexible: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 12,
      padding: 16,
      color: theme.colors.textMain,
    },
    scanBtn: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 12,
    },
    scannerContainer: {
      height: 400,
      width: "100%",
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: "#000",
      borderWidth: 2,
      borderColor: theme.colors.cardBorder,
    },
    closeScannerBtn: {
      position: "absolute",
      top: 16,
      right: 16,
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: 10,
      borderRadius: 24,
      zIndex: 10,
    },
    scannerOverlay: {
      position: "absolute",
      bottom: 24,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 10,
    },
    scannerText: {
      color: "#fff",
      backgroundColor: "rgba(0,0,0,0.7)",
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      fontSize: 15,
      fontWeight: "800",
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
    softPromptIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.background,
      alignSelf: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
  });
