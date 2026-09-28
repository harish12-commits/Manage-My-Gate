import React, { useState, useRef } from 'react';
import {
  View,
  Pressable,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LucideIcons from 'lucide-react-native';
import { ChevronLeft, AlertCircle, Compass } from 'lucide-react-native';
import { Text } from './text';
import { Icon } from './icon';
import { Skeleton } from './Skeleton';
import { KeyboardAwareScrollView } from '../layout/KeyboardAwareScrollView';
import { cn } from '../../lib/utils';
import { RoleSwitchModal } from '../navigation/RoleSwitchModal';
import { VillaSwitchModal } from '../navigation/VillaSwitchModal';
import { GlobalNavModal } from '../navigation/GlobalNavModal';
import { BottomNavigationBar } from '../navigation/BottomNavigationBar';
import { useBottomNavScroll } from '../navigation/BottomNavScrollContext';
import { useTranslation } from '../../src/utils/i18n';
import { AppBackground } from './AppBackground';

export interface ScreenShellProps {
  title: string;
  subtitle?: string;
  iconName?: string;             // Lucide icon name for header
  domainName?: string;
  sharedSlice?: string;
  permission?: string;
  showBackButton?: boolean;      // default true
  onBackPress?: () => void;
  headerRight?: React.ReactNode; // slot for action buttons (filter, add, etc.)
  children?: React.ReactNode;
  loading?: boolean;             // shows skeleton overlay
  error?: string | null;         // shows error banner with retry
  onRetry?: () => void;
  className?: string;
  enableHeaderDoubleTap?: boolean; // Mobile gesture: double-tap header to switch role/villa
  scrollable?: boolean;          // Wrap children in a ScrollView
  showBottomNav?: boolean;       // Render bottom navigation bar
  hideBottomNav?: boolean;       // Explicitly hide bottom navigation bar
  hideHeader?: boolean;          // Explicitly hide top navigation bar (for wizard flows with custom headers)
  collapsibleHeader?: boolean;   // Move top header up/down dynamically with scroll (default: true)
  showIconWithBackButton?: boolean; // Show icon badge even when back button is active (default: false)
  showGlobalNavButton?: boolean; // Force show compass navigation button even with headerRight (default: false)
}

export function ScreenShell({
  title,
  subtitle,
  iconName,
  showBackButton = true,
  onBackPress,
  headerRight,
  children,
  loading = false,
  error = null,
  onRetry,
  className,
  enableHeaderDoubleTap = true,
  scrollable = false,
  showBottomNav = true,
  hideBottomNav = false,
  hideHeader = false,
  collapsibleHeader = true,
  showIconWithBackButton = false,
  showGlobalNavButton = false,
}: ScreenShellProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const insets = useSafeAreaInsets();
  const { t, translateText, language } = useTranslation();
  const { isCompact, setIsCompact, scrollHandlerProps } = useBottomNavScroll();

  // Reset scroll compact state on route change so every screen begins fully expanded
  React.useEffect(() => {
    setIsCompact(false);
  }, [pathname, setIsCompact]);

  const isAuthScreen = pathname.includes('/(auth)') || pathname.includes('/login') || pathname.includes('/signup');
  const isSubFlowOrCreationScreen =
    pathname.includes('/create') ||
    pathname.includes('/wizard') ||
    pathname.includes('/scanner') ||
    pathname.includes('/booking/') ||
    pathname.includes('/checkout') ||
    pathname.includes('/raise-ticket') ||
    pathname.includes('/invite') ||
    pathname.includes('-pass') ||
    pathname.includes('/kid-exit');

  const shouldShowBottomNav =
    showBottomNav &&
    !hideBottomNav &&
    !isAuthScreen &&
    !isSubFlowOrCreationScreen;

  const [showGlobalNavModal, setShowGlobalNavModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showVillaModal, setShowVillaModal] = useState(false);
  const [selectedVilla, setSelectedVilla] = useState('Villa 101');

  const lastTapRef = useRef<number>(0);

  // Hardware Back Button Handler for Android / Mobile devices
  React.useEffect(() => {
    if (!showBackButton) return;

    const onHardwareBack = () => {
      if (onBackPress) {
        onBackPress();
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [showBackButton, onBackPress, router]);

  // Mobile Gesture Shortcut: Double Tap Header Title to Switch Role / Villa Unit Context
  const handleHeaderPress = () => {
    if (!enableHeaderDoubleTap) return;
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms

    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      // Double tap triggered: Open Role / Villa switcher modal
      setShowRoleModal(true);
    } else {
      lastTapRef.current = now;
    }
  };

  const DynamicIcon = React.useMemo(() => {
    if (!iconName) return undefined;
    const icons = LucideIcons as Record<string, any>;
    return (
      icons[iconName] ||
      icons[iconName.replace('BarChart3', 'ChartColumn').replace('BarChart', 'ChartBar').replace('Sliders', 'SlidersHorizontal')] ||
      icons.Layers
    );
  }, [iconName]);

  const hasChildren = React.Children.toArray(children).filter(Boolean).length > 0;
  const topInsetPadding = Math.max(insets.top, 12);

  return (
    <View className={cn('flex-1 bg-background relative', className)}>
      {/* Global Luxury Warm Peach-to-Ivory Background Layer */}
      <AppBackground />

      {/* Top Status Bar Safe Area Spacer */}
      <View
        style={{ height: topInsetPadding }}
        className="bg-transparent z-30"
      />

      {/* Header row (seamless transparent header showing warm peach gradient) */}
      {!hideHeader && (
        <View
          className="bg-transparent px-4 pt-1 pb-2.5 z-30"
        >
          <View className="flex-row items-center justify-between gap-2 min-h-[48px]">
            <View className={`flex-row items-center flex-1 min-w-0 ${(headerRight || showGlobalNavButton) ? 'me-1' : ''}`}>
              {showBackButton && (
                <Pressable
                  onPress={() => {
                    if (onBackPress) {
                      onBackPress();
                    } else if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/(resident)/dashboard' as any);
                    }
                  }}
                  className="me-2.5 p-2 rounded-xl bg-secondary/80 active:bg-secondary shrink-0 border border-border/60 shadow-2xs"
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Icon as={ChevronLeft} size={20} className="text-foreground" />
                </Pressable>
              )}

              {DynamicIcon && (!showBackButton || showIconWithBackButton) ? (
                <View className="me-2.5 size-9 rounded-xl bg-primary/10 items-center justify-center border border-primary/20 shrink-0">
                  <Icon as={DynamicIcon} size={18} className="text-primary" />
                </View>
              ) : null}

              {/* Double Tap Gesture Header Area */}
              <Pressable
                onPress={handleHeaderPress}
                className="flex-1 justify-center active:opacity-80 min-w-0 me-1"
                accessibilityHint="Double tap header title to switch active Role or Villa Unit"
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={subtitle ? 1 : 2}
                  className="text-foreground text-[20px] sm:text-[24px] font-extrabold tracking-tight leading-snug shrink mb-0.5"
                >
                  {translateText(title)}
                </Text>
                {subtitle ? (
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    numberOfLines={1}
                    className="text-[13px] sm:text-[14.5px] text-muted-foreground font-normal leading-normal shrink"
                  >
                    {translateText(subtitle)}
                  </Text>
                ) : null}
              </Pressable>
            </View>

            {/* Header Right Action Slots + Global Navigation Trigger Button */}
            {(headerRight || showGlobalNavButton) ? (
              <View className="flex-row items-center gap-1.5 shrink-0">
                {headerRight ? headerRight : null}

                {showGlobalNavButton ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowGlobalNavModal(true)}
                    className="p-2 rounded-xl bg-secondary/80 border border-border/80 items-center justify-center shadow-2xs"
                    accessibilityLabel={t('global_navigation', 'Global Easy Navigation')}
                  >
                    <Icon as={Compass} size={18} className="text-foreground" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Error banner */}
      {error ? (
        <View className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 me-2">
            <Icon as={AlertCircle} size={18} className="text-destructive me-2.5 shrink-0" />
            <Text className="text-destructive text-xs font-medium flex-1" numberOfLines={2}>
              {translateText(error)}
            </Text>
          </View>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              className="bg-destructive px-3 py-1.5 rounded-lg active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={t('retry', 'Retry')}
            >
              <Text className="text-destructive-foreground text-xs font-semibold">{t('retry', 'Retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Main content area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        className="flex-1 bg-transparent"
      >
        {loading && !hasChildren ? (
          <Skeleton variant="listItem" count={5} />
        ) : scrollable ? (
          <KeyboardAwareScrollView 
            extraScrollHeight={48}
            className="flex-1 bg-transparent"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            alwaysBounceVertical={true}
            {...scrollHandlerProps}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: shouldShowBottomNav ? Math.max(insets.bottom + 70, 84) : Math.max(insets.bottom, 24),
            }}
          >
            {children}
          </KeyboardAwareScrollView>
        ) : (
          <View className="flex-1 bg-transparent">
            {children}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Global Easy Navigation Modal (Triggered from Compass Icon Button) */}
      {showGlobalNavModal && (
        <GlobalNavModal
          visible={showGlobalNavModal}
          onClose={() => setShowGlobalNavModal(false)}
        />
      )}

      {/* Role Context Switcher Modal (Triggered by Double Tap Gesture) */}
      {showRoleModal && (
        <RoleSwitchModal
          visible={showRoleModal}
          onClose={() => setShowRoleModal(false)}
        />
      )}

      {/* Villa Unit Context Switcher Modal */}
      {showVillaModal && (
        <VillaSwitchModal
          visible={showVillaModal}
          onClose={() => setShowVillaModal(false)}
          activeVilla={selectedVilla}
          onSelectVilla={(v) => setSelectedVilla(v)}
        />
      )}

      {/* Down Bar Navigation */}
      {shouldShowBottomNav && <BottomNavigationBar />}
    </View>
  );
}
