import React, { useState, useCallback } from "react";
import CustomAlert, { AlertButton } from "../components/modals/CustomAlert";
import { t } from "../lib/i18n";

export function useGameModals(language: Parameters<typeof t>[0]) {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    buttons: [] as AlertButton[],
  });

  const hideAlert = () => setAlertVisible(false);

  const showExitConfirm = (onSaveAndExit: () => void, customMsg?: string) => {
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
  };

  const showLeaveNoHistoryConfirm = (onLeave: () => void) => {
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
  };

  const showUndoConfirm = (playerName: string, onUndo: () => void) => {
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
  };

  const showInvalidScoreAlert = () => {
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
  };

  const GameAlerts = useCallback(
    () => (
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onRequestClose={hideAlert}
      />
    ),
    [alertVisible, alertConfig],
  );

  return {
    GameAlerts,
    showExitConfirm,
    showLeaveNoHistoryConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  };
}
