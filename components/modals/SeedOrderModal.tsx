import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Lang, t } from "../../lib/i18n";
import { AnimatedPressable } from "../common/AnimatedPressable";
import { BaseModal, MODAL_BACKDROP_OPACITY } from "./BaseModal";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export type SeedPlayer = {
  id: string;
  name: string;
  isTeam?: boolean;
  members?: string[];
};

interface SeedOrderModalProps {
  visible: boolean;
  onClose: () => void;
  players: SeedPlayer[];
  onReorder: (newOrder: SeedPlayer[]) => void;
  theme: { colors: Record<string, string> };
  language: Lang;
}

function moveToIndex<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function SeedOrderModal({
  visible,
  onClose,
  players,
  onReorder,
  theme,
  language,
}: SeedOrderModalProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [isRendered, setIsRendered] = useState(visible);
  const [seedDrafts, setSeedDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(0.5)),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setIsRendered(false));
    }
  }, [visible, animValue]);

  useEffect(() => {
    if (!visible) return;
    const drafts: Record<string, string> = {};
    players.forEach((p, idx) => {
      drafts[p.id] = String(idx + 1);
    });
    setSeedDrafts(drafts);
  }, [players, visible]);

  if (!isRendered) return null;

  const sheetTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const styles = getStyles(theme);
  const total = players.length;

  const commitSeedNumber = (playerId: string) => {
    const raw = seedDrafts[playerId];
    const fromIndex = players.findIndex((p) => p.id === playerId);
    if (fromIndex === -1) return;

    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      setSeedDrafts((prev) => ({
        ...prev,
        [playerId]: String(fromIndex + 1),
      }));
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), total);
    const toIndex = clamped - 1;
    if (toIndex !== fromIndex) {
      onReorder(moveToIndex(players, fromIndex, toIndex));
    } else {
      setSeedDrafts((prev) => ({
        ...prev,
        [playerId]: String(fromIndex + 1),
      }));
    }
  };

  const handleShuffle = () => {
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    onReorder(shuffled);
  };

  return (
    <BaseModal
      visible={isRendered}
      onClose={onClose}
      dismissableOnBackdropPress={false}
      backdropOpacity={MODAL_BACKDROP_OPACITY}
      animationType="none"
      overlayStyle={styles.sheetOverlay}
    >
      <Pressable style={styles.sheetDismissArea} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheetContent,
          { transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>
              {t(language, "seedOrderTitle")}
            </Text>
            <AnimatedPressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </AnimatedPressable>
          </View>
          <Text style={styles.sheetSubtitle}>
            {t(language, "seedOrderSubtitle")}
          </Text>
        </View>

        <GestureHandlerRootView style={styles.listWrapper}>
          <DraggableFlatList
            data={players}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: SCREEN_HEIGHT * 0.45 }}
            keyboardShouldPersistTaps="handled"
            activationDistance={10}
            onDragEnd={({ data }) => onReorder(data)}
            renderItem={({
              item,
              drag,
              isActive,
              getIndex,
            }: RenderItemParams<SeedPlayer>) => {
              const index = getIndex() ?? 0;
              return (
                <View
                  style={[
                    styles.seedRow,
                    isActive && styles.seedRowActive,
                  ]}
                >
                  <Pressable
                    onLongPress={drag}
                    delayLongPress={150}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                    style={styles.dragHandle}
                  >
                    <Ionicons
                      name="reorder-two"
                      size={22}
                      color={theme.colors.textLight}
                    />
                  </Pressable>

                  <View style={styles.seedNumberWrapper}>
                    <Text style={styles.seedHash}>#</Text>
                    <TextInput
                      style={styles.seedNumberInput}
                      value={seedDrafts[item.id] ?? String(index + 1)}
                      onChangeText={(text) =>
                        setSeedDrafts((prev) => ({
                          ...prev,
                          [item.id]: text.replace(/[^0-9]/g, ""),
                        }))
                      }
                      onEndEditing={() => commitSeedNumber(item.id)}
                      onSubmitEditing={() => commitSeedNumber(item.id)}
                      keyboardType="number-pad"
                      maxLength={3}
                      selectTextOnFocus
                      returnKeyType="done"
                    />
                  </View>

                  <Text style={styles.seedPlayerName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              );
            }}
          />
        </GestureHandlerRootView>

        <AnimatedPressable
          style={styles.shuffleBtn}
          onPress={handleShuffle}
          disabled={total < 2}
        >
          <Ionicons name="shuffle" size={20} color={theme.colors.primary} />
          <Text style={styles.shuffleBtnText}>
            {t(language, "seedOrderRandomize")}
          </Text>
        </AnimatedPressable>
      </Animated.View>
    </BaseModal>
  );
}

const getStyles = (theme: { colors: Record<string, string> }) =>
  StyleSheet.create({
    sheetOverlay: {
      justifyContent: "flex-end",
      padding: 0,
    },
    sheetDismissArea: {
      flex: 1,
    },
    sheetContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      maxHeight: "85%",
    },
    sheetHeader: { alignItems: "center", marginBottom: 12 },
    sheetHandle: {
      width: 40,
      height: 5,
      backgroundColor: theme.colors.cardBorder,
      borderRadius: 3,
      marginBottom: 12,
    },
    sheetHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    closeBtn: {
      position: "absolute",
      right: 0,
      padding: 4,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
    },
    sheetSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginTop: 8,
      paddingHorizontal: 8,
    },
    listWrapper: { marginTop: 8 },
    seedRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
      gap: 10,
    },
    seedRowActive: {
      backgroundColor: theme.colors.background,
      borderRadius: 10,
    },
    dragHandle: { padding: 4 },
    seedNumberWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      paddingHorizontal: 6,
    },
    seedHash: {
      color: theme.colors.textMuted,
      fontWeight: "700",
      fontSize: 14,
    },
    seedNumberInput: {
      minWidth: 26,
      paddingVertical: 6,
      paddingHorizontal: 2,
      color: theme.colors.primary,
      fontWeight: "800",
      fontSize: 15,
      textAlign: "center",
    },
    seedPlayerName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    shuffleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      marginTop: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    shuffleBtnText: {
      color: theme.colors.primary,
      fontWeight: "700",
      fontSize: 15,
    },
  });
