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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "../../components/common/AnimatedPressable";
import { AnimatedPrimaryButton } from "../../components/common/AnimatedPrimaryButton";
import { getSharedTournamentStyles } from "../../components/common/SharedTournamentStyles";
import CustomAlert from "../../components/modals/CustomAlert";
import { ManagePlayersModal } from "../../components/modals/ManagePlayersModal";
import { PlayerModal } from "../../components/modals/PlayerModal";
import { useLanguage } from "../../context/LanguageContext";
import { usePlayers } from "../../context/PlayersContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { Match } from "../../lib/statsUtils";
import { useMatchStore } from "../../store/useMatchStore";

type Player = {
  id: string;
  name: string;
  isTeam?: boolean;
  members?: string[];
};

const TOURNAMENT_PLAYERS_KEY = "@dart_tournament_players";

interface PlayerRowProps {
  player: Player;
  isSelected: boolean;
  onToggle: (id: string) => void;
  theme: { colors: Record<string, string> };
  styles: ReturnType<typeof getSpecificStyles> &
    ReturnType<typeof getSharedTournamentStyles>;
}

const PlayerRow = React.memo(
  ({ player, isSelected, onToggle, theme, styles }: PlayerRowProps) => (
    <AnimatedPressable
      style={styles.playerSelectRow}
      onPress={() => onToggle(player.id)}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingRight: 12,
        }}
      >
        <Text
          style={[
            styles.playerSelectName,
            isSelected && styles.playerSelectNameActive,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {player.name}
        </Text>
        {player.isTeam && player.members && player.members.length > 0 && (
          <Text style={styles.playerSelectSubtitle} numberOfLines={1}>
            {" "}
            ({player.members.join(" & ")})
          </Text>
        )}
      </View>

      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
        {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
    </AnimatedPressable>
  ),
);

export default function TournamentPlayersScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const router = useRouter();
  const { players, addPlayer, removePlayer, updatePlayer } = usePlayers();
  const styles = useMemo(
    () => ({
      ...getSharedTournamentStyles(theme),
      ...getSpecificStyles(theme),
    }),
    [theme],
  );
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

  const minPlayers = 2;

  const formatLabels: Record<string, string> = {
    single_knockout: t(language, "singleKnockout") || "Single Knockout",
    double_knockout: t(language, "doubleKnockout") || "Double Knockout",
    round_robin: t(language, "roundRobin") || "Round Robin",
    groups_and_knockout:
      t(language, "groupsAndKnockout") || "Groups + Knockout",
    groups_and_double_knockout:
      t(language, "groupsAndDoubleKnockout") || "Groups + Double Knockout",
  };

  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [tournamentPlayersDb, setTournamentPlayersDb] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);

  const [isManageVisible, setManageVisible] = useState(false);
  const [isPlayerModalVisible, setPlayerModalVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerNameInput, setPlayerNameInput] = useState("");

  const [isTeamModalVisible, setTeamModalVisible] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  const [isBackModalVisible, setBackModalVisible] = useState(false);
  const [duplicateErrorVisible, setDuplicateErrorVisible] = useState(false);
  const [overlapAlertVisible, setOverlapAlertVisible] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

  const [hasExistingBracket, setHasExistingBracket] = useState(false);
  const [resetAlertVisible, setResetAlertVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const isExiting = useRef(false);
  const pendingNavAction = useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);

  useEffect(() => {
    const loadDb = async () => {
      try {
        const savedPlayers = await AsyncStorage.getItem(TOURNAMENT_PLAYERS_KEY);
        if (savedPlayers) {
          setTournamentPlayersDb(JSON.parse(savedPlayers));
        }
        setIsDbLoaded(true);
      } catch (error) {
        console.error("Error loading DB", error);
      }
    };
    loadDb();
  }, []);

  useEffect(() => {
    if (!isDbLoaded) return;
    setTournamentPlayersDb((prev) => {
      let updated = [...prev];
      let changed = false;
      players.forEach((pName) => {
        if (!updated.some((p) => !p.isTeam && p.name === pName)) {
          updated.push({
            id: Date.now().toString() + Math.random().toString(),
            name: pName,
            isTeam: false,
          });
          changed = true;
        }
      });
      if (changed) {
        saveToDb(updated);
      }
      return updated;
    });
  }, [players, isDbLoaded]);

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
      const matchIdsToRemove: string[] = [];

      if (savedBracketStr) {
        const savedBracket = JSON.parse(savedBracketStr);
        if (Array.isArray(savedBracket)) {
          if (selectedPlayersKey) keysToRemove.push(selectedPlayersKey);

          savedBracket.forEach((match: Match) => {
            matchIdsToRemove.push(match.id);
          });
        }
      }
      await AsyncStorage.multiRemove(keysToRemove);
      useMatchStore.getState().clearMultipleMatches(matchIdsToRemove);
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

  const handleSavePlayer = async () => {
    const trimmed = playerNameInput.trim();
    if (trimmed.length === 0) return;

    const exists = tournamentPlayersDb.some(
      (p) =>
        (editingPlayer ? p.id !== editingPlayer.id : true) &&
        p.name.toLowerCase() === trimmed.toLowerCase() &&
        !p.isTeam,
    );
    if (exists) {
      setDuplicateErrorVisible(true);
      return;
    }

    let updatedDb;
    if (editingPlayer) {
      updatedDb = tournamentPlayersDb.map((p) =>
        p.id === editingPlayer.id ? { ...p, name: trimmed } : p,
      );
      updatePlayer(editingPlayer.name, trimmed);
    } else {
      const newPlayer: Player = { id: Date.now().toString(), name: trimmed };
      updatedDb = [...tournamentPlayersDb, newPlayer];
      const newSelection = [...selectedPlayerIds, newPlayer.id];
      setSelectedPlayerIds(newSelection);
      if (selectedPlayersKey) {
        await AsyncStorage.setItem(
          selectedPlayersKey,
          JSON.stringify(newSelection),
        );
      }
      setPlayerSearchQuery("");
      addPlayer(trimmed);
    }

    setTournamentPlayersDb(updatedDb);
    saveToDb(updatedDb);
    closePlayerModal();
  };

  const closePlayerModal = () => {
    setPlayerModalVisible(false);
    setEditingPlayer(null);
    setPlayerNameInput("");
  };

  const handleSaveTeam = async () => {
    if (teamMembers.length !== 2) return;
    const p1 = teamMembers[0];
    const p2 = teamMembers[1];

    const tName = teamNameInput.trim() || `${p1} & ${p2}`;

    const exists = tournamentPlayersDb.some(
      (p) =>
        (editingPlayer ? p.id !== editingPlayer.id : true) &&
        p.name.toLowerCase() === tName.toLowerCase() &&
        p.isTeam,
    );
    if (exists) {
      setDuplicateErrorVisible(true);
      return;
    }

    const selectedTeams = tournamentPlayersDb.filter(
      (p) => selectedPlayerIds.includes(p.id) && p.id !== editingPlayer?.id,
    );
    const hasOverlapWithSelected = selectedTeams.some((t) =>
      t.members?.some((m) => [p1, p2].includes(m)),
    );

    let updatedDb;
    if (editingPlayer) {
      updatedDb = tournamentPlayersDb.map((p) =>
        p.id === editingPlayer.id
          ? { ...p, name: tName, members: [p1, p2] }
          : p,
      );
      if (
        hasOverlapWithSelected &&
        selectedPlayerIds.includes(editingPlayer.id)
      ) {
        const newSelection = selectedPlayerIds.filter(
          (id) => id !== editingPlayer.id,
        );
        setSelectedPlayerIds(newSelection);
        if (selectedPlayersKey)
          AsyncStorage.setItem(
            selectedPlayersKey,
            JSON.stringify(newSelection),
          );
        setTimeout(() => setOverlapAlertVisible(true), 0);
      }
    } else {
      const newTeam: Player = {
        id: Date.now().toString(),
        name: tName,
        isTeam: true,
        members: [p1, p2],
      };
      updatedDb = [...tournamentPlayersDb, newTeam];
      if (!hasOverlapWithSelected) {
        const newSelection = [...selectedPlayerIds, newTeam.id];
        setSelectedPlayerIds(newSelection);
        if (selectedPlayersKey) {
          await AsyncStorage.setItem(
            selectedPlayersKey,
            JSON.stringify(newSelection),
          );
        }
      } else {
        setTimeout(() => setOverlapAlertVisible(true), 0);
      }
      setPlayerSearchQuery("");

      addPlayer(p1);
      addPlayer(p2);
    }

    setTournamentPlayersDb(updatedDb);
    saveToDb(updatedDb);
    closeTeamModal();
  };

  const closeTeamModal = () => {
    setTeamModalVisible(false);
    setEditingPlayer(null);
    setTeamNameInput("");
    setTeamMembers([]);
    setTeamSearchQuery("");
  };

  const startEdit = useCallback(
    (player: Player) => {
      if (settings?.teamSize === "team") {
        setEditingPlayer(player);
        setTeamNameInput(
          player.members &&
            player.name === `${player.members[0]} & ${player.members[1]}`
            ? ""
            : player.name,
        );
        setTeamMembers(player.members || []);
        setTeamSearchQuery("");
        setTeamModalVisible(true);
      } else {
        setEditingPlayer(player);
        setPlayerNameInput(player.name);
        setPlayerModalVisible(true);
      }
    },
    [settings?.teamSize],
  );

  const togglePlayerSelection = useCallback(
    (id: string) => {
      setSelectedPlayerIds((prev: string[]) => {
        const isSelecting = !prev.includes(id);

        if (isSelecting && settings?.teamSize === "team") {
          const teamToSelect = tournamentPlayersDb.find((p) => p.id === id);
          if (teamToSelect && teamToSelect.members) {
            const selectedTeams = tournamentPlayersDb.filter((p) =>
              prev.includes(p.id),
            );
            const hasOverlap = selectedTeams.some(
              (t) =>
                t.members &&
                t.members.some((m) => teamToSelect.members?.includes(m)),
            );
            if (hasOverlap) {
              setTimeout(() => setOverlapAlertVisible(true), 0);
              return prev;
            }
          }
        }

        const newSelection = isSelecting
          ? [...prev, id]
          : prev.filter((pId) => pId !== id);

        if (selectedPlayersKey) {
          AsyncStorage.setItem(
            selectedPlayersKey,
            JSON.stringify(newSelection),
          ).catch((e) => console.error("Error saving selection", e));
        }
        return newSelection;
      });
    },
    [selectedPlayersKey, tournamentPlayersDb, settings?.teamSize],
  );

  const handleToggle = useCallback(
    (id: string) => {
      executeWithCheck(() => togglePlayerSelection(id));
    },
    [executeWithCheck, togglePlayerSelection],
  );

  const confirmDelete = useCallback((player: Player) => {
    setPlayerToDelete(player);
  }, []);

  const handleDeletePlayer = async () => {
    if (!playerToDelete) return;
    const updatedDb = tournamentPlayersDb.filter(
      (p) => p.id !== playerToDelete.id,
    );
    setTournamentPlayersDb(updatedDb);
    saveToDb(updatedDb);

    const newSelection = selectedPlayerIds.filter(
      (id) => id !== playerToDelete.id,
    );
    setSelectedPlayerIds(newSelection);
    if (selectedPlayersKey) {
      await AsyncStorage.setItem(
        selectedPlayersKey,
        JSON.stringify(newSelection),
      );
    }

    if (!playerToDelete.isTeam) {
      removePlayer(playerToDelete.name);
    }
    setPlayerToDelete(null);
  };

  const sortedFilteredPlayers = useMemo(() => {
    const isTeamMode = settings?.teamSize === "team";
    const query = playerSearchQuery.toLowerCase();
    return tournamentPlayersDb
      .filter((p) => (isTeamMode ? p.isTeam : !p.isTeam))
      .filter((p) => {
        if (p.name.toLowerCase().includes(query)) return true;
        if (p.isTeam && p.members) {
          return p.members.some((m) => m.toLowerCase().includes(query));
        }
        return false;
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, language === "pl" ? "pl" : "en"),
      );
  }, [tournamentPlayersDb, playerSearchQuery, language, settings?.teamSize]);

  const availableSingles = useMemo(() => {
    return tournamentPlayersDb.filter((p) => !p.isTeam).map((p) => p.name);
  }, [tournamentPlayersDb]);

  const visiblePlayersData = useMemo(() => {
    return sortedFilteredPlayers.slice(0, visibleCount);
  }, [sortedFilteredPlayers, visibleCount]);

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
          styles.header,
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
          {settings?.teamSize === "team"
            ? t(language, "selectTeamsTitle") || "Select teams"
            : t(language, "selectPlayersTitle") || "Select players"}
        </Text>
        <TouchableOpacity
          onPress={() => setManageVisible(true)}
          style={styles.headerBtn}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        extraData={selectedPlayerIds}
        data={visiblePlayersData}
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
                {settings?.teamSize === "team"
                  ? t(language, "teamsCount") || "teams"
                  : t(language, "playersCount") || "players"}
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
                    settings?.teamSize === "team"
                      ? t(language, "searchTeamOrPlayer") ||
                        "Search team / player..."
                      : t(language, "searchPlayer") || "Search player..."
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
        <AnimatedPrimaryButton
          title={
            hasExistingBracket
              ? t(language, "returnToTournament") || "Return to tournament"
              : t(language, "startTournament") || "Start tournament"
          }
          iconName="play"
          theme={theme}
          fontSize={18}
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
              (t: { settings: { name: string } }) =>
                t.settings.name !== settings.name,
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
        />
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

      <ManagePlayersModal
        visible={isManageVisible}
        onClose={() => setManageVisible(false)}
        title={t(language, "managePlayers") || "Manage players"}
        players={tournamentPlayersDb
          .filter((p) => (settings?.teamSize === "team" ? p.isTeam : !p.isTeam))
          .map((p) => ({
            id: p.id,
            name: p.name,
            subtitle: p.isTeam && p.members ? p.members.join(" & ") : undefined,
            originalData: p,
          }))}
        onAddPress={() => {
          if (settings?.teamSize === "team") {
            setEditingPlayer(null);
            setTeamNameInput("");
            setTeamMembers([]);
            setTeamSearchQuery("");
            setTeamModalVisible(true);
          } else {
            setEditingPlayer(null);
            setPlayerNameInput("");
            setPlayerModalVisible(true);
          }
        }}
        onEditPress={(p) =>
          p.originalData && startEdit(p.originalData as Player)
        }
        onDeletePress={(p) =>
          p.originalData && confirmDelete(p.originalData as Player)
        }
        addLabel={
          settings?.teamSize === "team"
            ? t(language, "addTeam") || "Add team"
            : t(language, "addNewPlayer") || "Add new player"
        }
        emptyText={t(language, "noPlayers") || "No more players"}
        theme={theme}
      />

      <CustomAlert
        visible={!!playerToDelete}
        title={t(language, "delete") || "Delete"}
        message={`${t(language, "delete")} ${playerToDelete?.name}?`}
        onRequestClose={() => setPlayerToDelete(null)}
        buttons={[
          { text: t(language, "cancel") || "Cancel", style: "cancel" },
          {
            text: t(language, "delete") || "Delete",
            style: "destructive",
            onPress: handleDeletePlayer,
          },
        ]}
      />

      <PlayerModal
        visible={isPlayerModalVisible}
        title={
          editingPlayer
            ? t(language, "editPlayer") || "Edit player"
            : t(language, "addPlayer") || "Add player"
        }
        value={playerNameInput}
        onChangeText={setPlayerNameInput}
        onClose={closePlayerModal}
        onSave={() =>
          editingPlayer
            ? handleSavePlayer()
            : executeWithCheck(handleSavePlayer)
        }
        theme={theme}
        language={language}
      />

      <Modal
        visible={isTeamModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTeamModal}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalOverlayInline} onPress={closeTeamModal}>
            <View
              style={styles.modalContentInline}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitleInline}>
                {editingPlayer
                  ? t(language, "editTeam") || "Edit team"
                  : t(language, "addTeam") || "Add team"}
              </Text>
              <TextInput
                style={styles.addPlayerInputInline}
                placeholder={
                  t(language, "teamNameOptional") || "Team name (optional)"
                }
                placeholderTextColor={theme.colors.textMuted}
                value={teamNameInput}
                onChangeText={setTeamNameInput}
                maxLength={40}
              />

              <View style={styles.selectedMembersContainer}>
                {[0, 1].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.memberSlot,
                      teamMembers[index] ? styles.memberSlotFilled : null,
                    ]}
                  >
                    {teamMembers[index] ? (
                      <>
                        <Text style={styles.memberSlotText} numberOfLines={1}>
                          {teamMembers[index]}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            setTeamMembers((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color={theme.colors.danger}
                          />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.memberSlotPlaceholder}>
                        {index === 0
                          ? t(language, "player1") || "Player 1"
                          : t(language, "player2") || "Player 2"}
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {teamMembers.length < 2 && (
                <View style={{ marginTop: 16 }}>
                  <View style={styles.searchContainerInline}>
                    <Ionicons
                      name="search"
                      size={20}
                      color={theme.colors.textMuted}
                    />
                    <TextInput
                      style={styles.searchInputInline}
                      placeholder={
                        t(language, "searchOrAddPlayer") ||
                        "Search or add player..."
                      }
                      placeholderTextColor={theme.colors.textMuted}
                      value={teamSearchQuery}
                      onChangeText={setTeamSearchQuery}
                      maxLength={30}
                    />
                  </View>

                  <View style={{ maxHeight: 160 }}>
                    <FlatList
                      keyboardShouldPersistTaps="handled"
                      data={(() => {
                        const filtered = availableSingles.filter(
                          (n) =>
                            n
                              .toLowerCase()
                              .includes(teamSearchQuery.toLowerCase()) &&
                            !teamMembers.includes(n),
                        );
                        const showAdd =
                          teamSearchQuery.trim().length > 0 &&
                          !availableSingles.includes(teamSearchQuery.trim()) &&
                          !teamMembers.includes(teamSearchQuery.trim());
                        if (showAdd) {
                          return [
                            ...filtered,
                            `__ADD__${teamSearchQuery.trim()}`,
                          ];
                        }
                        return filtered;
                      })()}
                      keyExtractor={(item) => item}
                      renderItem={({ item }) => {
                        if (item.startsWith("__ADD__")) {
                          const newName = item.replace("__ADD__", "");
                          return (
                            <TouchableOpacity
                              style={styles.availablePlayerRow}
                              onPress={() => {
                                setTeamMembers((prev) => [...prev, newName]);
                                setTeamSearchQuery("");
                              }}
                            >
                              <Text style={styles.availablePlayerTextHighlight}>
                                {t(language, "addNew") || "Add new:"} "{newName}
                                "
                              </Text>
                              <Ionicons
                                name="add-circle"
                                size={22}
                                color={theme.colors.primary}
                              />
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <TouchableOpacity
                            style={styles.availablePlayerRow}
                            onPress={() => {
                              setTeamMembers((prev) => [...prev, item]);
                              setTeamSearchQuery("");
                            }}
                          >
                            <Text style={styles.availablePlayerText}>
                              {item}
                            </Text>
                            <Ionicons
                              name="add"
                              size={22}
                              color={theme.colors.textMuted}
                            />
                          </TouchableOpacity>
                        );
                      }}
                    />
                  </View>
                </View>
              )}

              <View style={styles.modalActionsInline}>
                <TouchableOpacity
                  style={styles.modalBtnCancelInline}
                  onPress={closeTeamModal}
                >
                  <Text style={styles.modalBtnCancelTextInline}>
                    {t(language, "cancel") || "Cancel"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtnAddInline,
                    teamMembers.length !== 2 && { opacity: 0.5 },
                  ]}
                  disabled={teamMembers.length !== 2}
                  onPress={() =>
                    editingPlayer
                      ? handleSaveTeam()
                      : executeWithCheck(handleSaveTeam)
                  }
                >
                  <Text style={styles.modalBtnAddTextInline}>
                    {t(language, "save") || "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
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

      <CustomAlert
        visible={overlapAlertVisible}
        title={t(language, "teamOverlapTitle") || "Player Conflict"}
        message={
          t(language, "teamOverlapMsg") ||
          "One of the players is already in another selected team."
        }
        onRequestClose={() => setOverlapAlertVisible(false)}
        buttons={[
          {
            text: t(language, "ok") || "OK",
            style: "default",
            onPress: () => setOverlapAlertVisible(false),
          },
        ]}
      />
    </View>
  );
}

const getSpecificStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
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
    playerSelectName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    playerSelectNameActive: {
      color: theme.colors.primary,
      fontWeight: "bold",
    },
    playerSelectSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "500",
      flexShrink: 1,
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
    modalOverlayInline: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContentInline: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      elevation: 10,
      width: "100%",
    },
    modalTitleInline: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.textMain,
      marginBottom: 16,
      textAlign: "center",
    },
    addPlayerInputInline: {
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
    selectedMembersContainer: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    memberSlot: {
      flex: 1,
      borderWidth: 2,
      borderColor: theme.colors.cardBorder,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      borderStyle: "dashed",
    },
    memberSlotFilled: {
      borderStyle: "solid",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
    },
    memberSlotText: {
      fontWeight: "600",
      color: theme.colors.textMain,
      fontSize: 15,
      flex: 1,
    },
    memberSlotPlaceholder: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    searchContainerInline: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: 8,
    },
    searchInputInline: {
      flex: 1,
      paddingVertical: 10,
      paddingLeft: 8,
      color: theme.colors.textMain,
      fontSize: 15,
    },
    availablePlayerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
    },
    availablePlayerText: {
      color: theme.colors.textMain,
      fontSize: 16,
      fontWeight: "500",
    },
    availablePlayerTextHighlight: {
      color: theme.colors.primary,
      fontWeight: "800",
      fontSize: 15,
    },
    modalActionsInline: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 24,
    },
    modalBtnCancelInline: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      justifyContent: "center",
    },
    modalBtnCancelTextInline: {
      color: theme.colors.textMuted,
      fontWeight: "700",
      fontSize: 16,
    },
    modalBtnAddInline: {
      backgroundColor: theme.colors.success || "#28a745",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      justifyContent: "center",
    },
    modalBtnAddTextInline: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
