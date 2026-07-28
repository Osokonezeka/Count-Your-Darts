import { useCallback, useMemo, useState } from "react";
import { AlertButton } from "../components/modals/CustomAlert";
import { t } from "../lib/i18n";

export interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss?: () => void;
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  title: "",
  message: "",
  buttons: [],
};

export interface AlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onRequestClose: () => void;
}

export function useAlert(language: Parameters<typeof t>[0]) {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(
    DEFAULT_ALERT_CONFIG,
  );

  const hideAlert = useCallback(() => {
    setAlertVisible(false);
  }, []);

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      onDismiss?: () => void,
    ) => {
      setAlertConfig({
        title,
        message,
        buttons: buttons || [
          { text: t(language, "ok"), style: "default" },
        ],
        onDismiss,
      });
      setAlertVisible(true);
    },
    [language],
  );

  const handleRequestClose = useCallback(() => {
    setAlertVisible(false);
    alertConfig.onDismiss?.();
  }, [alertConfig]);

  const alertProps: AlertProps = useMemo(
    () => ({
      visible: alertVisible,
      title: alertConfig.title,
      message: alertConfig.message,
      buttons: alertConfig.buttons,
      onRequestClose: handleRequestClose,
    }),
    [alertVisible, alertConfig, handleRequestClose],
  );

  return {
    alertVisible,
    alertConfig,
    setAlertConfig,
    showAlert,
    hideAlert,
    alertProps,
  };
}
