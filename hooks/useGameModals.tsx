import React, { useCallback, useState } from "react";
import CustomAlert, { AlertButton } from "../components/modals/CustomAlert";
import { t } from "../lib/i18n";

export function useGameModals(language: Parameters<typeof t>[0]) {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

  const hideAlert = useCallback(() => setAlertVisible(false), []);

  const showExitConfirm = useCallback(
    (onSaveAndExit: () => void, customMsg?: string) => {
      setAlertConfig({
        title: t(language, "exitMatchTitle") || "Exit match?",
        message:
          customMsg ||
          t(language, "exitMatchMsg") ||
          "Do you want to exit? The score will be saved and you can continue later.",
        buttons: [
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: t(language, "exitAndSave") || "Exit and save",
            style: "default",
            onPress: () => {
              hideAlert();
              onSaveAndExit();
            },
          },
        ],
      });
      setAlertVisible(true);
    },
    [language, hideAlert],
  );

  const showLeaveNoHistoryConfirm = useCallback(
    (onLeave: () => void) => {
      setAlertConfig({
        title: t(language, "leaveGame") || "Leave game?",
        message: t(language, "leaveGameNoHistory") || "Progress will be lost.",
        buttons: [
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: t(language, "leave") || "Leave",
            style: "destructive",
            onPress: () => {
              hideAlert();
              onLeave();
            },
          },
        ],
      });
      setAlertVisible(true);
    },
    [language, hideAlert],
  );

  const showUndoConfirm = useCallback(
    (playerName: string, onUndo: () => void) => {
      setAlertConfig({
        title: t(language, "undoThrowTitle") || "Undo throw?",
        message: (
          t(language, "undoThrowPlayerConfirm") ||
          "Do you want to undo the throw for {{name}}?"
        ).replace("{{name}}", playerName),
        buttons: [
          {
            text: t(language, "cancel") || "Cancel",
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: t(language, "continue") || "Continue",
            style: "destructive",
            onPress: () => {
              hideAlert();
              onUndo();
            },
          },
        ],
      });
      setAlertVisible(true);
    },
    [language, hideAlert],
  );

  const showInvalidScoreAlert = useCallback(() => {
    setAlertConfig({
      title: t(language, "invalidScoreTitle") || "Error",
      message: t(language, "invalidScoreMsg") || "Invalid score for 3 darts.",
      buttons: [
        {
          text: t(language, "ok") || "OK",
          style: "default",
          onPress: hideAlert,
        },
      ],
    });
    setAlertVisible(true);
  }, [language, hideAlert]);

  const GameAlerts = (
    <CustomAlert
      visible={alertVisible}
      title={alertConfig.title}
      message={alertConfig.message}
      buttons={alertConfig.buttons}
      onRequestClose={hideAlert}
    />
  );

  return {
    GameAlerts,
    showExitConfirm,
    showLeaveNoHistoryConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  };
}
