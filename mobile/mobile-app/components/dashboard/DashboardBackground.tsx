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

export interface DashboardBackgroundProps {
  style?: ViewStyle;
  testID?: string;
}

/**
 * NAHOM Dashboard Background System
 * Clean atmospheric ambient gradient background.
 * Automatically reacts to NativeWind light/dark theme.
 */
export const DashboardBackground: React.FC<DashboardBackgroundProps> = memo(
  ({ style, testID = 'dashboard-background' }) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
      <View
        testID={testID}
        style={[StyleSheet.absoluteFillObject, styles.container, style]}
        pointerEvents="none"
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            {/* Background Base Gradients */}
            <LinearGradient id="lightBaseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFA872" stopOpacity="0.60" />
              <Stop offset="18%" stopColor="#FFBA92" stopOpacity="0.45" />
              <Stop offset="36%" stopColor="#FFDEC7" stopOpacity="0.28" />
              <Stop offset="58%" stopColor="#FFF2E7" stopOpacity="0.14" />
              <Stop offset="85%" stopColor="#FFF8EF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFF8EF" stopOpacity="1" />
            </LinearGradient>

            <LinearGradient id="darkBaseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#26262A" stopOpacity="1" />
              <Stop offset="50%" stopColor="#1B1B1F" stopOpacity="1" />
              <Stop offset="100%" stopColor="#131316" stopOpacity="1" />
            </LinearGradient>

            {/* Ambient Lighting Orbs */}
            <RadialGradient id="lightWarmAura" cx="88%" cy="5%" r="65%">
              <Stop offset="0%" stopColor="#F45A0A" stopOpacity="0.25" />
              <Stop offset="45%" stopColor="#FFA872" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#FFF8EF" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="darkWarmAura" cx="85%" cy="12%" r="55%">
              <Stop offset="0%" stopColor="#FF6A00" stopOpacity="0.08" />
              <Stop offset="55%" stopColor="#3A3A40" stopOpacity="0.04" />
              <Stop offset="100%" stopColor="#131316" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="lightCoolAura" cx="12%" cy="8%" r="60%">
              <Stop offset="0%" stopColor="#FFBA92" stopOpacity="0.32" />
              <Stop offset="50%" stopColor="#FFDEC7" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#FFF8EF" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="darkCoolAura" cx="15%" cy="65%" r="50%">
              <Stop offset="0%" stopColor="#F97316" stopOpacity="0.05" />
              <Stop offset="60%" stopColor="#3A3A40" stopOpacity="0.03" />
              <Stop offset="100%" stopColor="#131316" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* 1. Base Canvas */}
          <Rect
            x="0"
            y="0"
            width="400"
            height="900"
            fill={isDark ? 'url(#darkBaseGrad)' : 'url(#lightBaseGrad)'}
          />

          {/* 2. Ambient Atmosphere Glows */}
          <Rect
            x="0"
            y="0"
            width="400"
            height="900"
            fill={isDark ? 'url(#darkWarmAura)' : 'url(#lightWarmAura)'}
          />
          <Rect
            x="0"
            y="0"
            width="400"
            height="900"
            fill={isDark ? 'url(#darkCoolAura)' : 'url(#lightCoolAura)'}
          />
        </Svg>
      </View>
    );
  }
);

DashboardBackground.displayName = 'DashboardBackground';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    zIndex: 0,
  },
});

export default DashboardBackground;
