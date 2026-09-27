import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { KPIDashboardStrip } from '@/components/ui/KPIDashboardStrip';
import { type KPICardProps } from '@/components/ui/KPICard';
import { ActionGrid, type ActionGridItem } from '@/components/ui/ActionGrid';
import { SectionHeader } from '@/components/common/SectionHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { FAB } from '@/components/ui/FAB';
import { VisitorPassCard } from '@/src/features/visitor/components/VisitorPassCard';
import { VisitorLogDetailsModal } from '@/src/features/visitor/components/history/VisitorLogDetailsModal';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';
import { mapBackendPassToHistoryItem } from '@/src/features/visitor/utils/mapBackendPassToHistoryItem';
import { History, ShieldCheck, Plus } from 'lucide-react-native';
import { useTranslation } from '@/src/utils/i18n';

export default function AdminVisitorDashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPass, setSelectedPass] = useState<any | null>(null);

  const {
    communityPasses,
    analytics,
    status,
    error,
    loadCommunityPasses,
    loadAnalytics,
  } = useAdminVisitor();

  const isLoading = status === 'loading' && !refreshing && communityPasses.length === 0;

  const loadData = useCallback(async () => {
    await Promise.all([loadCommunityPasses({ page: 1, limit: 10 }), loadAnalytics()]);
  }, [loadCommunityPasses, loadAnalytics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const totalVisitorsToday = analytics?.totalVisitorsToday ?? 0;
  const activeInsideCount = analytics?.activeInsideCount ?? 0;
  const pendingCount = analytics?.pendingApprovalsCount ?? 0;
  const blacklistedCount = analytics?.totalBlacklistedCount ?? 0;

  const adminKpis: KPICardProps[] = [
    {
      title: 'Visitors Today',
      value: String(totalVisitorsToday),
      iconName: 'Users',
      variant: 'info',
    },
    {
      title: 'Active Inside',
      value: String(activeInsideCount),
      iconName: 'ShieldCheck',
      variant: 'success',
    },
    {
      title: 'Pending',
      value: String(pendingCount),
      iconName: 'Clock',
      variant: 'warning',
    },
    {
      title: 'Blacklisted',
      value: String(blacklistedCount),
      iconName: 'ShieldX',
      variant: 'destructive',
    },
  ];

  const adminVisitorActions: ActionGridItem[] = [
    {
      id: 'passes',
      name: 'All Passes',
      iconName: 'Filter',
      colorBg: 'bg-blue-500/10',
      colorIcon: '#3b82f6',
      route: '/(resident)/visitor/admin/community-passes',
    },
    {
      id: 'walkins',
      name: 'Master Walk-Ins',
      iconName: 'ShieldAlert',
      colorBg: 'bg-amber-500/10',
      colorIcon: '#f59e0b',
      route: '/(resident)/visitor/admin/walk-in-console',
    },
    {
      id: 'blacklist',
      name: 'Blacklist',
      iconName: 'ShieldX',
      colorBg: 'bg-destructive/10',
      colorIcon: '#ef4444',
      route: '/(resident)/visitor/admin/blacklist',
    },
    {
      id: 'logs',
      name: 'Audit Logs',
      iconName: 'History',
      colorBg: 'bg-blue-500/10',
      colorIcon: '#3b82f6',
      route: '/(resident)/visitor/admin-logs',
    },
  ];

  return (
    <ScreenShell
      title={t('community_visitor_management', 'Community Visitor Management')}
      subtitle={t('admin_master_security_console_entry_audi', 'Admin master security console & entry audit')}
      iconName="ShieldCheck"
      scrollable={false}
      loading={isLoading}
      error={error}
      onRetry={loadData}
      headerRight={
        <Button
          variant="default"
          size="sm"
          onPress={() => router.push('/(resident)/visitor/admin/create-pass' as any)}
          className="flex-row items-center gap-1 px-3 rounded-full bg-emerald-600 active:bg-emerald-700 border-0"
          accessibilityRole="button"
          accessibilityLabel={t('create_pass', 'Create Pass')}
        >
          <Plus size={14} color="#ffffff" />
          <Text className="text-xs font-bold text-white">{t('create_pass', 'Create Pass')}</Text>
        </Button>
      }
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 gap-4 pb-28"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Universal Admin KPIs 2x2 Grid */}
        <KPIDashboardStrip cards={adminKpis} />

        {/* Universal 3-Column ActionGrid */}
        <ActionGrid title="Quick Actions" items={adminVisitorActions} />

        {/* Canonical Section Header */}
        <SectionHeader
          title="Recent Activity"
          actionLabel="View All"
          onAction={() => router.push('/(resident)/visitor/admin/community-passes' as any)}
          className="px-0 bg-transparent dark:bg-transparent"
        />

        {/* List of Recent Passes using Reusable VisitorPassCard */}
        {communityPasses.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Community Passes Recorded"
            description="No entry or exit logs have been recorded today."
            actionLabel="Create Pass"
            onAction={() => router.push('/(resident)/visitor/admin/create-pass' as any)}
          />
        ) : (
          <View className="gap-2.5">
            {communityPasses.slice(0, 3).map((pass: any) => (
              <VisitorPassCard
                key={pass._id}
                pass={pass}
                villaBadge={pass.villaName || pass.villaNumber || 'Community'}
                onPress={(p) => setSelectedPass(mapBackendPassToHistoryItem(p))}
                onShowQR={(p) => setSelectedPass(mapBackendPassToHistoryItem(p))}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <VisitorLogDetailsModal
        visible={Boolean(selectedPass)}
        pass={selectedPass}
        onClose={() => setSelectedPass(null)}
      />
    </ScreenShell>
  );
}
