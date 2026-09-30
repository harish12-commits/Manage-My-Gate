import React, { useState, useMemo } from 'react';
import { View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileText,
  Users,
  Megaphone,
  CheckCircle,
  BarChart3,
  PenTool,
  AlertTriangle,
  Plus,
} from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { Text } from '@/components/ui/text';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';
import { type KPICardProps } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ListCard } from '@/components/ui/ListCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusVariant } from '@/components/ui/StatusBadge';
import { CommunityEngagementTypeSheet } from '../components/CommunityEngagementTypeSheet';
import { useCommunityEngagementDashboard } from '../hooks/useCommunityEngagementDashboard';
import { EngagementContentType } from '../types/communityEngagement.types';
import { useTranslation } from '@/src/utils/i18n';

export function CommunityEngagementDashboardScreen() {
  const router = useRouter();
  const { t, tCategoryName } = useTranslation();
  const [typeSheetVisible, setTypeSheetVisible] = useState(false);
  const { kpis, recentEngagements, loading, isRefreshing, error, refreshDashboard } =
    useCommunityEngagementDashboard();

  const handleSelectType = (type: EngagementContentType) => {
    setTypeSheetVisible(false);
    router.navigate({
      pathname: '/(resident)/community-engagement/create' as any,
      params: { type },
    });
  };

  const kpiCards: KPICardProps[] = useMemo(
    () => [
      {
        title: t('active_notices'),
        value: kpis.activeNotices,
        variant: 'success',
        iconName: 'CheckCircle',
        subtitle: t('live_circulars'),
        onPress: () =>
          router.navigate({
            pathname: '/(resident)/community-engagement/ledger' as any,
            params: { tab: 'NOTICES', status: 'Published' },
          }),
      },
      {
        title: t('active_polls'),
        value: kpis.activePolls,
        variant: 'info',
        iconName: 'BarChart3',
        subtitle: t('open_for_vote'),
        onPress: () =>
          router.navigate({
            pathname: '/(resident)/community-engagement/ledger' as any,
            params: { tab: 'POLLS', status: 'Active' },
          }),
      },
      {
        title: t('draft_notices'),
        value: kpis.draftNotices,
        variant: 'warning',
        iconName: 'PenTool',
        subtitle: t('unpublished_drafts'),
        onPress: () =>
          router.navigate({
            pathname: '/(resident)/community-engagement/ledger' as any,
            params: { tab: 'NOTICES', status: 'Draft' },
          }),
      },
      {
        title: t('urgent_notices_count'),
        value: kpis.urgentNotices,
        variant: 'destructive',
        iconName: 'AlertTriangle',
        subtitle: t('high_critical_priority'),
        onPress: () =>
          router.navigate({
            pathname: '/(resident)/community-engagement/ledger' as any,
            params: { tab: 'NOTICES', priority: 'Critical' },
          }),
      },
    ],
    [kpis, router, t]
  );

  const getStatusBadgeVariant = (status: string, priority?: string): StatusVariant => {
    if (priority === 'Critical' || priority === 'High') return 'danger';
    const s = (status || '').toUpperCase();
    if (s === 'PUBLISHED' || s === 'ACTIVE') return 'success';
    if (s === 'DRAFT') return 'warning';
    if (s === 'SCHEDULED') return 'info';
    return 'neutral';
  };

  return (
    <ScreenShell
      title={t('community_engagement')}
      subtitle={t('community_engagement_sub')}
      iconName="Megaphone"
      showBackButton={true}
      headerRight={
        <HeaderActionButton
          icon={Plus}
          label={t('create_engagement', 'Create Engagement')}
          onPress={() => setTypeSheetVisible(true)}
          accessibilityLabel={t('create_engagement')}
        />
      }
      loading={loading && !isRefreshing}
      error={error}
      onRetry={refreshDashboard}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 space-y-5 pb-20"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshDashboard} />
        }
      >
        {/* 1. 4 KPI Metrics Grid (2x2) */}
        <View className="mb-2">
          <KPIDashboardStrip
            cards={kpiCards}
            loading={loading && !isRefreshing}
            layout="grid2x2"
          />
        </View>

        {/* 2. Quick Actions Row */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.navigate('/(resident)/community-engagement/ledger' as any)}
            className="flex-1 bg-card border border-border/80 p-3.5 rounded-2xl active:opacity-75 shadow-2xs justify-between min-h-[112px]"
            accessibilityRole="button"
            accessibilityLabel={t('manage_engagements')}
          >
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center mb-2.5">
              <FileText size={20} className="text-primary" />
            </View>
            <View>
              <Text className="text-sm font-bold text-foreground leading-snug">
                {t('manage_engagements')}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                {t('manage_engagements_desc')}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.navigate('/(resident)/notices/active-board' as any)}
            className="flex-1 bg-card border border-border/80 p-3.5 rounded-2xl active:opacity-75 shadow-2xs justify-between min-h-[112px]"
            accessibilityRole="button"
            accessibilityLabel={t('resident_view')}
          >
            <View className="w-10 h-10 rounded-xl bg-emerald-500/10 items-center justify-center mb-2.5">
              <Users size={20} className="text-emerald-500" />
            </View>
            <View>
              <Text className="text-sm font-bold text-foreground leading-snug">
                {t('resident_view')}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                {t('resident_view_desc')}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 3. Recent Activity Section (Strict 3-Item Limit) */}
        <View className="space-y-3">
          <SectionHeader
            title={t('recent_activity')}
            actionLabel={t('see_all')}
            onAction={() => router.navigate('/(resident)/community-engagement/ledger' as any)}
          />

          {recentEngagements.length === 0 && !loading ? (
            <EmptyState
              icon={Megaphone}
              title={t('no_recent_activity')}
              description={t('no_recent_engagement_desc')}
              className="py-6"
            />
          ) : (
            <View className="space-y-2">
              {recentEngagements.map((item) => {
                const isNotice = item.type === 'NOTICE';
                const subtitleDisplay = !isNotice
                  ? t('poll_subtitle_meta', {
                      options: (item as any).optionsCount ?? 0,
                      votes: (item as any).votesCount ?? 0,
                    })
                  : (item as any).category
                  ? `${tCategoryName((item as any).category)} • ${t(
                      `priority_${((item as any).priority || 'medium').toLowerCase()}`,
                      (item as any).priority || 'Medium'
                    )} ${t('priority', 'Priority')}`
                  : t('notice');

                return (
                  <ListCard
                    key={`${item.type}-${item.id}`}
                    title={item.title}
                    subtitle={subtitleDisplay}
                    leftIcon={item.type === 'NOTICE' ? 'Megaphone' : 'BarChart3'}
                    leftIconBgColor={item.type === 'NOTICE' ? 'bg-primary/10' : 'bg-sky-500/10'}
                    leftIconColor={item.type === 'NOTICE' ? '#6366f1' : '#0ea5e9'}
                    status={{
                      label: item.status,
                      variant: getStatusBadgeVariant(item.status, item.priority),
                    }}
                    secondaryBadge={{
                      label: item.type === 'NOTICE' ? t('notice') : t('poll'),
                      variant: item.type === 'NOTICE' ? 'info' : 'gold',
                    }}
                    timestamp={item.createdAt}
                    showChevron={true}
                    onPress={() => router.navigate(item.route as any)}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Unified Creation Archetype Selection Sheet */}
      <CommunityEngagementTypeSheet
        visible={typeSheetVisible}
        onClose={() => setTypeSheetVisible(false)}
        onSelectType={handleSelectType}
      />
    </ScreenShell>
  );
}

export default CommunityEngagementDashboardScreen;
