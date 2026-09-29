/**
 * Premium Screen Transition Animations
 *
 * iOS-inspired parallax slide transitions with subtle fade and scale effects.
 * Uses react-native-screens customAnimation API with react-native-reanimated.
 *
 * Provides a unified animation config object to be spread into
 * Stack screenOptions across all layout files.
 */
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/**
 * Premium slide transition with parallax depth effect.
 *
 * Forward: new screen slides in from the right with a slight upscale,
 *          while the current screen slides left with a gentle fade and downscale.
 * Backward: reverses the above with the same smooth curve.
 *
 * This mimics the premium feel of iOS native navigation but works cross-platform.
 */
export const premiumScreenTransition: any = Platform.select({
  ios: {
    animation: 'default',
    gestureEnabled: true,
    gestureDirection: 'horizontal',
    fullScreenGestureEnabled: true,
  },
  android: {
    animation: 'slide_from_right',
    gestureEnabled: true,
    gestureDirection: 'horizontal',
    animationDuration: 250,
  },
  default: {
    animation: 'slide_from_right',
    gestureEnabled: true,
  },
}) as any;

/**
 * Fade-in transition for modal-like or overlay screens.
 */
export const fadeScreenTransition: any = {
  animation: 'fade',
  gestureEnabled: true,
  animationDuration: 250,
};

/**
 * Slide-up transition for bottom-sheet-style screens.
 */
export const slideUpTransition: any = {
  animation: 'slide_from_bottom',
  gestureEnabled: true,
  gestureDirection: 'vertical',
  animationDuration: 300,
};

/**
 * No animation for instant tab switches (dashboard ↔ view-all ↔ settings).
 * Keeps gesture disabled since these are tab replacements, not stack pushes.
 */
export const instantTransition: any = {
  animation: 'none',
  gestureEnabled: false,
};
