import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Platform,
  Pressable,
  LayoutChangeEvent,
  Keyboard,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import {
  Home,
  LayoutGrid,
  Settings,
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';
import { useBottomNavScroll } from './BottomNavScrollContext';

export type MainTabKey = 'dashboard' | 'view_all' | 'settings';

interface TabItem {
  key: MainTabKey;
  label: string;
  route: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: any }>;
}

const TAB_ITEMS: TabItem[] = [
  {
    key: 'dashboard',
    label: 'Home',
    route: '/(resident)/dashboard',
    icon: Home,
  },
  {
    key: 'view_all',
    label: 'View All',
    route: '/(resident)/all-features',
    icon: LayoutGrid,
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/(resident)/settings',
    icon: Settings,
  },
];

// Brand Theme Accent Active Color (matches global.css Ventorex theme)
const THEME_ACTIVE_LIGHT = '#C2410C';
const THEME_ACTIVE_DARK = '#FF8A3D';

export interface BottomNavigationBarProps {
  scrollY?: SharedValue<number> | any;
  isMinimized?: boolean;
}

interface AndroidTabButtonProps {
  item: TabItem;
  isActive: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  isDark: boolean;
  isCompact?: boolean;
  isPending?: boolean;
}

import { AppLoader } from '../ui/AppLoader';
import { useTranslation } from '../../src/utils/i18n';

const AndroidTabButton = React.memo(function AndroidTabButton({
  item,
  isActive,
  onPress,
  onPressIn,
  isDark,
  isPending,
}: AndroidTabButtonProps) {
  const { t, language } = useTranslation();
  const IconComponent = item.icon;
  const activeScale = useSharedValue(1);
  const activeColor = isDark ? THEME_ACTIVE_DARK : THEME_ACTIVE_LIGHT;
  const iconColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const labelColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const isArabic = language === 'ar';
  const isNarrowScreen = Dimensions.get('window').width <= 350;
  const tabFontSize = isNarrowScreen ? 12 : isArabic ? 14.5 : 13.5;
  const tabLineHeight = isNarrowScreen ? 16 : isArabic ? 19 : 17;
  const translatedLabel = t(item.key === 'dashboard' ? 'home' : item.key, item.label);

  useEffect(() => {
    activeScale.value = withTiming(isActive ? 1.06 : 1, { duration: 60 });
  }, [activeScale, isActive]);

  const activeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activeScale.value }],
  }));
  const handlePress = useCallback(() => onPress?.(item), [onPress, item]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      android_ripple={{
        color: isDark ? 'rgba(255, 106, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
        borderless: true,
        radius: 28,
      }}
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        zIndex: 1,
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={translatedLabel}
    >
      <Animated.View
        style={[activeAnimatedStyle, {
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 3,
        }]}
      >
        {isPending ? (
          <View style={{ width: 22, height: 22 }} className="items-center justify-center">
            <AppLoader variant="inline" />
          </View>
        ) : (
          <IconComponent
            size={22}
            color={iconColor}
            strokeWidth={isActive ? 2.4 : 1.8}
          />
        )}
      </Animated.View>

      <Text
        style={{
          color: labelColor,
          fontSize: tabFontSize,
          lineHeight: tabLineHeight,
          fontWeight: isActive ? '700' : '500',
          textAlign: 'center',
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {translatedLabel}
      </Text>
    </Pressable>
  );
});

interface InsetTabButtonProps {
  item: TabItem;
  isActive: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  isDark: boolean;
}

const InsetTabButton = React.memo(function InsetTabButton({
  item,
  isActive,
  onPress,
  onPressIn,
  isDark,
}) => {
  const { t, language } = useTranslation();
  const IconComponent = item.icon;
  const pressScale = useSharedValue(1.0);
  const isArabic = language === 'ar';
  const isNarrowScreen = Dimensions.get('window').width <= 350;
  const tabFontSize = isNarrowScreen ? 12 : isArabic ? 14.5 : 13.5;
  const tabLineHeight = isNarrowScreen ? 16 : isArabic ? 19 : 17;
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: isActive ? 1 : 0.82,
  }));

  useEffect(() => {
    pressScale.value = withTiming(isActive ? 1.08 : 1, { duration: 60 });
  }, [isActive, pressScale]);

  // Icons & labels: Active uses theme active color; inactive uses clear readable neutral
  const activeColor = isDark ? THEME_ACTIVE_DARK : THEME_ACTIVE_LIGHT;
  const iconColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const labelColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const translatedLabel = t(item.key === 'dashboard' ? 'home' : item.key, item.label);

  const handlePress = useCallback(() => onPress?.(item), [onPress, item]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      className="flex-1 items-center justify-center h-full select-none z-10"
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={translatedLabel}
    >
      <View className="items-center justify-center py-0.5 relative">
        {/* Icon: Visibly bigger than label text */}
        <Animated.View style={animatedIconStyle} className="items-center justify-center">
          {isPending ? (
            <View style={{ width: 21, height: 21 }} className="items-center justify-center">
              <AppLoader variant="inline" />
            </View>
          ) : (
            <IconComponent
              size={21}
              color={iconColor}
              strokeWidth={isActive ? 2.4 : 1.9}
            />
          )}
        </Animated.View>

        {/* Icon Name: Standard font size underneath */}
        <View className="items-center justify-center mt-0.5">
          <Text
            style={{
              color: labelColor,
              fontSize: tabFontSize,
              lineHeight: tabLineHeight,
            }}
            className={cn(
              'tracking-tight text-center',
              isActive ? 'font-bold' : 'font-medium'
            )}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {translatedLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  scrollY,
}) => {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const pathname = usePathname() || '';
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const { isCompact } = useBottomNavScroll();

  // Breadth (width) transition dimensions — height remains constant
  const FULL_BREADTH = 230;
  const COMPACT_BREADTH = 230;

  const containerBreadth = useSharedValue(isCompact ? COMPACT_BREADTH : FULL_BREADTH);

  useEffect(() => {
    containerBreadth.value = withTiming(isCompact ? COMPACT_BREADTH : FULL_BREADTH, {
      duration: 80,
      easing: Easing.out(Easing.cubic),
    });
  }, [isCompact, FULL_BREADTH, COMPACT_BREADTH, containerBreadth]);

  const ANDROID_FULL_BREADTH = SCREEN_WIDTH;
  const ANDROID_COMPACT_BREADTH = Math.min(SCREEN_WIDTH - 40, 360);

  const androidBreadth = useSharedValue(isCompact ? ANDROID_COMPACT_BREADTH : ANDROID_FULL_BREADTH);

  useEffect(() => {
    androidBreadth.value = withTiming(isCompact ? ANDROID_COMPACT_BREADTH : ANDROID_FULL_BREADTH, {
      duration: 80,
      easing: Easing.out(Easing.cubic),
    });
  }, [isCompact, ANDROID_FULL_BREADTH, ANDROID_COMPACT_BREADTH, androidBreadth]);

  const activeTab: MainTabKey = useMemo(() => {
    if (pathname.includes('/all-features')) return 'view_all';
    if (pathname.includes('/settings')) return 'settings';
    return 'dashboard';
  }, [pathname]);

  const [selectedTabKey, setSelectedTabKey] = useState<MainTabKey>(activeTab);

  useEffect(() => {
    setSelectedTabKey(activeTab);
  }, [activeTab]);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const navTranslateY = useSharedValue(0);

  useEffect(() => {
    // Hide completely if keyboard is visible OR if scrolling down (isCompact)
    const shouldHide = isKeyboardVisible || isCompact;
    
    navTranslateY.value = withTiming(shouldHide ? (isIOS ? 140 : 120) : 0, {
      duration: 80,
      easing: Easing.out(Easing.exp),
    });
  }, [isKeyboardVisible, isCompact, isIOS, navTranslateY]);

  const barAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: containerBreadth.value,
      
                
      transform: [{ translateY: navTranslateY.value }],
    };
  });

  const navTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navTranslateY.value }],
  }));

  const [containerWidth, setContainerWidth] = useState(0);

  const horizontalPadding = 6;
  const availableWidth = containerWidth > 0 ? containerWidth - (horizontalPadding * 2) : 0;
  const tabWidth = availableWidth > 0 ? availableWidth / TAB_ITEMS.length : 0;

  const activeIndex = useMemo(() => {
    const idx = TAB_ITEMS.findIndex((item) => item.key === selectedTabKey);
    return idx >= 0 ? idx : 0;
  }, [selectedTabKey]);

  const activeTabRatio = useSharedValue(activeIndex);
  const pillScaleX = useSharedValue(1.0);
  const dragStartRatio = useSharedValue(activeIndex);
  const isDraggingShared = useSharedValue(false);
  // Sync ratio when activeIndex changes
  useEffect(() => {
    if (!isDraggingShared.value) {
      activeTabRatio.value = withTiming(activeIndex, { duration: 70 });
      pillScaleX.value = withTiming(1, { duration: 50 });
    }
  }, [activeIndex, isDraggingShared, activeTabRatio, pillScaleX]);

  const slidingPillStyle = useAnimatedStyle(() => {
    const currentTabW = (containerBreadth.value - horizontalPadding * 2) / TAB_ITEMS.length;
    return {
      transform: [
        { translateX: activeTabRatio.value * currentTabW },
        { scaleX: pillScaleX.value },
      ],
      width: currentTabW,
    };
  });

  const androidSlidingPillStyle = useAnimatedStyle(() => {
    const androidTabWidth = (SCREEN_WIDTH - 8) / TAB_ITEMS.length;
    return {
      transform: [{ translateX: activeTabRatio.value * androidTabWidth }],
    };
  });

  const navigateToTab = useCallback((item: TabItem) => {
    router.replace(item.route as any);
  }, [router]);

  const handleTabPress = useCallback((item: TabItem) => {
    if (isDraggingShared.value) return;
    
    // If the tab is already selected visually, ensure we actually navigate to it
    // if the user is deep inside a sub-route
    if (item.key === selectedTabKey) {
      if (pathname !== item.route) {
        navigateToTab(item);
      }
      return;
    }

    const targetIdx = TAB_ITEMS.findIndex((t) => t.key === item.key);
    if (targetIdx >= 0) {
      activeTabRatio.value = withTiming(targetIdx, { duration: 60 });
    }

    setSelectedTabKey(item.key);
    navigateToTab(item);
  }, [isDraggingShared, selectedTabKey, activeTabRatio, navigateToTab]);

  const onDragEnd = useCallback((targetIndex: number) => {
    const item = TAB_ITEMS[targetIndex];
    if (item && item.key !== selectedTabKey) {
      setSelectedTabKey(item.key);
      navigateToTab(item);
    }
  }, [navigateToTab, selectedTabKey]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-5, 5])
      .failOffsetY([-12, 12])
      .onStart(() => {
        'worklet';
        isDraggingShared.value = true;
        dragStartRatio.value = activeTabRatio.value;
        pillScaleX.value = withTiming(1.04, { duration: 40 });
      })
      .onUpdate((event) => {
        'worklet';
        const activeTabW = (containerBreadth.value - horizontalPadding * 2) / TAB_ITEMS.length;
        if (activeTabW <= 0) return;
        const deltaRatio = event.translationX / activeTabW;
        const nextRatio = Math.min(Math.max(dragStartRatio.value + deltaRatio, 0), TAB_ITEMS.length - 1);
        activeTabRatio.value = nextRatio;
      })
      .onEnd(() => {
        'worklet';
        isDraggingShared.value = false;
        pillScaleX.value = withTiming(1, { duration: 50 });
        const targetIndex = Math.min(
          Math.max(Math.round(activeTabRatio.value), 0),
          TAB_ITEMS.length - 1
        );
        activeTabRatio.value = withTiming(targetIndex, { duration: 60 });
        runOnJS(onDragEnd)(targetIndex);
      });
  }, [activeTabRatio, pillScaleX, containerBreadth, dragStartRatio, isDraggingShared, onDragEnd]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== containerWidth) {
      setContainerWidth(w);
    }
  };

  // Safe area bottom inset support for all iPhone sizes and Android
  const bottomInset = Math.max(insets.bottom, isIOS ? 14 : 10) + 6;

  // Theme-aware styles:
  // Dark mode: velvety black-charcoal (#101114)
  // Light mode: solid / frosted crisp white (#FFFFFF) with high visibility and contrast
  const containerBg = isDark ? '#101114' : '#FFFFFF';
  const containerBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const containerBorderTop = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.90)';
  const containerBorderBottom = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.08)';

  // Active capsule (switching option):
  // Dark mode: contrasting dark charcoal capsule (#303238)
  // Light mode: soft brand orange tint capsule
  const activeCapsuleBg = isDark ? 'rgba(48, 50, 56, 0.92)' : 'rgba(255, 106, 0, 0.12)';
  const activeCapsuleBorder = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 106, 0, 0.22)';


  // iOS UI: Preserved untouched floating pill design
  return (
    <View
      style={{
        bottom: bottomInset,
        
        pointerEvents: isKeyboardVisible ? 'none' : 'box-none',
      }}
      className="absolute left-0 right-0 items-center justify-center z-50"
    >
      <View style={{ width: 230, alignItems: 'center' }}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            onLayout={handleLayout}
            style={[
              {
                
                height: 56,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(16, 17, 20, 0.65)' : 'rgba(255, 255, 255, 0.75)',
                borderColor: containerBorder,
                borderTopColor: containerBorderTop,
                borderBottomColor: containerBorderBottom,
                borderWidth: 1.2,
                borderRadius: 28,
                elevation: isDark ? 12 : 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.50 : 0.12,
                shadowRadius: isDark ? 22 : 16,
              },
              barAnimatedStyle,
            ]}
            className="px-1.5 flex-row items-center justify-between relative overflow-hidden"
          >
            <BlurView
              intensity={isDark ? 60 : 80}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
            />
            {containerWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    left: horizontalPadding,
                    top: 4,
                    bottom: 4,
                    borderRadius: 24,
                    backgroundColor: activeCapsuleBg,
                    borderColor: activeCapsuleBorder,
                    borderWidth: 1,
                  },
                  slidingPillStyle,
                ]}
              />
            )}
            {/* Subtle Specular Top Highlight Line (Dark mode only) */}
            {isDark && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 20,
                  right: 20,
                  height: 1.2,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderRadius: 1,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Tab Navigation Items */}
            {TAB_ITEMS.map((item) => (
              <InsetTabButton
                key={item.key}
                item={item}
                isActive={selectedTabKey === item.key}
                onPress={() => handleTabPress(item)}
                onPressIn={() => router.prefetch(item.route as any)}
                isDark={isDark}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
};

export default BottomNavigationBar;
