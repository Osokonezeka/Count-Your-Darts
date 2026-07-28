import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

export const MODAL_BACKDROP_OPACITY = 0.5;

export interface BaseModalProps {
  visible: boolean;
  onClose?: () => void;
  dismissableOnBackdropPress?: boolean;
  backdropOpacity?: number;
  animationType?: "none" | "fade" | "slide";
  useKeyboardAvoidingView?: boolean;
  overlayStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function BaseModal({
  visible,
  onClose,
  dismissableOnBackdropPress = true,
  backdropOpacity = MODAL_BACKDROP_OPACITY,
  animationType = "fade",
  useKeyboardAvoidingView = false,
  overlayStyle,
  children,
}: BaseModalProps) {
  const overlay = (
    <Pressable
      style={[
        styles.overlay,
        { backgroundColor: `rgba(0,0,0,${backdropOpacity})` },
        overlayStyle,
      ]}
      onPress={dismissableOnBackdropPress ? onClose : undefined}
    >
      {children}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {useKeyboardAvoidingView ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          {overlay}
        </KeyboardAvoidingView>
      ) : (
        overlay
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
});
