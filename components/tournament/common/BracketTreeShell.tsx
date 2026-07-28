import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import React from "react";
import { View } from "react-native";
import { lightTheme } from "../../../lib/theme";

export type AppTheme = { colors: typeof lightTheme };

export interface BracketTreeShellProps {
  theme: AppTheme;
  contentWidth: number;
  contentHeight: number;
  children: React.ReactNode;
}

export function BracketTreeShell({
  theme,
  contentWidth,
  contentHeight,
  children,
}: BracketTreeShellProps) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ReactNativeZoomableView
        maxZoom={1.5}
        minZoom={0.2}
        zoomStep={0.5}
        initialZoom={1}
        bindToBorders={true}
        contentWidth={contentWidth}
        contentHeight={contentHeight}
        panBoundaryPadding={50}
        style={{ flex: 1 }}
      >
        {children}
      </ReactNativeZoomableView>
    </View>
  );
}
