import * as React from 'react';
import { View, ScrollView, BackHandler, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import MobileHeader from '@/components/navigation/MobileHeader';
import RoleBasedGreeting from '@/components/dashboard/RoleBasedGreeting';
import HeroBanner from '@/components/dashboard/HeroBanner';
import QuickActionsGrid from '@/components/dashboard/QuickActionsGrid';
import CustomiseSheetModal from '@/components/dashboard/CustomiseSheetModal';
import DashboardBackground from '@/components/dashboard/DashboardBackground';
import BottomNavigationBar from '@/components/navigation/BottomNavigationBar';
import { useBottomNavScroll } from '@/components/navigation/BottomNavScrollContext';
import { ALL_AVAILABLE_FEATURES } from '@/src/features/dashboard/dashboardCatalog';
import { useQuickActions } from '@/src/features/dashboard/useQuickActions';
import { useDoubleBackToExit } from '@/src/hooks/useDoubleBackToExit';
import { useTranslation } from '@/src/utils/i18n';

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const [customiseOpen, setCustomiseOpen] = React.useState(false);
  const { scrollHandlerProps } = useBottomNavScroll();
  const insets = useSafeAreaInsets();

  const {
    activeQuickActions,
    equippedFeatures,
    allFeaturesList,
    saveQuickActions,
  } = useQuickActions();

  // Android: Double Back Press to Exit Application (Home / Root Screen)
  useDoubleBackToExit({
    onBeforeExitCheck: () => {
      if (customiseOpen) {
        setCustomiseOpen(false);
        return true;
      }
      return false;
    },
  });

  // Non-Android platforms (iOS / Web): Existing hardware back fallback
  React.useEffect(() => {
    if (Platform.OS === 'android') return;

    const onHardwareBack = () => {
      if (customiseOpen) {
        setCustomiseOpen(false);
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
  }, [customiseOpen, router]);

  const handleSaveCustomisation = async (selectedIds: string[]) => {
    await saveQuickActions(selectedIds);
  };

  const handleTilePress = (tileId: string) => {
    if (tileId === 'visitor_resident_passes') {
      router.navigate('/(resident)/visitor' as any);
      return;
    }
    if (tileId === 'visitor_gate_console') {
      router.navigate('/(resident)/visitor/gate-console' as any);
      return;
    }
    if (tileId === 'billing_dashboard') {
      router.navigate('/(resident)/billing' as any);
      return;
    }
    if (tileId === 'billing_action_center') {
      router.navigate('/(resident)/admin/billing/ledger' as any);
      return;
    }
    if (tileId === 'billing_assessment_manager') {
      router.navigate('/(resident)/admin/billing/assessments' as any);
      return;
    }
    if (tileId === 'billing_my_invoices') {
      router.navigate('/(resident)/billing/my-dues' as any);
      return;
    }
    let feature = allFeaturesList.find((item) => item.id === tileId);
    if (!feature) {
      feature = (ALL_AVAILABLE_FEATURES as any[]).find((item) => item.id === tileId);
    }
    
    if (feature && feature.route) {
      const targetRoute = feature.route.endsWith('/resident-passes') ? '/(resident)/visitor' : feature.route;
      router.push(targetRoute as any);
    }
  };

  const handleBannerPress = (banner: any) => {
    switch (banner.id) {
      case '1':
        router.push('/(resident)/all-features' as any);
        break;
      case '2':
        router.push('/(resident)/visitor' as any);
        break;
      case '3':
        router.push('/(resident)/amenities/discover' as any);
        break;
      case '4':
        router.push('/(resident)/billing' as any);
        break;
      default:
        break;
    }
  };

  return (
    <View className="flex-1 bg-background relative">
      <Stack.Screen options={{ headerShown: false }} />

      {/* NAHOM Connected Community / Architectural Abstract background system */}
      <DashboardBackground />

      {/* Top Navigation Header */}
      <MobileHeader transparent />

      {/* Main Dashboard Scrollable Content with Animated Scroll Minimization */}
      <ScrollView 
        onScroll={scrollHandlerProps.onScroll}
        scrollEventThrottle={32}
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 110 }}
      >
        <View className="gap-3.5 max-w-md mx-auto w-full">
          {/* Dynamic Role-Based Greeting */}
          <RoleBasedGreeting />

          {/* Sliding Notice Board Banner Carousel */}
          <HeroBanner onBannerPress={handleBannerPress} />

          {/* 2-Column Quick Actions Grid (Exactly 6 Cards) */}
          <QuickActionsGrid
            activeFeatureIds={activeQuickActions}
            equippedFeatures={equippedFeatures}
            onOpenCustomise={() => setCustomiseOpen(true)}
            onTilePress={handleTilePress}
          />
        </View>
      </ScrollView>

      {/* Down Bar Navigation with Animated Minimization & Touch Zoom Effects */}
      <BottomNavigationBar />

      {/* Customise Dashboard Slide-Up Sheet Modal */}
      <CustomiseSheetModal
        visible={customiseOpen}
        onClose={() => setCustomiseOpen(false)}
        activeFeatureIds={activeQuickActions}
        availableFeatures={allFeaturesList}
        onSave={handleSaveCustomisation}
      />
    </View>
  );
}
