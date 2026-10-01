import * as React from 'react';
import { Dimensions, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSelector } from 'react-redux';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MIN_VISIBLE_MS = 1100; // Let the entrance & District text display gracefully
const MAX_VISIBLE_MS = 3200; // Safety fallback timeout so the user is never stuck
const ZOOM_DURATION = 480;   // Logo 'H' zooms into the camera first
const FLASH_IN_DELAY = 220;  // Flash strikes 220ms into the zoom at peak momentum
const FLASH_IN_MS = 220;
const REVEAL_MS = 400;       // Flash & splash overlay dissolve away into dashboard

/**
 * Nahom District + Flipkart Inspired Animated Splash Screen
 * 
 * Flow:
 * 1. Dark canvas (#0D1015) with soft ambient orange glow.
 * 2. App icon springs in (0.3x -> 1.0x) with overshoot bounce.
 * 3. Authentic brand wordmark slides in:
 *    - Modern 'N' & chevron 'A'
 *    - Signature orange House 'H' symbol with 4 glowing amber window panes
 *    - Glowing orange ring 'O'
 *    - Modern 'M'
 *    - Hairline District architectural CAD/drafting lines cutting through.
 * 4. "CONNECTED COMMUNITY" subtitle unfurls below in wide tracking.
 * 5. On auth readiness:
 *    - 'H' / App icon surges forward into the camera (1.0x -> 5.5x).
 *    - Bright white flash ignites at peak scale.
 *    - Flash dissolves cleanly to unveil the live resident dashboard.
 */
export function AnimatedSplash() {
  const isInitialized = useSelector((state: any) => !!state.auth?.isInitialized);
  const [mounted, setMounted] = React.useState(true);
  const [minElapsed, setMinElapsed] = React.useState(false);
  const [maxElapsed, setMaxElapsed] = React.useState(false);
  const exiting = React.useRef(false);

  // Reanimated shared values
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const ambientScale = useSharedValue(0.5);
  const ambientOpacity = useSharedValue(0);

  const brandTranslateY = useSharedValue(18);
  const brandOpacity = useSharedValue(0);

  const subTranslateY = useSharedValue(10);
  const subOpacity = useSharedValue(0);

  const flashOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  // Entrance Sequence
  React.useEffect(() => {
    // 1. Logo Springs in with bounce
    logoScale.value = withTiming(1, {
      duration: 650,
      easing: Easing.out(Easing.back(1.4)),
    });
    logoOpacity.value = withTiming(1, { duration: 500 });

    // 2. Ambient glow blooms
    ambientScale.value = withTiming(1, { duration: 650 });
    ambientOpacity.value = withTiming(0.7, { duration: 600 });

    // 3. District-style Brand Wordmark slides in
    brandTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) })
    );
    brandOpacity.value = withDelay(400, withTiming(1, { duration: 450 }));

    // 4. "CONNECTED COMMUNITY" subtitle follows
    subTranslateY.value = withDelay(
      650,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) })
    );
    subOpacity.value = withDelay(650, withTiming(1, { duration: 450 }));

    const t1 = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const t2 = setTimeout(() => setMaxElapsed(true), MAX_VISIBLE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    logoScale,
    logoOpacity,
    ambientScale,
    ambientOpacity,
    brandTranslateY,
    brandOpacity,
    subTranslateY,
    subOpacity,
  ]);

  const unmount = React.useCallback(() => setMounted(false), []);

  // Stage 4: Flash Dissolves into Dashboard
  const startReveal = React.useCallback(() => {
    flashOpacity.value = withTiming(0, { duration: REVEAL_MS });
    overlayOpacity.value = withTiming(0, { duration: REVEAL_MS }, () => {
      runOnJS(unmount)();
    });
  }, [flashOpacity, overlayOpacity, unmount]);

  // Stage 3: H Zooms first -> Flash strikes after -> Unveil dashboard
  React.useEffect(() => {
    if (exiting.current || !((isInitialized && minElapsed) || maxElapsed)) return;
    exiting.current = true;

    // 1. Logo surges forward into camera (1.0x -> 5.5x)
    logoScale.value = withTiming(5.5, {
      duration: ZOOM_DURATION,
      easing: Easing.bezier(0.3, 0, 0.8, 1),
    });
    ambientScale.value = withTiming(5.5, { duration: ZOOM_DURATION });

    // 2. Wordmark & Subtitle sink down & fade
    brandTranslateY.value = withTiming(25, {
      duration: 250,
      easing: Easing.in(Easing.quad),
    });
    brandOpacity.value = withTiming(0, { duration: 250 });

    subTranslateY.value = withTiming(15, { duration: 220 });
    subOpacity.value = withTiming(0, { duration: 220 });

    // 3. Flash strikes 220ms into the zoom at peak momentum
    flashOpacity.value = withDelay(
      FLASH_IN_DELAY,
      withTiming(1, { duration: FLASH_IN_MS }, () => {
        runOnJS(startReveal)();
      })
    );

    // Failsafe safety timer: guarantees unmount even if native frame is interrupted
    const failsafeTimer = setTimeout(() => {
      unmount();
    }, FLASH_IN_DELAY + FLASH_IN_MS + REVEAL_MS + 300);

    return () => {
      clearTimeout(failsafeTimer);
    };
  }, [
    isInitialized,
    minElapsed,
    maxElapsed,
    logoScale,
    ambientScale,
    brandTranslateY,
    brandOpacity,
    subTranslateY,
    subOpacity,
    flashOpacity,
    startReveal,
    unmount,
  ]);

  // Animated Styles
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const ambientStyle = useAnimatedStyle(() => ({
    opacity: ambientOpacity.value,
    transform: [{ scale: ambientScale.value }],
  }));

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: subTranslateY.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={exiting.current ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, overlayStyle, styles.container]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0D1015" />

      {/* Ambient Radial Orange Glow */}
      <Animated.View style={[ambientStyle, styles.ambientGlow]} />

      {/* Center Stack: App Icon Logo + Wordmark */}
      <View style={styles.centerContent}>
        {/* App Icon Logo */}
        <Animated.View style={[logoStyle, styles.logoWrapper]}>
          <Image
            source={require('../../assets/images/nahom_app_icon.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* District-Style Brand Wordmark with Signature House 'H' */}
        <Animated.View style={[brandStyle, styles.wordmarkRow]}>
          {/* Architectural CAD / Sketch Lines (District Style) */}
          <View style={styles.sketchLineHorizontal} />
          <View style={styles.sketchLineDiagonal1} />
          <View style={styles.sketchLineDiagonal2} />

          {/* 'N' */}
          <Text style={styles.letterWhite}>N</Text>

          {/* Futuristic Chevron 'A' */}
          <View style={styles.letterA}>
            <Svg width={24} height={30} viewBox="0 0 24 30" fill="none">
              <Path
                d="M 3 28 L 12 3 L 21 28"
                stroke="#FFFFFF"
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          {/* Signature House 'H' Symbol with 4 Glowing Amber Windows */}
          <View style={styles.houseH}>
            <Svg width={34} height={38} viewBox="0 0 34 38" fill="none">
              {/* Pitched Gable Roof */}
              <Path
                d="M 2 15 L 17 3 L 32 15"
                stroke="#FF5E00"
                strokeWidth={3.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Left Vertical Pillar Leg */}
              <Path
                d="M 6 13 L 6 34"
                stroke="#FF5E00"
                strokeWidth={3.8}
                strokeLinecap="round"
              />
              {/* Right Vertical Pillar Leg */}
              <Path
                d="M 28 13 L 28 34"
                stroke="#FF5E00"
                strokeWidth={3.8}
                strokeLinecap="round"
              />
              {/* Horizontal Crossbar of 'H' */}
              <Path
                d="M 6 24 L 28 24"
                stroke="#FF5E00"
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.6}
              />
              {/* 4-Pane Amber Glowing Window */}
              <Rect x={12} y={10} width={4} height={4} rx={0.5} fill="#FFA500" />
              <Rect x={18} y={10} width={4} height={4} rx={0.5} fill="#FFA500" />
              <Rect x={12} y={16} width={4} height={4} rx={0.5} fill="#FFA500" />
              <Rect x={18} y={16} width={4} height={4} rx={0.5} fill="#FFA500" />
            </Svg>
          </View>

          {/* Glowing Orange Ring 'O' */}
          <View style={styles.ringO} />

          {/* 'M' */}
          <Text style={styles.letterWhite}>M</Text>
        </Animated.View>

        {/* Subtitle: "CONNECTED COMMUNITY" with Orange Accent */}
        <Animated.View style={[subStyle, styles.subRow]}>
          <Text style={styles.subText}>
            CONNECTED <Text style={styles.subAccent}>COMMUNITY</Text>
          </Text>
        </Animated.View>
      </View>

      {/* Fullscreen White Flash Wipe */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, flashStyle, styles.flashOverlay]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D1015',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 94, 0, 0.18)',
  },
  logoWrapper: {
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  logoImage: {
    width: 115,
    height: 115,
    borderRadius: 24,
  },
  wordmarkRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    gap: 7,
    zIndex: 5,
  },
  sketchLineHorizontal: {
    position: 'absolute',
    height: 1,
    width: SCREEN_WIDTH * 0.7,
    left: -SCREEN_WIDTH * 0.1,
    top: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    pointerEvents: 'none',
  },
  sketchLineDiagonal1: {
    position: 'absolute',
    width: 1,
    height: 75,
    left: '25%',
    top: -20,
    transform: [{ rotate: '24deg' }],
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    pointerEvents: 'none',
  },
  sketchLineDiagonal2: {
    position: 'absolute',
    width: 1,
    height: 85,
    left: '75%',
    top: -24,
    transform: [{ rotate: '-18deg' }],
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    pointerEvents: 'none',
  },
  letterWhite: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  letterA: {
    width: 26,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  houseH: {
    width: 36,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    shadowColor: '#FF5E00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  ringO: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 4.8,
    borderColor: '#FF5E00',
    marginHorizontal: 2,
    shadowColor: '#FF5E00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  subRow: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  subText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 5,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
  },
  subAccent: {
    color: '#FF5E00',
    letterSpacing: 4,
  },
  flashOverlay: {
    backgroundColor: '#FFFFFF',
    zIndex: 50,
  },
});

export default AnimatedSplash;
