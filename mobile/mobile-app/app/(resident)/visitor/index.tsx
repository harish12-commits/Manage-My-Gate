import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
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
import { VisitorInvitationTypeSheet } from '@/src/features/visitor/components/shared/VisitorInvitationTypeSheet';
import { VisitorLogDetailsModal } from '@/src/features/visitor/components/history/VisitorLogDetailsModal';
import { ExtendedVisitorPass, PassTypeKey } from '@/src/features/visitor/mocks/visitorMocks';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { mapBackendPassToHistoryItem } from '@/src/features/visitor/utils/mapBackendPassToHistoryItem';
import { useTranslation } from '@/src/utils/i18n';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';
import { UserPlus, History, ShieldAlert, ShieldCheck, Plus } from 'lucide-react-native';

export default function VisitorDashboardScreen() {
  const router = useRouter();
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<ExtendedVisitorPass | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();

  const { dashboard, fetchDashboardData, activeVisitors, fetchActiveVisitors } = useVisitorPass();

  const loadData = useCallback(async () => {
    await Promise.all([fetchDashboardData(), fetchActiveVisitors()]);
  }, [fetchDashboardData, fetchActiveVisitors]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSelectType = (type: PassTypeKey) => {
    setInviteSheetOpen(false);
    router.push({ pathname: '/(resident)/visitor/invite' as any, params: { type } });
  };

  const mappedRecentPasses = useMemo(() => {
    if (!Array.isArray(dashboard?.recentPasses)) return [];
    return dashboard.recentPasses.map((p: any) => mapBackendPassToHistoryItem(p));
  }, [dashboard?.recentPasses]);

  const pendingWalkInsCount = dashboard?.pendingWalkIns?.length || 0;
  const activePassesCount = dashboard?.activePassesCount || 0;
  const insideCount = activeVisitors?.length || 0;
  const isLoading = dashboard?.status === 'loading' && !refreshing && mappedRecentPasses.length === 0;

  const visitorKpis: KPICardProps[] = [
    {
      title: t('active_passes', 'Active Passes'),
      value: String(activePassesCount),
      iconName: 'ShieldCheck',
      variant: 'success',
      trend: { direction: 'up', value: t('live', 'Live') },
    },
    {
      title: t('inside_now', 'Inside Now'),
      value: String(insideCount),
      iconName: 'Users',
      variant: insideCount > 0 ? 'info' : 'default',
      trend: { direction: 'up', value: insideCount > 0 ? t('on_premises', 'On Premises') : t('none', 'None') },
    },
    {
      title: t('walkins', 'Walk-Ins'),
      value: String(pendingWalkInsCount),
      iconName: 'Clock',
      variant: pendingWalkInsCount > 0 ? 'warning' : 'accent',
      trend: {
        direction: pendingWalkInsCount > 0 ? 'down' : 'up',
        value: pendingWalkInsCount > 0 ? t('needs_action', 'Needs action') : t('clear', 'Clear'),
      },
    },
  ];

  const canUseGateConsole = isFeatureAllowedForUser(
    { id: 'visitor_gate_console', permission: 'visitor:guard' },
    user
  );

  const visitorActions: ActionGridItem[] = [
    {
      id: 'invite',
      name: t('new_invite', 'New Invite'),
      iconName: 'UserPlus',
      colorBg: 'bg-emerald-500/10',
      colorIcon: '#10b981',
      onPress: () => setInviteSheetOpen(true),
    },
    ...(canUseGateConsole ? [{
      id: 'gate_console',
      name: t('gate_console', 'Gate Console'),
      iconName: 'DoorOpen',
      colorBg: 'bg-teal-500/10',
      colorIcon: '#0d9488',
      route: '/(resident)/visitor/gate-console',
    } as ActionGridItem] : []),
    {
      id: 'history',
      name: t('history_logs', 'History Logs'),
      iconName: 'History',
      colorBg: 'bg-blue-500/10',
      colorIcon: '#3b82f6',
      route: '/(resident)/visitor/history',
    },
    {
      id: 'walkins',
      name: t('walkins', 'Walk-Ins'),
      iconName: 'ShieldAlert',
      colorBg: 'bg-amber-500/10',
      colorIcon: '#f59e0b',
      route: '/(resident)/visitor/walk-ins',
    },
  ];

  return (
    <ScreenShell
      title={t('visitor_passes', 'Visitor Passes')}
      subtitle={t('visitor_subtext', 'Resident entry approvals, QR passes & gate logs')}
      iconName="ShieldCheck"
      scrollable={false}
      loading={isLoading}
      error={dashboard?.status === 'failed' ? (dashboard?.error || 'Failed to load dashboard data.') : null}
      onRetry={loadData}
      headerRight={
        <Button
          variant="default"
          size="sm"
          onPress={() => setInviteSheetOpen(true)}
          className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-2xs"
          accessibilityRole="button"
          accessibilityLabel="Issue Visitor Pass"
        >
          <Plus size={14} color="#ffffff" strokeWidth={2.4} />
          <Text className="text-xs font-bold text-primary-foreground">{t('issue_pass', 'Issue')}</Text>
        </Button>
      }
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 pb-36 gap-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Universal KPI Statistics Strip */}
        <KPIDashboardStrip cards={visitorKpis} />

        {/* Universal 3-Column ActionGrid */}
        <ActionGrid title={t('quick_actions', 'Quick Actions')} items={visitorActions} />

        {/* Canonical Section Header */}
        <SectionHeader
          title={t('recent_activity', 'Recent Activity')}
          actionLabel={t('view_all', 'View All')}
          onAction={() => router.push('/(resident)/visitor/history' as any)}
          className="px-0 bg-transparent dark:bg-transparent"
        />

        {/* Visitor Cards */}
        {mappedRecentPasses.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t('no_recent_visitor_activity', 'No Active Visitor Passes')}
            description={t('no_recent_visitor_sub', 'Create a new pass to pre-approve visitor entry at the gate.')}
            actionLabel={t('new_invite', 'New Invite')}
            onAction={() => setInviteSheetOpen(true)}
          />
        ) : (
          <View className="gap-2.5">
            {mappedRecentPasses.slice(0, 3).map((pass: ExtendedVisitorPass) => (
              <VisitorPassCard
                key={pass._id}
                pass={pass}
                onPress={(p) => {
                  setSelectedPass(p as ExtendedVisitorPass);
                  setDetailsModalOpen(true);
                }}
                onShowQR={(p) => {
                  setSelectedPass(p as ExtendedVisitorPass);
                  setDetailsModalOpen(true);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Invitation Type Selector Bottom Sheet */}
      <VisitorInvitationTypeSheet
        visible={inviteSheetOpen}
        onClose={() => setInviteSheetOpen(false)}
        onSelectType={handleSelectType}
      />

      {/* Visitor Log Details Modal */}
      <VisitorLogDetailsModal
        visible={detailsModalOpen}
        pass={selectedPass}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedPass(null);
        }}
        onRevokeSuccess={loadData}
      />
    </ScreenShell>
  );
}
