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
        title: t(language, "exitMatchTitle"),
        message: customMsg || t(language, "exitMatchMsg"),
        buttons: [
          {
            text: t(language, "cancel"),
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: t(language, "exitAndSave"),
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
        title: t(language, "leaveGame"),
        message: t(language, "leaveGameNoHistory"),
        buttons: [
          {
            text: t(language, "cancel"),
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: t(language, "leave"),
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
        title: t(language, "undoThrowTitle"),
        message: t(language, "undoThrowPlayerConfirm").replace(
          "{{name}}",
          playerName,
        ),
        buttons: [
          {
            text: t(language, "cancel"),
            style: "cancel",
            onPress: hideAlert,
          },
          {
            text: t(language, "continue"),
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

  const showForfeitConfirm = useCallback(
    (
      player1Name: string,
      player2Name: string,
      onForfeit: (forfeitingPlayer: "p1" | "p2") => void,
    ) => {
      setAlertConfig({
        title: t(language, "walkoverTitle"),
        message: t(language, "walkoverMsg"),
        buttons: [
          {
            text: t(language, "walkoverPlayerForfeits").replace(
              "{{name}}",
              player1Name,
            ),
            style: "destructive",
            onPress: () => {
              hideAlert();
              onForfeit("p1");
            },
          },
          {
            text: t(language, "walkoverPlayerForfeits").replace(
              "{{name}}",
              player2Name,
            ),
            style: "destructive",
            onPress: () => {
              hideAlert();
              onForfeit("p2");
            },
          },
          {
            text: t(language, "cancel"),
            style: "cancel",
            onPress: hideAlert,
          },
        ],
      });
      setAlertVisible(true);
    },
    [language, hideAlert],
  );

  const showInvalidScoreAlert = useCallback(() => {
    setAlertConfig({
      title: t(language, "invalidScoreTitle"),
      message: t(language, "invalidScoreMsg"),
      buttons: [
        {
          text: t(language, "ok"),
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
    showForfeitConfirm,
    showInvalidScoreAlert,
  };
}
