import { StyleSheet } from "react-native";

export const getSharedTournamentStyles = (theme: {
  colors: Record<string, string>;
}) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerBtn: { padding: 6, marginLeft: -6 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMain,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 16,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 20,
      maxHeight: "90%",
      elevation: 10,
    },
    closeModalBtn: {
      padding: 4,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
    },
  });
