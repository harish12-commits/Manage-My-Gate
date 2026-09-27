import '../src/utils/cryptoPolyfill';
import '@/global.css';
import React, { useEffect, useMemo, useRef } from 'react';

// Suppress synchronous console logs in production release builds to prevent Hermes JNI logcat bottlenecks
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import { PortalHost } from '@rn-primitives/portal';
import { Stack, useSegments, useRouter, useGlobalSearchParams, useRootNavigationState, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from '../src/store/store';
import { View, ActivityIndicator, I18nManager, TouchableOpacity, Linking, Platform } from 'react-native';
import { AlertTriangle, Mail } from 'lucide-react-native';
import { Text } from '@/components/ui/text';

// Enforce standard Left-to-Right layout across all languages (including Arabic)
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch (e) {}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../src/features/auth/hooks/useAuth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import storage from '../src/utils/storage';
import i18n, { I18nProvider } from '../src/utils/i18n';
import * as SplashScreen from 'expo-splash-screen';
import useAutoUpdate from '../src/hooks/useAutoUpdate';
import usePushNotifications from '../src/features/notification/hooks/usePushNotifications';
import { clearPendingRoute } from '../src/features/notification/store/notificationSlice';
import { useGlobalAppSocket } from '../src/hooks/useGlobalAppSocket';
import { getDeferredHandoffContext } from '../src/features/auth/services/deferredDeepLinkService';
import { GlobalNotificationPresenter } from '@/components/feedback/GlobalNotificationPresenter';

// Prevent splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const handleContactDev = () => {
    const subject = encodeURIComponent('Nahom App Crash Report');
    const body = encodeURIComponent(
      `Hi Nahom Developer Team,\n\nI encountered a crash in the app:\n\nError: ${error?.message || 'Unknown'}\n\nStack Trace:\n${error?.stack || 'None'}\n\nPlatform: ${Platform.OS}\nDate: ${new Date().toISOString()}`
    );
    Linking.openURL(`mailto:developer@managemygate.com?subject=${subject}&body=${body}`);
  };

  return (
    <View className="flex-1 items-center justify-center p-6 bg-background">
      <View className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-destructive" />
      </View>
      <Text className="text-lg font-bold text-foreground text-center mb-1">
        Something Went Wrong
      </Text>
      <Text className="text-xs text-muted-foreground text-center mb-6 leading-relaxed max-w-xs">
        {error?.message || 'An unexpected error occurred in the application.'}
      </Text>
      <View className="flex-row items-center gap-3 w-full max-w-xs">
        <TouchableOpacity
          onPress={retry}
          className="flex-1 py-2.5 rounded-xl bg-primary items-center justify-center active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Try Again"
        >
          <Text className="text-xs font-bold text-primary-foreground">Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleContactDev}
          className="flex-1 py-2.5 rounded-xl bg-secondary border border-border items-center justify-center flex-row gap-1.5 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Email App Developer"
        >
          <Mail size={14} className="text-foreground" />
          <Text className="text-xs font-bold text-foreground">Contact Dev</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// AuthRouteGuard runs inside Provider/ThemeProvider context
function AuthRouteGuard() {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized, user, bootstrap } = useAuth();
  const { setColorScheme } = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams<{ intent?: string; token?: string; code?: string; [key: string]: any }>();
  const rootNavigationState = useRootNavigationState();
  const pendingRoute = useSelector((state: any) => state.notification?.pendingRoute);
  const lastNavigationRef = useRef<{ target: string; at: number } | null>(null);

  // Initialize global real-time Socket.io engine
  useGlobalAppSocket();

  // Check and apply EAS Over-The-Air (OTA) updates automatically
  useAutoUpdate();

  // Initialize and listen to device push notifications
  usePushNotifications();

  const isCreateOrgIntent = searchParams.intent === 'create-org' || searchParams.intent === 'create';
  const stableSearchParams = useMemo(() => ({ ...searchParams }), [JSON.stringify(searchParams || {})]);
  const stableSegmentsKey = JSON.stringify(segments || []);

  const replaceOnce = (target: any) => {
    const targetKey = typeof target === 'string'
      ? target
      : `${target?.pathname || ''}?${JSON.stringify(target?.params || {})}`;
    const targetPath = typeof target === 'string' ? target.split('?')[0] : target?.pathname;
    const now = Date.now();
    const last = lastNavigationRef.current;

    if (!targetPath || targetPath === pathname) return;
    if (last?.target === targetKey && now - last.at < 1500) return;

    lastNavigationRef.current = { target: targetKey, at: now };
    router.replace(target as any);
  };

  // Restore saved theme, language, and session restoration on startup (Mount once)
  useEffect(() => {
    bootstrap();
    const restorePreferences = async () => {
      try {
        const savedTheme = await storage.getItem('theme_preference');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setColorScheme(savedTheme);
        } else {
          setColorScheme('light');
          await storage.setItem('theme_preference', 'light');
        }
      } catch (e) {
        console.warn('Failed to restore theme on startup:', e);
      }
      try {
        await i18n.initLanguage();
      } catch (e) {
        console.warn('Failed to restore language preference on startup:', e);
      }
    };
    restorePreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle dynamic routing redirects depending on session state once navigation state is ready
  useEffect(() => {
    if (!rootNavigationState?.key || !isInitialized) return;

    const segs = (segments || []) as string[];
    const firstSegment = segs[0] as string | undefined;
    const currentRoute = segs[1] as string | undefined;
    const inAuthGroup = firstSegment === '(auth)';
    const isRoot = !firstSegment || firstSegment === 'index';
    const u = user as any;

    const isExplicitNonInviteAuthRoute = inAuthGroup && currentRoute && currentRoute !== 'accept-invite';

    const hasTokenParam = !!(searchParams?.token || searchParams?.code);
    const isWebInviteUrl =
      typeof window !== 'undefined' &&
      typeof window.location !== 'undefined' &&
      window.location?.pathname &&
      (window.location.pathname.startsWith('/invite/') ||
       window.location.pathname === '/accept-invite' ||
       window.location.pathname.startsWith('/(auth)/accept-invite'));

    const isInviteRoute =
      !isExplicitNonInviteAuthRoute &&
      (firstSegment === 'invite' ||
        firstSegment === 'accept-invite' ||
        (inAuthGroup && currentRoute === 'accept-invite') ||
        (isRoot && (hasTokenParam || isWebInviteUrl)));

    if (isInviteRoute) {
      if (firstSegment === 'invite') {
        return;
      }
      if (firstSegment !== '(auth)' || currentRoute !== 'accept-invite') {
        let tokenToPass = stableSearchParams?.token || stableSearchParams?.code;
        if (!tokenToPass && typeof window !== 'undefined' && window.location?.href) {
          const match = window.location.href.match(/[\/?&](?:token|code)=([^&#]+)|\/invite\/(?:app\/|web\/)?([a-f0-9]{32,64}|[^/?&#]+)/i);
          if (match) {
            tokenToPass = match[1] || match[2];
          }
        }
        replaceOnce({
          pathname: '/(auth)/accept-invite',
          params: { ...stableSearchParams, ...(tokenToPass ? { token: tokenToPass } : {}) },
        });
      }
      return;
    }

    const hasOrg = !!(
      u && (
        u.orgId ||
        u.activeOrgId ||
        u.organizationId ||
        (Array.isArray(u.availableWorkspaces) && u.availableWorkspaces.length > 0)
      )
    );
    const isOnboardingRoute = currentRoute === 'setup-organization' || currentRoute === 'select-features';

    // On root route (/ or index), app/index.tsx handles initial redirect cleanly. Avoid racing.
    if (isRoot) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Check for deferred handoff or invitation token from Google Play Install Referrer on first launch
      getDeferredHandoffContext()
        .then((context) => {
          if (context) {
            if (context.type === 'handoff') {
              replaceOnce(`/invite/handoff/${context.value}` as any);
            } else {
              replaceOnce({
                pathname: '/(auth)/accept-invite',
                params: { token: context.value },
              });
            }
          } else {
            replaceOnce('/(auth)/login');
          }
        })
        .catch(() => {
          replaceOnce('/(auth)/login');
        });
    } else if (isAuthenticated) {
      if (!hasOrg) {
        if (!isOnboardingRoute) {
          replaceOnce('/(auth)/setup-organization');
        }
      } else if (pendingRoute) {
        console.log('[AuthRouteGuard] Navigating to pending notification destination:', pendingRoute);
        dispatch(clearPendingRoute());
        replaceOnce(pendingRoute as any);
      }
    }
  }, [isAuthenticated, isInitialized, rootNavigationState?.key, stableSegmentsKey, pathname, user, isCreateOrgIntent, pendingRoute, dispatch, stableSearchParams]);

  return null;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#131316' : '#FFF8EF' }}>
        <ActivityIndicator size="large" color="#F45A0A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className={colorScheme === 'dark' ? 'dark flex-1 bg-background' : 'flex-1 bg-background'}>
          <Provider store={store}>
            <I18nProvider>
              <BottomSheetModalProvider>
                <StatusBar
                  style={colorScheme === 'dark' ? 'light' : 'dark'}
                  backgroundColor={colorScheme === 'dark' ? '#131316' : '#FFF8EF'}
                />
                <Stack screenOptions={{ headerShown: false }} />
                <AuthRouteGuard />
                <GlobalNotificationPresenter />
                <PortalHost />
              </BottomSheetModalProvider>
            </I18nProvider>
          </Provider>
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
