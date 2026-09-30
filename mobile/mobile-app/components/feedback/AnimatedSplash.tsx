import * as React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSelector } from 'react-redux';

const MIN_VISIBLE_MS = 1000; // let the intro play fully
const MAX_VISIBLE_MS = 3500; // never trap the user behind the splash
const EXIT_MS = 400;

/**
 * App-open animation. Picks up exactly where the native splash leaves off
 * (same artwork, same position), then eases the logo in, runs a progress
 * shimmer while auth bootstraps, and scales/fades out into the app.
 * Colours come from theme tokens, so it matches light/dark and every theme.
 */
export function AnimatedSplash() {
  const isInitialized = useSelector((state: any) => !!state.auth?.isInitialized);
  const [mounted, setMounted] = React.useState(true);
  const [minElapsed, setMinElapsed] = React.useState(false);
  const [maxElapsed, setMaxElapsed] = React.useState(false);
  const exiting = React.useRef(false);

  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(1);
  const shimmer = useSharedValue(0);
  const barOpacity = useSharedValue(0);
  const overlay = useSharedValue(1);

  React.useEffect(() => {
    logoScale.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.4)) });
    barOpacity.value = withDelay(350, withTiming(1, { duration: 300 }));
    shimmer.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1);
    const t1 = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const t2 = setTimeout(() => setMaxElapsed(true), MAX_VISIBLE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [logoScale, barOpacity, shimmer]);

  const unmount = React.useCallback(() => setMounted(false), []);

  React.useEffect(() => {
    if (exiting.current || !((isInitialized && minElapsed) || maxElapsed)) return;
    exiting.current = true;
    logoScale.value = withSequence(withTiming(1.12, { duration: EXIT_MS, easing: Easing.in(Easing.ease) }));
    logoOpacity.value = withTiming(0, { duration: EXIT_MS });
    overlay.value = withTiming(0, { duration: EXIT_MS }, (finished) => {
      if (finished) runOnJS(unmount)();
    });
  }, [isInitialized, minElapsed, maxElapsed, logoScale, logoOpacity, overlay, unmount]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({ opacity: barOpacity.value * logoOpacity.value }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -60 + shimmer.value * 180 }],
  }));

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={exiting.current ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, overlayStyle]}
      className="z-[9999] items-center justify-center bg-background"
    >
      <Animated.View style={logoStyle}>
        <Image
          source={require('../../assets/images/splash.png')}
          style={{ width: 220, height: 220 }}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[{ width: 120, height: 3 }, barStyle]} className="mt-2 overflow-hidden rounded-full bg-border">
        <Animated.View style={[{ width: 60, height: 3 }, fillStyle]} className="rounded-full bg-primary" />
      </Animated.View>
    </Animated.View>
  );
}

export default AnimatedSplash;
