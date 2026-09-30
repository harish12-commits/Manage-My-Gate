import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Platform,
  Pressable,
  LayoutChangeEvent,
  Keyboard,
  Dimensions,
} from 'react-native';
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
  withSpring,
  withSequence,
  interpolate,
  Extrapolation,
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
  isDark: boolean;
  isCompact?: boolean;
}

import { useTranslation } from '../../src/utils/i18n';

const AndroidTabButton: React.FC<AndroidTabButtonProps> = ({
  item,
  isActive,
  onPress,
  isDark,
}) => {
  const { t, language } = useTranslation();
  const IconComponent = item.icon;
  const viewAllScale = useSharedValue(1);
  const isViewAll = item.key === 'view_all';
  const activeColor = isDark ? THEME_ACTIVE_DARK : THEME_ACTIVE_LIGHT;
  const iconColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const labelColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const isArabic = language === 'ar';
  const isNarrowScreen = Dimensions.get('window').width <= 350;
  const tabFontSize = isNarrowScreen ? 12 : isArabic ? 14.5 : 13.5;
  const tabLineHeight = isNarrowScreen ? 16 : isArabic ? 19 : 17;
  const translatedLabel = t(item.key === 'dashboard' ? 'home' : item.key, item.label);

  // Give the feature catalogue entry a clear, modern response when selected.
  useEffect(() => {
    viewAllScale.value = isViewAll && isActive
      ? withSequence(
          withTiming(1.18, { duration: 110, easing: Easing.out(Easing.quad) }),
          withSpring(1.05, { damping: 12, stiffness: 260 })
        )
      : withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  }, [isActive, isViewAll, viewAllScale]);

  const viewAllAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: viewAllScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
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
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={translatedLabel}
    >
      <Animated.View
        style={[viewAllAnimatedStyle, {
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 3,
        }]}
      >
        <IconComponent
          size={22}
          color={iconColor}
          strokeWidth={isActive ? 2.4 : 1.8}
        />
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
};

interface InsetTabButtonProps {
  item: TabItem;
  isActive: boolean;
  onPress?: () => void;
  isDark: boolean;
  isCompact: boolean;
}

const InsetTabButton: React.FC<InsetTabButtonProps> = ({
  item,
  isActive,
  onPress,
  isDark,
  isCompact,
}) => {
  const { t, language } = useTranslation();
  const IconComponent = item.icon;
  const pressScale = useSharedValue(1.0);
  const pressBlur = useSharedValue(0);
  const labelOpacity = useSharedValue(1.0);
  const isViewAll = item.key === 'view_all';
  const isArabic = language === 'ar';
  const isNarrowScreen = Dimensions.get('window').width <= 350;
  const tabFontSize = isNarrowScreen ? 12 : isArabic ? 14.5 : 13.5;
  const tabLineHeight = isNarrowScreen ? 16 : isArabic ? 19 : 17;
  const animatedLabelHeight = isNarrowScreen ? 17 : isArabic ? 20 : 18;
  const labelHeight = useSharedValue(animatedLabelHeight);

  // Height is constant; no vertical collapsing
  useEffect(() => {
    labelOpacity.value = 1.0;
    labelHeight.value = animatedLabelHeight;
  }, [animatedLabelHeight, labelHeight, labelOpacity]);

  // Zooming & motion-blur opacity effect on touch
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: interpolate(pressBlur.value, [0, 1], [isActive ? 1.0 : 0.72, 0.88]),
  }));

  // Animated blur/glow halo behind icon on touch
  const animatedHaloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressBlur.value, [0, 1], [0, isDark ? 0.70 : 0.45]),
    transform: [{ scale: interpolate(pressBlur.value, [0, 1], [0.6, 1.4]) }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    height: labelHeight.value,
    marginTop: labelOpacity.value > 0.1 ? 2 : 0,
    overflow: 'hidden',
  }));

  // Active state drives zoom and blur glow (for both tap and slide)
  useEffect(() => {
    if (isActive) {
      pressScale.value = isViewAll
        ? withSequence(
            withTiming(1.34, { duration: 110, easing: Easing.out(Easing.quad) }),
            withSpring(1.18, { damping: 13, stiffness: 320 })
          )
        : withSpring(1.22, { damping: 13, stiffness: 320 });
      pressBlur.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
    } else {
      pressScale.value = withSpring(1.0, { damping: 15, stiffness: 280 });
      pressBlur.value = withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) });
    }
  }, [isActive, isViewAll, pressScale, pressBlur]);

  // Icons & labels: Active uses theme active color; inactive uses clear readable neutral
  const activeColor = isDark ? THEME_ACTIVE_DARK : THEME_ACTIVE_LIGHT;
  const iconColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const labelColor = isActive ? activeColor : (isDark ? '#94A3B8' : '#64748B');
  const translatedLabel = t(item.key === 'dashboard' ? 'home' : item.key, item.label);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPress}
      className="flex-1 items-center justify-center h-full select-none z-10"
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={translatedLabel}
    >
      <View className="items-center justify-center py-0.5 relative">
        {/* Icon: Visibly bigger than label text */}
        <Animated.View style={animatedIconStyle} className="items-center justify-center">
          <IconComponent
            size={21}
            color={iconColor}
            strokeWidth={isActive ? 2.4 : 1.9}
          />
        </Animated.View>

        {/* Icon Name: Standard font size underneath */}
        <Animated.View style={animatedLabelStyle} className="items-center justify-center">
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
        </Animated.View>
      </View>
    </Pressable>
  );
};

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
  const FULL_BREADTH = Math.min(SCREEN_WIDTH - 32, 410);
  const COMPACT_BREADTH = Math.min(SCREEN_WIDTH - 32, 410) * 0.82;

  const containerBreadth = useSharedValue(isCompact ? COMPACT_BREADTH : FULL_BREADTH);

  useEffect(() => {
    containerBreadth.value = withTiming(isCompact ? COMPACT_BREADTH : FULL_BREADTH, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [isCompact, FULL_BREADTH, COMPACT_BREADTH, containerBreadth]);

  const ANDROID_FULL_BREADTH = SCREEN_WIDTH;
  const ANDROID_COMPACT_BREADTH = Math.min(SCREEN_WIDTH - 40, 360);

  const androidBreadth = useSharedValue(isCompact ? ANDROID_COMPACT_BREADTH : ANDROID_FULL_BREADTH);

  useEffect(() => {
    androidBreadth.value = withTiming(isCompact ? ANDROID_COMPACT_BREADTH : ANDROID_FULL_BREADTH, {
      duration: 200,
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
      duration: 200,
      easing: Easing.out(Easing.exp),
    });
  }, [isKeyboardVisible, isCompact, isIOS, navTranslateY]);

  const barAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: containerBreadth.value,
      height: 64, // Constant height — no height transition
      transform: [{ translateY: navTranslateY.value }],
    };
  });

  const androidBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: androidBreadth.value,
      height: 58, // Constant height — no height transition
      borderRadius: isCompact ? 28 : 0,
      transform: [{ translateY: navTranslateY.value }],
    };
  });

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

  const FAST_SPRING = useMemo(
    () => ({
      damping: 26,
      stiffness: 420,
      mass: 0.45,
    }),
    []
  );

  // Sync ratio when activeIndex changes
  useEffect(() => {
    if (!isDraggingShared.value) {
      activeTabRatio.value = withSpring(activeIndex, FAST_SPRING);
      pillScaleX.value = withSequence(
        withTiming(1.06, { duration: 50 }),
        withSpring(1.0, { damping: 16, stiffness: 350 })
      );
    }
  }, [activeIndex, FAST_SPRING, isDraggingShared, activeTabRatio, pillScaleX]);

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

  const navigateToTab = useCallback((item: TabItem) => {
    try {
      router.navigate(item.route as any);
    } catch {
      router.push(item.route as any);
    }
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
      activeTabRatio.value = withSpring(targetIdx, FAST_SPRING);
      pillScaleX.value = withSequence(
        withTiming(1.06, { duration: 50 }),
        withSpring(1.0, { damping: 16, stiffness: 350 })
      );
    }

    setSelectedTabKey(item.key);
    navigateToTab(item);
  }, [isDraggingShared, selectedTabKey, activeTabRatio, pillScaleX, FAST_SPRING, navigateToTab]);

  const onDragEnd = useCallback((targetIndex: number) => {
    const item = TAB_ITEMS[targetIndex];
    if (item) {
      setSelectedTabKey(item.key);
      navigateToTab(item);
    }
  }, [navigateToTab]);

  const onHoverTab = useCallback((hoveredIndex: number) => {
    const item = TAB_ITEMS[hoveredIndex];
    if (item) {
      setSelectedTabKey(item.key);
    }
  }, []);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-5, 5])
      .failOffsetY([-12, 12])
      .onStart(() => {
        'worklet';
        isDraggingShared.value = true;
        dragStartRatio.value = activeTabRatio.value;
        pillScaleX.value = withTiming(1.10, { duration: 40 });
      })
      .onUpdate((event) => {
        'worklet';
        const activeTabW = (containerBreadth.value - horizontalPadding * 2) / TAB_ITEMS.length;
        if (activeTabW <= 0) return;
        const deltaRatio = event.translationX / activeTabW;
        const nextRatio = Math.min(Math.max(dragStartRatio.value + deltaRatio, 0), TAB_ITEMS.length - 1);
        activeTabRatio.value = nextRatio;

        const currentHovered = Math.min(
          Math.max(Math.round(nextRatio), 0),
          TAB_ITEMS.length - 1
        );
        runOnJS(onHoverTab)(currentHovered);
      })
      .onEnd(() => {
        'worklet';
        isDraggingShared.value = false;
        pillScaleX.value = withSpring(1.0, { damping: 16, stiffness: 350 });
        const targetIndex = Math.min(
          Math.max(Math.round(activeTabRatio.value), 0),
          TAB_ITEMS.length - 1
        );
        activeTabRatio.value = withSpring(targetIndex, FAST_SPRING);
        runOnJS(onDragEnd)(targetIndex);
      });
  }, [activeTabRatio, pillScaleX, containerBreadth, dragStartRatio, isDraggingShared, onDragEnd, onHoverTab, FAST_SPRING]);

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

  // Native Android Navigation Bar (Material 3 dock)
  // Space below for Android phone default nav buttons (3-button navigation: Back, Home, Recent Apps or gesture bar)
  // Fits all Android devices (Vivo, Oppo, Samsung, Xiaomi, Motorola, etc.)
  if (!isIOS) {
    const androidNavButtonSpace = Math.max(insets.bottom, 8);
    const androidBarBg = isDark ? '#121316' : '#FFFFFF';
    const androidBorderTop = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            backgroundColor: androidBarBg,
            borderTopWidth: 1,
            borderTopColor: androidBorderTop,
            paddingBottom: androidNavButtonSpace,
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.35 : 0.06,
            shadowRadius: 6,
            zIndex: 50,
            pointerEvents: isKeyboardVisible ? 'none' : 'box-none',
          },
          useAnimatedStyle(() => ({ transform: [{ translateY: navTranslateY.value }] }))
        ]}
      >
        <View
          style={{
            height: 56,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: 4,
          }}
        >
          {TAB_ITEMS.map((item) => (
            <AndroidTabButton
              key={item.key}
              item={item}
              isActive={selectedTabKey === item.key}
              onPress={() => handleTabPress(item)}
              isDark={isDark}
            />
          ))}
        </View>
      </Animated.View>
    );
  }

  // iOS UI: Preserved untouched floating pill design
  return (
    <View
      style={{
        bottom: bottomInset,
        width: '100%',
        pointerEvents: isKeyboardVisible ? 'none' : 'box-none',
      }}
      className="absolute left-0 right-0 items-center justify-center px-4 z-50"
    >
      <View style={{ width: '100%', maxWidth: 410, alignItems: 'center' }}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            onLayout={handleLayout}
            style={[
              {
                height: 64,
                overflow: 'hidden',
                backgroundColor: containerBg,
                borderColor: containerBorder,
                borderTopColor: containerBorderTop,
                borderBottomColor: containerBorderBottom,
                borderWidth: 1.2,
                borderRadius: 36,
                elevation: isDark ? 12 : 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.50 : 0.12,
                shadowRadius: isDark ? 22 : 16,
              },
              barAnimatedStyle,
            ]}
            className="px-1.5 flex-row items-center justify-between relative overflow-hidden bg-white dark:bg-[#101114]"
          >
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
                isDark={isDark}
                isCompact={isCompact}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
};

export default BottomNavigationBar;
