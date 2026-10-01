import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { NahomEmblem } from './NahomBrandLogo';
import { Sparkles, ShieldCheck } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface NahomAnimatedLogoSplashProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const NahomAnimatedLogoSplash: React.FC<NahomAnimatedLogoSplashProps> = ({
  onFinish,
  durationMs = 1800,
}) => {
  // Animation Drivers
  const naTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH * 0.55)).current;
  const naOpacity = useRef(new Animated.Value(0)).current;

  const homTranslateX = useRef(new Animated.Value(SCREEN_WIDTH * 0.55)).current;
  const homOpacity = useRef(new Animated.Value(0)).current;

  const emblemScale = useRef(new Animated.Value(0.3)).current;
  const emblemOpacity = useRef(new Animated.Value(0)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(14)).current;

  const sparkleScale = useRef(new Animated.Value(0)).current;
  const screenFadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Stage 1: Emblem pops in (0ms - 300ms)
    // Stage 2: "NA" from Left & "HOM" from Right slide & slam together (250ms - 750ms)
    // Stage 3: Sparkle burst & Tagline reveal (750ms - 1200ms)
    // Stage 4: Screen smoothly fades out into the dashboard (1500ms - 1800ms)

    Animated.sequence([
      // Stage 1 & 2: Emblem + NA / HOM Collision
      Animated.parallel([
        Animated.timing(emblemOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(emblemScale, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),

        // "NA" from Left
        Animated.timing(naOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(naTranslateX, {
          toValue: 0,
          friction: 6.5,
          tension: 45,
          useNativeDriver: true,
        }),

        // "HOM" from Right
        Animated.timing(homOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(homTranslateX, {
          toValue: 0,
          friction: 6.5,
          tension: 45,
          useNativeDriver: true,
        }),
      ]),

      // Stage 3: Sparkle Impact + Tagline unfurl
      Animated.parallel([
        Animated.spring(sparkleScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(taglineTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),

      // Hold briefly to admire the unified NAHOM identity
      Animated.delay(500),

      // Stage 4: Clean dissolve transition
      Animated.timing(screenFadeOut, {
        toValue: 0,
        duration: 350,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinish) {
        onFinish();
      }
    });
  }, [durationMs, onFinish]);

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: screenFadeOut,
        },
      ]}
      className="bg-[#0B1437] items-center justify-center"
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B1437" />

      {/* Ambient Radial Luxury Glow */}
      <View className="absolute w-72 h-72 rounded-full bg-[#1E232E]/30 blur-3xl" />
      <View className="absolute w-56 h-56 rounded-full bg-[#FF5E00]/20 blur-2xl -top-10 -right-10" />

      <View className="items-center justify-center gap-4 px-6 z-10">
        {/* Emblem Top Visual */}
        <Animated.View
          style={{
            opacity: emblemOpacity,
            transform: [{ scale: emblemScale }],
          }}
          className="items-center justify-center mb-1"
        >
          <NahomEmblem size={125} />
        </Animated.View>

        {/* Animated Wordmark Split: "NAH" + "O" + "M" */}
        <View className="flex-row items-center justify-center relative">
          {/* "NAH" from Left */}
          <Animated.View
            style={{
              opacity: naOpacity,
              transform: [{ translateX: naTranslateX }],
            }}
          >
            <Text className="text-[46px] font-black tracking-tight text-white font-sans">
              NAH
            </Text>
          </Animated.View>

          {/* "O" in Vibrant Orange */}
          <Animated.View
            style={{
              opacity: homOpacity,
              transform: [{ translateX: homTranslateX }],
            }}
          >
            <Text className="text-[46px] font-black tracking-tight text-[#FF5E00] font-sans">
              O
            </Text>
          </Animated.View>

          {/* "M" from Right */}
          <Animated.View
            style={{
              opacity: homOpacity,
              transform: [{ translateX: homTranslateX }],
            }}
          >
            <Text className="text-[46px] font-black tracking-tight text-white font-sans">
              M
            </Text>
          </Animated.View>

          {/* Sparkle Burst at the junction */}
          <Animated.View
            style={{
              position: 'absolute',
              top: -8,
              right: -14,
              transform: [{ scale: sparkleScale }],
            }}
          >
            <Sparkles size={20} color="#FF5E00" />
          </Animated.View>
        </View>

        {/* Taglines unfurl smoothly */}
        <Animated.View
          style={{
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          }}
          className="items-center gap-1.5"
        >
          <Text className="text-[12.5px] font-extrabold tracking-[3px] text-blue-200 uppercase font-sans text-center">
            Nexus Around Home
          </Text>

          <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full border border-white/15 mt-1">
            <ShieldCheck size={12} color="#34D399" />
            <Text className="text-[10.5px] font-bold text-slate-200 font-sans tracking-wide">
              Connected Harmony & Security
            </Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
  },
});

export default NahomAnimatedLogoSplash;
