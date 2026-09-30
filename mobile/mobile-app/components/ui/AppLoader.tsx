import * as React from 'react';
import { View, AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';
import { Text } from './text';

export interface AppLoaderProps {
  /** fullscreen: covers the screen (boot / route chunks); block: centred in a card or list; inline: small, for buttons and rows */
  variant?: 'fullscreen' | 'block' | 'inline';
  label?: string;
  className?: string;
}

const SIZES = { fullscreen: 48, block: 40, inline: 20 } as const;

/**
 * Theme-aware loader. Every colour comes from the NativeWind theme tokens
 * (primary / border / background), so it follows the active theme and light/dark
 * mode automatically. Animation runs on the UI thread (transform/opacity only)
 * and fades in after a short delay so quick loads never flash a spinner.
 */
export const AppLoader = React.memo(function AppLoader({
  variant = 'block',
  label,
  className,
}: AppLoaderProps) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0.7);
  const visible = useSharedValue(0);

  React.useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled || reduce) return;
        rotation.value = withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1);
        pulse.value = withRepeat(
          withSequence(withTiming(1, { duration: 600 }), withTiming(0.7, { duration: 600 })),
          -1,
        );
      })
      .catch(() => {});
    visible.value = withDelay(150, withTiming(1, { duration: 200 }));
    return () => {
      cancelled = true;
      cancelAnimation(rotation);
      cancelAnimation(pulse);
    };
  }, [rotation, pulse, visible]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: visible.value }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const size = SIZES[variant];
  const border = variant === 'inline' ? 2 : 3;

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={label || 'Loading'}
      style={containerStyle}
      className={cn(
        'items-center justify-center',
        variant === 'fullscreen' && 'absolute inset-0 z-50 bg-background',
        variant === 'block' && 'w-full py-6',
        variant === 'inline' && 'self-center',
        className,
      )}
    >
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Animated.View
          style={[{ width: size, height: size, borderWidth: border, borderRadius: size / 2 }, ringStyle]}
          className="absolute border-border border-t-primary"
        />
        <Animated.View
          style={[{ width: size * 0.4, height: size * 0.4, borderRadius: size }, coreStyle]}
          className="bg-primary"
        />
      </View>
      {label && variant !== 'inline' ? (
        <Text className="mt-3 text-sm text-muted-foreground">{label}</Text>
      ) : null}
    </Animated.View>
  );
});

export default AppLoader;
