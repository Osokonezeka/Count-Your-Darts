import React from "react";
import { t } from "../../../lib/i18n";
import CustomAlert, { AlertButton } from "../../modals/CustomAlert";
import { SharedMatch as Match } from "../MatchCard";

export interface WalkoverAlertProps {
  visible: boolean;
  match?: Match | null;
  language: Parameters<typeof t>[0];
  onCancel: () => void;
  onSelectForfeiter: (playerId: string) => void;
}

export function WalkoverAlert({
  visible,
  match,
  language,
  onCancel,
  onSelectForfeiter,
}: WalkoverAlertProps) {
  const buttons: AlertButton[] = [];

  if (match?.player1) {
    const player1 = match.player1;
    buttons.push({
      text: t(language, "walkoverPlayerForfeits").replace(
        "{{name}}",
        player1.name,
      ),
      style: "destructive",
      onPress: () => onSelectForfeiter(player1.id),
    });
  }
  if (match?.player2) {
    const player2 = match.player2;
    buttons.push({
      text: t(language, "walkoverPlayerForfeits").replace(
        "{{name}}",
        player2.name,
      ),
      style: "destructive",
      onPress: () => onSelectForfeiter(player2.id),
    });
  }
  buttons.push({
    text: t(language, "cancel"),
    style: "cancel",
    onPress: onCancel,
  });

  return (
    <CustomAlert
      visible={visible}
      title={t(language, "walkoverTitle")}
      message={t(language, "walkoverMsg")}
      onRequestClose={onCancel}
      buttons={buttons}
    />
  );
}
