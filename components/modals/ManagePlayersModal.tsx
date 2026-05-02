import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AnimatedPressable } from "../common/AnimatedPressable";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export type ManagePlayerItem = {
  id: string;
  name: string;
  subtitle?: string;
  originalData?: any;
};

interface ManagePlayersModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  players: ManagePlayerItem[];
  onAddPress: () => void;
  onEditPress: (player: ManagePlayerItem) => void;
  onDeletePress: (player: ManagePlayerItem) => void;
  addLabel: string;
  emptyText: string;
  theme: any;
}

export function ManagePlayersModal({
  visible,
  onClose,
  title,
  players,
  onAddPress,
  onEditPress,
  onDeletePress,
  addLabel,
  emptyText,
  theme,
}: ManagePlayersModalProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [isRendered, setIsRendered] = useState(visible);

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
  }, [visible]);

  if (!isRendered) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const sheetTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const styles = getStyles(theme);

  return (
    <Modal
      transparent
      animationType="none"
      visible={isRendered}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.sheetBackdrop,
            { opacity: backdropOpacity },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.sheetContent,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
          </View>
          <FlatList
            data={players}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: SCREEN_HEIGHT * 0.5, marginBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: p }) => (
              <View style={styles.dbPlayerRow}>
                <AnimatedPressable
                  style={{ flex: 1 }}
                  onPress={() => onEditPress(p)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.dbPlayerName}>{p.name}</Text>
                    {p.subtitle && (
                      <Text style={styles.dbPlayerSubtitle}>
                        {" "}
                        ({p.subtitle})
                      </Text>
                    )}
                    <Ionicons
                      name="pencil"
                      size={14}
                      color={theme.colors.textLight}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => onDeletePress(p)}
                  style={styles.dbDeleteBtn}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={theme.colors.danger}
                  />
                </AnimatedPressable>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyPlayers}>
                <Ionicons
                  name="person-outline"
                  size={40}
                  color={theme.colors.textLight}
                />
                <Text style={styles.emptyPlayersText}>{emptyText}</Text>
              </View>
            }
          />
          <AnimatedPressable
            style={styles.addNewPlayerBtn}
            onPress={onAddPress}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.addNewPlayerText}>{addLabel}</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
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
    emptyPlayers: { alignItems: "center", paddingVertical: 20, gap: 8 },
    emptyPlayersText: {
      color: theme.colors.textLight,
      fontSize: 14,
      fontStyle: "italic",
      textAlign: "center",
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
    dbPlayerSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "500",
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
