import React, { memo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { useColorScheme } from 'nativewind';

export interface AppBackgroundProps {
  style?: ViewStyle;
}

/**
 * NAHOM Luxury Warm Background System
 * Matches the warm peach-to-ivory atmosphere from the luxury mobile reference.
 */
export const AppBackground: React.FC<AppBackgroundProps> = memo(({ style }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      // Static artwork: cache it as a bitmap so it is not re-rasterised on every screen frame.
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          {/* Light Theme Luxury Peach-to-Ivory Vertical Gradient */}
          <LinearGradient id="appBgGradLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFA872" stopOpacity="0.60" />
            <Stop offset="18%" stopColor="#FFBA92" stopOpacity="0.45" />
            <Stop offset="36%" stopColor="#FFDEC7" stopOpacity="0.28" />
            <Stop offset="58%" stopColor="#FFF2E7" stopOpacity="0.14" />
            <Stop offset="85%" stopColor="#FFF8EF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFF8EF" stopOpacity="1" />
          </LinearGradient>

          {/* Top-Right Warm Orange Radiance */}
          <RadialGradient id="topRightGlow" cx="88%" cy="5%" r="65%">
            <Stop offset="0%" stopColor="#F45A0A" stopOpacity="0.25" />
            <Stop offset="45%" stopColor="#FFA872" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#FFF8EF" stopOpacity="0" />
          </RadialGradient>

          {/* Top-Left Warm Peach Radiance */}
          <RadialGradient id="topLeftGlow" cx="12%" cy="8%" r="60%">
            <Stop offset="0%" stopColor="#FFBA92" stopOpacity="0.32" />
            <Stop offset="50%" stopColor="#FFDEC7" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#FFF8EF" stopOpacity="0" />
          </RadialGradient>

          {/* Dark Theme: neutral charcoal with restrained orange radiance. */}
          <LinearGradient id="appBgGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#26262A" stopOpacity="1" />
            <Stop offset="45%" stopColor="#1B1B1F" stopOpacity="1" />
            <Stop offset="100%" stopColor="#131316" stopOpacity="1" />
          </LinearGradient>

          <RadialGradient id="darkTopGlow" cx="85%" cy="8%" r="60%">
            <Stop offset="0%" stopColor="#FF6A00" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#131316" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* 1. Base Canvas */}
        <Rect
          x="0"
          y="0"
          width="400"
          height="900"
          fill={isDark ? 'url(#appBgGradDark)' : '#FFF8EF'}
        />

        {/* 2. Vertical Warm Peach-to-Ivory Flow */}
        <Rect
          x="0"
          y="0"
          width="400"
          height="900"
          fill={isDark ? 'url(#appBgGradDark)' : 'url(#appBgGradLight)'}
        />

        {/* 3. Top Radiant Ambient Auras */}
        {!isDark && (
          <>
            <Rect x="0" y="0" width="400" height="900" fill="url(#topRightGlow)" />
            <Rect x="0" y="0" width="400" height="900" fill="url(#topLeftGlow)" />
          </>
        )}
        {isDark && (
          <Rect x="0" y="0" width="400" height="900" fill="url(#darkTopGlow)" />
        )}
      </Svg>
    </View>
  );
});

export default AppBackground;
