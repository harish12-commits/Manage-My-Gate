import React, { useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, TextInput, BackHandler } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ScreenShell } from '@/components/ui/ScreenShell';
import {
  X,
  Search,
  ChevronRight,
  RotateCcw,
  Layers,
} from 'lucide-react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import ActionTile from '@/components/dashboard/ActionTile';
import FeatureIcon from '@/components/ui/FeatureIcon';
import { useQuickActions } from '@/src/features/dashboard/useQuickActions';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ALL_AVAILABLE_FEATURES } from '@/src/features/dashboard/dashboardCatalog';
import { isFeatureAllowedForUser, checkIsAdmin } from '@/src/utils/rbac';
import { useTranslation } from '@/src/utils/i18n';
import { useBottomNavScroll } from '@/components/navigation/BottomNavScrollContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

export default function AllFeaturesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { t, tCategoryName, tFeatureName, tFeatureSubtitle, translateText, language } = useTranslation();
  const { scrollHandlerProps } = useBottomNavScroll();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(params.category || null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  const { user } = useAuth();
  const { featureCatalog, allFeaturesList } = useQuickActions();

  // Smart Back Button Handler: Clears category filter first, then search query, then navigates back to Home/Dashboard
  const handleBackPress = useCallback(() => {
    if (selectedCategoryKey !== null) {
      setSelectedCategoryKey(null);
      return true;
    }
    if (searchQuery) {
      setSearchQuery('');
      return true;
    }
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    router.replace('/(resident)/dashboard' as any);
    return true;
  }, [selectedCategoryKey, searchQuery, router]);

  // Hardware / Gesture Back Button Listener
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }, [handleBackPress])
  );

  const handleTileClick = (tileId: string) => {
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
    if (tileId === 'financial_history') {
      router.navigate('/(resident)/billing/history' as any);
      return;
    }
    if (tileId === 'billing_wallet' || tileId === 'amenities_wallet') {
      router.navigate('/(resident)/billing/wallet' as any);
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

  const toggleCategoryExpand = (catKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const isAdminRole = checkIsAdmin(user);
  const activeCategory = featureCatalog?.find(cat => cat.categoryKey === selectedCategoryKey);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScreenShell
      title={t('all_features', 'All Features')}
      subtitle={t('explore_quick_actions', 'Explore community quick actions and services')}
      iconName="LayoutGrid"
      scrollable={false}
      showBackButton={true}
      onBackPress={handleBackPress}
      showGlobalNavButton={true}
    >
      <ScrollView
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        {...scrollHandlerProps}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 95, 130) }}
      >
        <View className="gap-4 pb-8 max-w-md mx-auto w-full">
          {/* Search All Features Bar */}
          <View className="flex-row items-center bg-card border border-border rounded-2xl px-3.5 min-h-[46px] py-0 shadow-xs">
            <View pointerEvents="none">
              <Search size={18} color="#172B70" className="me-2.5 shrink-0" />
            </View>
            <TextInput
              placeholder={t('search_all_features', 'Search all features...')}
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-[13px] font-sans text-foreground self-stretch min-h-[42px] py-2"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
                <X size={15} className="text-muted-foreground" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* DYNAMIC CATEGORY SECTIONS FROM BACKEND */}
          {featureCatalog && featureCatalog.length > 0 ? (
            featureCatalog
              .filter((cat) => !selectedCategoryKey || cat.categoryKey === selectedCategoryKey)
              .map((category) => {
                const filteredItems = category.items.filter((item) => {
                  if (searchQuery) {
                    const localizedName = tFeatureName(item.id, item.name);
                    const q = searchQuery.toLowerCase();
                    if (
                      !item.name.toLowerCase().includes(q) &&
                      !localizedName.toLowerCase().includes(q)
                    ) {
                      return false;
                    }
                  }

                  // Hide resident personal passes for Admin roles
                  if (
                    isAdminRole &&
                    (item.id === 'visitor_resident_passes' || item.id === 'visitor_passes')
                  ) {
                    return false;
                  }

                  return isFeatureAllowedForUser(item, user);
                });

                if (filteredItems.length === 0) return null;

                const isExpanded = Boolean(expandedCategories[category.categoryKey]) || Boolean(searchQuery);
                const hasMore = filteredItems.length > 6;
                const displayedItems = isExpanded ? filteredItems : filteredItems.slice(0, 6);

                const categoryMeta: Record<string, { icon: string; subKey: string; subtitle: string; color: string }> = {
                  visitor_management: { icon: 'ShieldCheck', subKey: 'cat_visitor_sub', subtitle: 'Security & Gate Access', color: '#2563EB' },
                  amenities_facilities: { icon: 'Sparkles', subKey: 'cat_amenities_sub', subtitle: 'Facilities & Reservations', color: '#16A34A' },
                  complaints_helpdesk: { icon: 'ListTodo', subKey: 'cat_complaints_sub', subtitle: 'Issues & SLA Helpdesk', color: '#7C3AED' },
                  notice_board_polls: { icon: 'Megaphone', subKey: 'cat_notice_sub', subtitle: 'Broadcasts & Resident Polls', color: '#DB2777' },
                  digital_wallet: { icon: 'WalletCards', subKey: 'cat_wallet_sub', subtitle: 'Prepaid Balance & Ledger', color: '#10B981' },
                  financial_billing: { icon: 'CreditCard', subKey: 'cat_billing_sub', subtitle: 'Dues, Invoices & Accounts', color: '#0D9488' },
                  administration_security: { icon: 'UserRoundCog', subKey: 'cat_admin_sub', subtitle: 'Staff, RBAC & Settings', color: '#D97706' },
                };

                const currentMeta = categoryMeta[category.categoryKey] || {
                  icon: 'Layers',
                  subKey: '',
                  subtitle: 'Module Features',
                  color: '#FF6A00',
                };

                const actionLabel = hasMore
                  ? isExpanded
                    ? t('show_less', 'Show less')
                    : t('view_all_count', `View all (${filteredItems.length})`, { count: filteredItems.length })
                  : undefined;

                return (
                  <View key={category.categoryKey} className="gap-2.5">
                    <SectionHeader
                      title={tCategoryName(category.categoryKey, category.categoryName)}
                      subtitle={currentMeta.subKey ? t(currentMeta.subKey, currentMeta.subtitle) : translateText(currentMeta.subtitle)}
                      count={filteredItems.length}
                      icon={currentMeta.icon}
                      iconColor={currentMeta.color}
                      actionLabel={actionLabel}
                      isExpanded={isExpanded}
                      onAction={hasMore ? () => toggleCategoryExpand(category.categoryKey) : undefined}
                      className="px-0 py-1"
                    />

                    <View className="flex-row flex-wrap justify-start gap-x-[2.6%] gap-y-3.5">
                      {displayedItems.map((item) => {
                        const meta = ALL_AVAILABLE_FEATURES.find((f) => f.id === item.id);
                        const iconName = meta?.iconName || item.iconName;
                        const colorIcon = meta?.colorIcon || item.colorIcon || '#245FA8';
                        const badge = meta?.badge || item.badge;
                        const badgeColor = meta?.badgeColor || item.badgeColor;

                        return (
                          <ActionTile
                            key={item.id}
                            containerClassName="w-[23%]"
                            icon={<FeatureIcon iconName={iconName} color={colorIcon} size={25} strokeWidth={1.9} />}
                            label={tFeatureName(item.id, meta?.name || item.name)}
                            subtitle={tFeatureSubtitle(item.id, meta?.subtitle || item.subtitle)}
                            metaValue={tFeatureSubtitle(item.id, meta?.subtitle || item.subtitle)}
                            badge={badge}
                            badgeColor={badgeColor}
                            onPress={() => handleTileClick(item.id)}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

