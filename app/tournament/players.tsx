import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomAlert from "../../components/CustomAlert";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";

type Player = { id: string; name: string };

const TOURNAMENT_PLAYERS_KEY = "@dart_tournament_players";

const PlayerRow = React.memo(
  ({ player, isSelected, onToggle, onEdit, theme, styles }: any) => (
    <TouchableOpacity
      style={styles.playerSelectRow}
      activeOpacity={0.7}
      onPress={() => onToggle(player.id)}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          style={styles.nameClickArea}
          onPress={() => onEdit(player)}
        >
          <Text
            style={styles.playerSelectName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {player.name}
          </Text>
          <Ionicons
            name="pencil-sharp"
            size={14}
            color={theme.colors.textLight}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
        {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
    </TouchableOpacity>
  ),
);

export default function TournamentPlayersScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const router = useRouter();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { tournamentData } = useLocalSearchParams();
  const settings = tournamentData ? JSON.parse(tournamentData as string) : null;

  const selectedPlayersKey = settings
    ? `@dart_selected_players_${String(settings.name || "").replace(/\s/g, "_")}`
    : "";
  const bracketStorageKey = settings
    ? `bracket_structure_${String(settings.name || "").replace(/\s/g, "_")}`
    : "";

  const minPlayers = settings?.teamSize === "team" ? 4 : 2;

  const formatLabels: Record<string, string> = {
    single_knockout: t(language, "singleKnockout") || "Single Knockout",
    double_knockout: t(language, "doubleKnockout") || "Double Knockout",
    round_robin: t(language, "roundRobin") || "Round Robin",
    groups_and_knockout:
      t(language, "groupsAndKnockout") || "Groups + Knockout",
    groups_and_double_knockout:
      t(language, "groupsAndDoubleKnockout") || "Groups + Double Knockout",
  };

  const [tournamentPlayersDb, setTournamentPlayersDb] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);

  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");

  const [isBackModalVisible, setBackModalVisible] = useState(false);
  const [duplicateErrorVisible, setDuplicateErrorVisible] = useState(false);

  const [hasExistingBracket, setHasExistingBracket] = useState(false);
  const [resetAlertVisible, setResetAlertVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const isExiting = useRef(false);
  const pendingNavAction = useRef<any>(null);

  useEffect(() => {
    const loadDb = async () => {
      try {
        const savedPlayers = await AsyncStorage.getItem(TOURNAMENT_PLAYERS_KEY);
        if (savedPlayers) {
          setTournamentPlayersDb(JSON.parse(savedPlayers));
        }
      } catch (error) {
        console.error("Error loading DB", error);
      }
    };
    loadDb();
  }, []);

  useEffect(() => {
    setVisibleCount(25);
  }, [playerSearchQuery]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isExiting.current) return;
      e.preventDefault();
      pendingNavAction.current = e.data.action;
      setBackModalVisible(true);
    });

    return unsubscribe;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const loadTournamentState = async () => {
        if (!settings) return;
        try {
          const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
          setHasExistingBracket(!!savedBracketStr);

          if (selectedPlayersKey) {
            const savedSelected =
              await AsyncStorage.getItem(selectedPlayersKey);
            if (savedSelected) {
              setSelectedPlayerIds(JSON.parse(savedSelected));
            } else {
              setSelectedPlayerIds([]);
            }
          }
        } catch (error) {
          console.error("Error loading tournament state", error);
        }
      };
      loadTournamentState();
    }, [selectedPlayersKey, bracketStorageKey]),
  );

  const saveToDb = async (data: Player[]) => {
    try {
      await AsyncStorage.setItem(TOURNAMENT_PLAYERS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving tournament players", error);
    }
  };

  const wipeTournamentProgress = async () => {
    try {
      if (!bracketStorageKey) return;
      const savedBracketStr = await AsyncStorage.getItem(bracketStorageKey);
      const keysToRemove = [bracketStorageKey];

      if (savedBracketStr) {
        const savedBracket = JSON.parse(savedBracketStr);
        if (Array.isArray(savedBracket)) {
          if (selectedPlayersKey) keysToRemove.push(selectedPlayersKey);

          savedBracket.forEach((match: any) => {
            keysToRemove.push(`match_save_${match.id}`);
          });
        }
      }
      await AsyncStorage.multiRemove(keysToRemove);
      setHasExistingBracket(false);
      setSelectedPlayerIds([]);
    } catch (e) {
      console.error("Error restarting tournament", e);
    }
  };

  const executeWithCheck = useCallback(
    (action: () => void) => {
      if (hasExistingBracket) {
        setPendingAction(() => action);
        setResetAlertVisible(true);
      } else {
        action();
      }
    },
    [hasExistingBracket],
  );

  const handleCreatePlayer = async () => {
    const trimmed = newPlayerName.trim();
    if (trimmed.length === 0) return;

    const exists = tournamentPlayersDb.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setDuplicateErrorVisible(true);
      return;
    }

    const newPlayer: Player = { id: Date.now().toString(), name: trimmed };
    const updatedDb = [...tournamentPlayersDb, newPlayer];
    const newSelection = [...selectedPlayerIds, newPlayer.id];

    setTournamentPlayersDb(updatedDb);
    setSelectedPlayerIds(newSelection);
    setNewPlayerName("");
    setPlayerSearchQuery("");
    setCreateModalVisible(false);

    saveToDb(updatedDb);
    if (selectedPlayersKey) {
      await AsyncStorage.setItem(
        selectedPlayersKey,
        JSON.stringify(newSelection),
      );
    }
  };

  const startEdit = useCallback((player: Player) => {
    setEditingPlayer(player);
    setEditPlayerName(player.name);
    setEditModalVisible(true);
  }, []);

  const handleUpdatePlayer = () => {
    const trimmed = editPlayerName.trim();
    if (!editingPlayer || trimmed.length === 0) return;

    const exists = tournamentPlayersDb.some(
      (p) =>
        p.id !== editingPlayer.id &&
        p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setDuplicateErrorVisible(true);
      return;
    }

    const updatedDb = tournamentPlayersDb.map((p) =>
      p.id === editingPlayer.id ? { ...p, name: trimmed } : p,
    );
    setTournamentPlayersDb(updatedDb);
    setEditModalVisible(false);
    setEditingPlayer(null);
    saveToDb(updatedDb);
  };

  const togglePlayerSelection = useCallback(
    (id: string) => {
      setSelectedPlayerIds((prev: string[]) => {
        const newSelection = prev.includes(id)
          ? prev.filter((pId) => pId !== id)
          : [...prev, id];

        if (selectedPlayersKey) {
          AsyncStorage.setItem(
            selectedPlayersKey,
            JSON.stringify(newSelection),
          ).catch((e) => console.error("Error saving selection", e));
        }
        return newSelection;
      });
    },
    [selectedPlayersKey],
  );

  const handleToggle = useCallback(
    (id: string) => {
      executeWithCheck(() => togglePlayerSelection(id));
    },
    [executeWithCheck, togglePlayerSelection],
  );

  const sortedFilteredPlayers = useMemo(() => {
    return tournamentPlayersDb
      .filter((p) =>
        p.name.toLowerCase().includes(playerSearchQuery.toLowerCase()),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, language === "pl" ? "pl" : "en"),
      );
  }, [tournamentPlayersDb, playerSearchQuery, language]);

  if (!settings) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={styles.summaryTitle}>
          {t(language, "noTournamentData") || "No tournament data."}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            isExiting.current = true;
            router.back();
          }}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 18 }}>
            {t(language, "goBack") || "Go back"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.customHeader,
          { paddingTop: insets.top > 0 ? insets.top + 10 : 16 },
        ]}
      >
        <TouchableOpacity
          onPress={() => setBackModalVisible(true)}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t(language, "selectPlayersTitle") || "Select players"}
        </Text>
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          style={styles.headerBtn}
        >
          <Ionicons name="person-add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        extraData={selectedPlayerIds}
        data={sortedFilteredPlayers.slice(0, visibleCount)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{settings.name}</Text>
              <View style={styles.summaryRow}>
                <Ionicons
                  name="trophy-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryText}>
                  {formatLabels[settings.format]}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryText}>
                  {settings.teamSize === "single"
                    ? t(language, "singleFormat") || "1 vs 1 (Single)"
                    : t(language, "pairsFormat") || "2 vs 2 (Pairs)"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryText}>
                  {settings.sets} {t(language, "set") || "Set"} /{" "}
                  {settings.legs} {t(language, "leg") || "Leg"} /{" "}
                  {settings.startingPoints || settings.points}{" "}
                  {t(language, "pts") || "Pts"}
                  {settings.customSemis
                    ? t(language, "plusSemi") || " (+ Semifinal)"
                    : ""}
                  {settings.customFinals
                    ? t(language, "plusFinal") || " (+ Final)"
                    : ""}
                </Text>
              </View>
            </View>

            <View style={styles.cardTop}>
              <Text style={styles.sectionTitle}>
                {t(language, "selected") || "Selected:"}{" "}
                {selectedPlayerIds.length}{" "}
                {t(language, "playersCount") || "players"}
              </Text>
              <View style={styles.searchContainer}>
                <Ionicons
                  name="search"
                  size={20}
                  color={theme.colors.textMuted}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder={
                    t(language, "searchPlayer") || "Search player..."
                  }
                  placeholderTextColor={theme.colors.textMuted}
                  value={playerSearchQuery}
                  onChangeText={setPlayerSearchQuery}
                />
              </View>
              {sortedFilteredPlayers.length === 0 && (
                <Text style={styles.emptyPlayersText}>
                  {t(language, "noPlayersMatch") ||
                    "No players match the criteria."}
                </Text>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.cardMiddle}>
            <PlayerRow
              player={item}
              isSelected={selectedPlayerIds.includes(item.id)}
              onToggle={handleToggle}
              onEdit={startEdit}
              theme={theme}
              styles={styles}
            />
          </View>
        )}
        ListFooterComponent={<View style={styles.cardBottom} />}
        onEndReached={() => {
          if (visibleCount < sortedFilteredPlayers.length) {
            setVisibleCount((prev: number) => prev + 25);
          }
        }}
        onEndReachedThreshold={0.5}
      />

      <View style={styles.fixedBottomContainer}>
        <TouchableOpacity
          style={[
            styles.startBtn,
            selectedPlayerIds.length < minPlayers && styles.startBtnDisabled,
            { marginTop: 0, marginBottom: 0 },
          ]}
          activeOpacity={0.8}
          disabled={selectedPlayerIds.length < minPlayers}
          onPress={async () => {
            const selectedPlayers = tournamentPlayersDb.filter((p) =>
              selectedPlayerIds.includes(p.id),
            );
            const savedArrStr = await AsyncStorage.getItem(
              "@active_tournaments",
            );
            let savedArr = savedArrStr ? JSON.parse(savedArrStr) : [];
            savedArr = savedArr.filter(
              (t: any) => t.settings.name !== settings.name,
            );
            savedArr.push({ settings: settings, players: selectedPlayers });
            await AsyncStorage.setItem(
              "@active_tournaments",
              JSON.stringify(savedArr),
            );

            router.push({
              pathname: "/tournament/bracket",
              params: {
                tournamentData: JSON.stringify(settings),
                playersData: JSON.stringify(selectedPlayers),
              },
            });
          }}
        >
          <Text style={styles.startBtnText}>
            {hasExistingBracket
              ? t(language, "returnToTournament") || "Return to tournament"
              : t(language, "startTournament") || "Start tournament"}
          </Text>
          <Ionicons name="play" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={resetAlertVisible}
        title={t(language, "resetTournament") || "Reset tournament?"}
        message={
          t(language, "resetTournamentMsg") ||
          "The tournament has already started. Changing players will reset the current bracket and delete existing results. Are you sure you want to do this?"
        }
        onRequestClose={() => {
          setResetAlertVisible(false);
          setPendingAction(null);
        }}
        buttons={[
          { text: t(language, "cancel") || "Cancel", style: "cancel" },
          {
            text: t(language, "reset") || "Reset",
            style: "destructive",
            onPress: async () => {
              await wipeTournamentProgress();
              if (pendingAction) pendingAction();
              setResetAlertVisible(false);
              setPendingAction(null);
            },
          },
        ]}
      />

      <Modal
        visible={isCreateModalVisible}
        transparent={true}
        animationType="fade"
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setCreateModalVisible(false);
            setNewPlayerName("");
          }}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>
              {t(language, "addPlayer") || "Add player"}
            </Text>
            <TextInput
              style={styles.addPlayerInput}
              placeholder={t(language, "nameOrNickname") || "Name or nickname"}
              placeholderTextColor={theme.colors.textMuted}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewPlayerName("");
                }}
              >
                <Text style={styles.modalBtnCancelText}>
                  {t(language, "cancel") || "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnAdd}
                onPress={() => executeWithCheck(handleCreatePlayer)}
              >
                <Text style={styles.modalBtnAddText}>
                  {t(language, "save") || "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="fade"
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setEditModalVisible(false);
            setEditingPlayer(null);
          }}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>
              {t(language, "editPlayer") || "Edit player"}
            </Text>
            <TextInput
              style={styles.addPlayerInput}
              placeholder={t(language, "nameOrNickname") || "Name or nickname"}
              placeholderTextColor={theme.colors.textMuted}
              value={editPlayerName}
              onChangeText={setEditPlayerName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingPlayer(null);
                }}
              >
                <Text style={styles.modalBtnCancelText}>
                  {t(language, "cancel") || "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnAdd}
                onPress={handleUpdatePlayer}
              >
                <Text style={styles.modalBtnAddText}>
                  {t(language, "save") || "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <CustomAlert
        visible={isBackModalVisible}
        title={t(language, "backToSettings") || "Back to settings?"}
        message={
          t(language, "backToSettingsMsg") ||
          "The current player selection will not be saved if you go back."
        }
        onRequestClose={() => setBackModalVisible(false)}
        buttons={[
          { text: t(language, "cancel") || "Cancel", style: "cancel" },
          {
            text: t(language, "goBack") || "Go back",
            style: "destructive",
            onPress: async () => {
              if (!hasExistingBracket && selectedPlayersKey) {
                await AsyncStorage.removeItem(selectedPlayersKey);
                await AsyncStorage.removeItem(bracketStorageKey);
              }
              setSelectedPlayerIds([]);
              setBackModalVisible(false);
              isExiting.current = true;
              if (pendingNavAction.current) {
                navigation.dispatch(pendingNavAction.current);
              } else {
                router.back();
              }
            },
          },
        ]}
      />

      <CustomAlert
        visible={duplicateErrorVisible}
        title={t(language, "error") || "Error"}
        message={
          t(language, "playerExistsMsg") ||
          "A player with this name already exists."
        }
        onRequestClose={() => setDuplicateErrorVisible(false)}
        buttons={[
          {
            text: t(language, "ok") || "OK",
            style: "default",
            onPress: () => setDuplicateErrorVisible(false),
          },
        ]}
      />
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 20 },
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
    summaryCard: {
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.1)",
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    summaryTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    summaryText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      shadowRadius: 3,
      elevation: 2,
    },
    cardTop: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.cardBorder,
      padding: 16,
      paddingBottom: 0,
    },
    cardMiddle: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderColor: theme.colors.cardBorder,
      paddingHorizontal: 16,
    },
    cardBottom: {
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: theme.colors.cardBorder,
      height: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingLeft: 8,
      color: theme.colors.textMain,
      fontSize: 16,
    },
    playerListWrapper: {
      maxHeight: 280,
    },
    playerSelectRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    nameClickArea: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingRight: 16,
      flexShrink: 1,
    },
    playerSelectName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.textLight,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 10,
    },
    checkboxActive: {
      backgroundColor: theme.colors.success || "#28a745",
      borderColor: theme.colors.success || "#28a745",
    },
    emptyPlayersText: {
      color: theme.colors.textMuted,
      marginVertical: 20,
      fontStyle: "italic",
      textAlign: "center",
    },
    fixedBottomContainer: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingTop: 12,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
    },
    startBtn: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    startBtnDisabled: {
      backgroundColor: theme.colors.primaryDisabled || "#ccc",
      elevation: 0,
      shadowOpacity: 0,
    },
    startBtnText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
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
    addPlayerInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.colors.textMain,
      fontWeight: "600",
      textAlign: "center",
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
      justifyContent: "center",
    },
    modalBtnCancelText: {
      color: theme.colors.textMuted,
      fontWeight: "700",
      fontSize: 16,
    },
    modalBtnAdd: {
      backgroundColor: theme.colors.success || "#28a745",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      justifyContent: "center",
    },
    modalBtnAddText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
